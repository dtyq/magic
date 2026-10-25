"""Canvas 生成提交服务的并发行为测试。"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.tools.canvas.application.commands import GenerationParameters, GenerationSubmissionCommand
from app.tools.canvas.application.generation_submission_service import GenerationSubmissionService
from app.tools.canvas.application.results import AddElementResultItem, AddElementsResult
from app.tools.canvas.generation import (
    GenerationCapability,
    GenerationCapabilityRegistry,
    GenerationExecutionStrategyInterface,
    GenerationExecutionStrategyRegistry,
    GenerationSubmission,
)


class _FakeSubmissionPort:
    """提供能力注册所需的最小提交端口替身。"""


class _TrackingStrategy(GenerationExecutionStrategyInterface):
    """记录并发执行区间，并支持按 Content ID 控制延迟或失败。"""

    mode = "sync"

    def __init__(self, delays: dict[str, float] | None = None, failures: set[str] | None = None) -> None:
        """初始化测试用延迟、失败集合和活跃任务计数。"""
        self.delays = delays or {}
        self.failures = failures or set()
        self.started: list[str] = []
        self.finished: list[str] = []
        self.active = 0
        self.max_active = 0

    async def execute(self, capability, request, tool_context) -> GenerationSubmission:
        """模拟可控时延的同步生成。"""
        content_id = request.content_id
        self.started.append(content_id)
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(self.delays.get(content_id, 0.01))
            if content_id in self.failures:
                raise RuntimeError(f"mock failure: {content_id}")
            return GenerationSubmission("sync", "completed", output_uri=f"mock/{content_id}.png")
        finally:
            self.active -= 1
            self.finished.append(content_id)


class _CallbackStrategy(_TrackingStrategy):
    """模拟 provider 建单后回传任务时间。"""

    def __init__(self, retry: bool = False) -> None:
        super().__init__()
        self.retry = retry

    async def execute(self, capability, request, tool_context) -> GenerationSubmission:
        if request.on_task_created is not None:
            await request.on_task_created(
                "provider-task-1",
                "2026-10-05T10:01:30+08:00",
                "2026-10-05T10:00:00+08:00",
            )
            if self.retry:
                await request.on_task_created(
                    "provider-task-2",
                    "2026-10-05T10:03:00+08:00",
                    "2026-10-05T10:01:30+08:00",
                )
        return await super().execute(capability, request, tool_context)


def _make_service(strategy: _TrackingStrategy, max_concurrency: int = 4) -> GenerationSubmissionService:
    """创建只依赖 mock 的生成提交服务。"""
    capability = GenerationCapability(
        "mock-image-generation",
        "image",
        "sync",
        _FakeSubmissionPort(),
    )
    return GenerationSubmissionService(
        unit_of_work=object(),
        generation_capabilities=GenerationCapabilityRegistry([capability]),
        generation_tasks=object(),
        generation_execution=GenerationExecutionStrategyRegistry([strategy]),
        generation_result_applier=object(),
        max_concurrency=max_concurrency,
    )


def _make_commands(content_ids: list[str]) -> list[GenerationSubmissionCommand]:
    """构造无真实业务数据的生成命令。"""
    return [
        GenerationSubmissionCommand(
            element_id=f"element-{content_id}",
            content_id=content_id,
            element_type="image",
            parameters=GenerationParameters(prompt=content_id, name=content_id),
            item_ref=content_id,
        )
        for content_id in content_ids
    ]


def _make_result(content_ids: list[str]) -> AddElementsResult:
    """构造与生成命令一一对应的批量结果。"""
    return AddElementsResult(
        [
            AddElementResultItem(
                item_ref=content_id,
                element_id=f"element-{content_id}",
                content_id=content_id,
                status="pending",
            )
            for content_id in content_ids
        ],
        [f"element-{content_id}" for content_id in content_ids],
    )


@pytest.mark.asyncio
async def test_submit_generated_commits_each_completed_item_immediately() -> None:
    """快 provider 完成时应立即提交，不能等待慢 provider。"""
    strategy = _TrackingStrategy(delays={"content-1": 0.04, "content-2": 0.01})
    service = _make_service(strategy, max_concurrency=2)
    content_ids = ["content-1", "content-2"]
    commit_order: list[str] = []
    progress_snapshots: list[list[str]] = []

    async def commit_result(project_path, by_content, work_result) -> None:
        """记录提交时序，并确认快项提交时慢项尚未完成。"""
        content_id = work_result.work_item.submission_item.content_id
        commit_order.append(content_id)
        by_content[content_id].status = work_result.submission.status
        if content_id == "content-2":
            assert "content-1" not in strategy.finished

    async def record_progress(current_result) -> None:
        progress_snapshots.append([item.status for item in current_result.items])

    service._commit_generation_result = AsyncMock(side_effect=commit_result)

    result = await service.submit_generated(
        "mock-project",
        _make_result(content_ids),
        _make_commands(content_ids),
        None,
        on_progress_updated=record_progress,
    )

    assert strategy.max_active == 2
    assert strategy.started == content_ids
    assert commit_order == ["content-2", "content-1"]
    assert [item.content_id for item in result.items] == content_ids
    assert strategy.finished == ["content-2", "content-1"]
    assert progress_snapshots == [
        ["pending", "completed"],
        ["completed", "completed"],
    ]


@pytest.mark.asyncio
async def test_submit_generated_respects_configured_concurrency_limit() -> None:
    """并发上限为 1 时应退化为串行，上限为 2 时不得超过两项。"""
    strategy = _TrackingStrategy(delays={content_id: 0.01 for content_id in ("c1", "c2", "c3")})
    service = _make_service(strategy, max_concurrency=1)
    service._commit_generation_result = AsyncMock()

    await service.submit_generated(
        "mock-project", _make_result(["c1", "c2", "c3"]), _make_commands(["c1", "c2", "c3"]), None
    )

    assert service.max_concurrency == 1
    assert strategy.max_active == 1
    assert strategy.started == ["c1", "c2", "c3"]


@pytest.mark.asyncio
async def test_submit_generated_isolates_provider_failure_per_item() -> None:
    """单项 provider 失败不应取消其他独立生成项。"""
    strategy = _TrackingStrategy(failures={"failed"})
    service = _make_service(strategy, max_concurrency=2)
    service._commit_generation_result = AsyncMock()
    content_ids = ["ok", "failed"]

    result = _make_result(content_ids)
    await service.submit_generated("mock-project", result, _make_commands(content_ids), None)

    assert strategy.finished == ["ok", "failed"] or strategy.finished == ["failed", "ok"]
    assert result.items[0].status == "pending"
    assert [call.args[2].submission.status for call in service._commit_generation_result.await_args_list] == [
        "completed",
        "failed",
    ]


@pytest.mark.asyncio
async def test_submit_generated_isolates_canvas_persistence_failure_per_item() -> None:
    """单项 Canvas 持久化失败只记录告警，不应取消其他生成项。"""
    strategy = _TrackingStrategy(delays={"first": 0.01, "second": 0.04})
    service = _make_service(strategy, max_concurrency=2)
    service._persist_generation_start_metadata = AsyncMock()
    service.unit_of_work = AsyncMock()
    service.unit_of_work.transaction_with_sidecar = AsyncMock(
        side_effect=[IOError("File is empty after write"), None]
    )
    result = _make_result(["first", "second"])

    await service.submit_generated(
        "mock-project",
        result,
        _make_commands(["first", "second"]),
        None,
    )

    assert strategy.finished == ["first", "second"]
    assert [item.status for item in result.items] == ["completed", "completed"]
    assert result.items[0].persistence_warning == (
        "The generation result was produced, but its Canvas metadata could not be saved."
    )
    assert result.items[0].persistence_error == "Canvas metadata persistence is temporarily unavailable."
    assert result.items[1].persistence_warning is None
    assert service.unit_of_work.transaction_with_sidecar.await_count == 2


@pytest.mark.asyncio
async def test_submit_generated_cancels_unfinished_provider_tasks() -> None:
    """外层取消时应回收尚未完成的 provider 任务。"""
    strategy = _TrackingStrategy(delays={"first": 60, "second": 60})
    service = _make_service(strategy, max_concurrency=1)
    service._commit_generation_result = AsyncMock()
    submission_task = asyncio.create_task(
        service.submit_generated(
            "mock-project", _make_result(["first", "second"]), _make_commands(["first", "second"]), None
        )
    )

    while not strategy.started:
        await asyncio.sleep(0)
    submission_task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await submission_task
    assert strategy.active == 0
    assert strategy.finished == ["first"]


@pytest.mark.asyncio
async def test_task_created_persists_backend_timing() -> None:
    """建单回调把后端起点和预期完成时间写进 Canvas。"""
    strategy = _CallbackStrategy()
    service = _make_service(strategy)
    service._commit_generation_result = AsyncMock()
    service._persist_generation_start_metadata = AsyncMock()
    service._persist_generation_timing = AsyncMock()
    on_progress_updated = AsyncMock()
    tool_context = object()
    result = _make_result(["one"])

    await service.submit_generated(
        "mock-project",
        result,
        _make_commands(["one"]),
        tool_context,
        on_progress_updated=on_progress_updated,
    )

    expected_persist_call = (
        "mock-project",
        _make_commands(["one"])[0],
        "2026-10-05T10:01:30+08:00",
        "2026-10-05T10:00:00+08:00",
    )
    service._persist_generation_timing.assert_awaited_once_with(*expected_persist_call)
    assert result.items[0].started_at == "2026-10-05T10:00:00+08:00"
    assert result.items[0].expected_finished_at == "2026-10-05T10:01:30+08:00"
    assert on_progress_updated.await_count == 2
    on_progress_updated.assert_awaited_with(result)


@pytest.mark.asyncio
async def test_task_retry_keeps_first_generation_timing() -> None:
    """provider 自动重试时只持久化第一次有效建单时间。"""
    strategy = _CallbackStrategy(retry=True)
    service = _make_service(strategy)
    service._commit_generation_result = AsyncMock()
    service._persist_generation_start_metadata = AsyncMock()
    service._persist_generation_timing = AsyncMock()
    result = _make_result(["one"])

    await service.submit_generated(
        "mock-project",
        result,
        _make_commands(["one"]),
        None,
        on_progress_updated=AsyncMock(),
    )

    service._persist_generation_timing.assert_awaited_once_with(
        "mock-project",
        _make_commands(["one"])[0],
        "2026-10-05T10:01:30+08:00",
        "2026-10-05T10:00:00+08:00",
    )
    assert result.items[0].started_at == "2026-10-05T10:00:00+08:00"
    assert result.items[0].expected_finished_at == "2026-10-05T10:01:30+08:00"
