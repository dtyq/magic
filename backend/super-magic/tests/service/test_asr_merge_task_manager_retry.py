"""AsrMergeTaskManager.request_retry 重试计数/强制重置回归测试。

覆盖：
- 普通重试递增 retry_count 并把任务从 error 拉回 waiting；
- 达到上限后普通重试被拒绝（retry_limit_reached）；
- force=True 在计数耗尽后仍能成功，并把 retry_count 归零（手动「重新合并」）；
- 任务非 error 时 force 重试为 no-op，不计数。
"""
from pathlib import Path

from app.service.asr.asr_merge_task_manager import (
    AsrMergeTaskManager,
    AsrTaskStatus,
)

MAX_RETRIES = AsrMergeTaskManager.MAX_TASK_RETRIES


def _use_tmp_state_dir(monkeypatch, tmp_path: Path) -> None:
    """把任务状态文件重定向到临时目录，避免依赖真实 workspace。"""

    def _fake_state_file_path(task_key: str) -> Path:
        return tmp_path / f"{task_key}.json"

    monkeypatch.setattr(
        AsrMergeTaskManager,
        "get_state_file_path",
        staticmethod(_fake_state_file_path),
    )


async def _new_failed_task(manager: AsrMergeTaskManager, task_key: str) -> None:
    await manager.create_task(task_key=task_key, source_dir=".asr_recordings/test")
    await manager.fail_task(task_key, "boom")


async def test_normal_retry_increments_and_returns_to_waiting(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    await _new_failed_task(manager, "t-normal")

    ok, retry_count, max_retries = await manager.request_retry("t-normal")

    assert ok is True
    assert retry_count == 1
    assert max_retries == MAX_RETRIES
    task = await manager.get_task("t-normal")
    assert task.status == AsrTaskStatus.WAITING.value
    assert task.error_message is None


async def test_normal_retry_rejected_after_limit(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    await _new_failed_task(manager, "t-limit")

    for _ in range(MAX_RETRIES):
        await manager.fail_task("t-limit", "boom")
        ok, retry_count, _ = await manager.request_retry("t-limit")
        assert ok is True
        assert retry_count <= MAX_RETRIES

    # 再次失败后普通重试应被上限拒绝
    await manager.fail_task("t-limit", "boom")
    ok, retry_count, max_retries = await manager.request_retry("t-limit")
    assert ok is False
    assert retry_count == MAX_RETRIES
    assert max_retries == MAX_RETRIES


async def test_force_retry_resets_count_after_limit(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    await _new_failed_task(manager, "t-force")

    for _ in range(MAX_RETRIES):
        await manager.fail_task("t-force", "boom")
        await manager.request_retry("t-force")
    await manager.fail_task("t-force", "boom")

    # 计数已耗尽：普通重试被拒
    ok, _, _ = await manager.request_retry("t-force")
    assert ok is False

    # force 重试应忽略上限并把计数归零
    ok, retry_count, _ = await manager.request_retry("t-force", force=True)
    assert ok is True
    assert retry_count == 0
    task = await manager.get_task("t-force")
    assert task.status == AsrTaskStatus.WAITING.value
    progress = await manager.get_progress("t-force")
    assert progress.retry_count == 0
    assert progress.upload_completed is True


async def test_force_retry_is_noop_for_non_error_task(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    await manager.create_task(task_key="t-waiting", source_dir=".asr_recordings/test")

    ok, retry_count, _ = await manager.request_retry("t-waiting", force=True)

    assert ok is True
    assert retry_count == 0
    task = await manager.get_task("t-waiting")
    assert task.status == AsrTaskStatus.WAITING.value
