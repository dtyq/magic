"""本地 CLI 状态探测的统一门面。

Factory 负责调度和聚合各平台 provider，外部不需要知道具体 CLI 的实现细节。
"""
from __future__ import annotations

import asyncio
import html
from typing import Callable, Optional, Sequence

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.service.cli_status.common import CliStatusProbe, CliStatusSnapshot
from app.service.cli_status.providers import DwsCliStatusProbe, LarkCliStatusProbe

logger = get_logger(__name__)

CLI_STATUS_INITIAL_WAIT_SECONDS = 0.15


def _default_probe_factory() -> Sequence[CliStatusProbe]:
    """返回默认启用的 CLI provider 列表。"""
    return (
        DwsCliStatusProbe(),
        LarkCliStatusProbe(),
    )


class CliStatusFactory:
    """CLI 状态探测对外唯一入口。

    该类只在 init 后调度一次后台探测；探测结果作为 Horizon 环境上下文，
    不参与平台自动选择，也不阻断主 agent 流程。
    """

    _tasks: dict[int, asyncio.Task] = {}
    _scheduled_contexts: set[int] = set()
    _probe_factory: Callable[[], Sequence[CliStatusProbe]] = _default_probe_factory

    @classmethod
    def configure_for_tests(cls, probe_factory: Callable[[], Sequence[CliStatusProbe]]) -> None:
        """替换 provider 工厂，供单测注入 mock probe。"""
        cls._probe_factory = probe_factory
        cls._tasks.clear()
        cls._scheduled_contexts.clear()

    @classmethod
    def reset_for_tests(cls) -> None:
        """恢复默认 provider 工厂并清空测试任务状态。"""
        cls._probe_factory = _default_probe_factory
        cls._tasks.clear()
        cls._scheduled_contexts.clear()

    @classmethod
    def schedule_initial_detection(cls, agent_context: AgentContext) -> None:
        """在 workspace init 后调度一次后台 CLI 探测。

        同一个 AgentContext 只调度一次；如果缺少 Horizon 或事件循环不可用，则静默降级。
        本方法是 fire-and-forget 入口，不向生产调用方暴露可 await 的 Task。
        """
        if agent_context is None or getattr(agent_context, "horizon", None) is None:
            return

        key = id(agent_context)
        if key in cls._scheduled_contexts:
            return
        cls._scheduled_contexts.add(key)

        try:
            task = asyncio.create_task(cls._detect_and_write(agent_context))
        except RuntimeError as exc:
            logger.debug(f"[CliStatusFactory] cannot schedule detection without running loop: {exc}")
            return

        cls._tasks[key] = task

        def _on_done(done_task: asyncio.Task) -> None:
            """回收后台任务引用，避免 completed task 长期留在内存里。"""
            if cls._tasks.get(key) is done_task:
                cls._tasks.pop(key, None)
            try:
                done_task.result()
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                logger.warning(f"[CliStatusFactory] background detection failed: {exc}")

        task.add_done_callback(_on_done)

    @classmethod
    def get_initial_detection_task_for_tests(cls, agent_context: AgentContext) -> Optional[asyncio.Task]:
        """返回已调度的后台任务句柄，仅供单测等待检测完成。"""
        return cls._tasks.get(id(agent_context))

    @classmethod
    async def wait_initial(cls, agent_context: AgentContext, timeout: float = CLI_STATUS_INITIAL_WAIT_SECONDS) -> None:
        """首轮 Horizon 注入前短等已启动的探测任务。

        这里只等待已有任务，不会新发起探测；超时后直接继续主流程。
        """
        task = cls._tasks.get(id(agent_context))
        if task is None or task.done():
            return
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
        except asyncio.TimeoutError:
            logger.debug(f"[CliStatusFactory] initial CLI status wait timed out after {timeout:.3f}s")
        except Exception as exc:
            logger.debug(f"[CliStatusFactory] initial CLI status wait failed: {exc}")

    @classmethod
    async def build_horizon_entries(cls) -> tuple[CliStatusSnapshot, ...]:
        """并发执行所有 provider，并返回可注入的 CLI 条目。

        provider 自行决定是否返回 horizon；Factory 只过滤空 horizon 和失败结果。
        """
        probes = tuple(cls._probe_factory())
        results = await asyncio.gather(
            *(probe.detect() for probe in probes),
            return_exceptions=True,
        )

        entries = []
        for probe, result in zip(probes, results):
            if isinstance(result, Exception):
                logger.warning(
                    f"[CliStatusFactory] probe failed: cli={probe.cli_name} error={result}"
                )
            elif isinstance(result, CliStatusSnapshot) and result.has_horizon:
                entries.append(result)
        return tuple(entries)

    @classmethod
    def format_horizon_text(cls, entries: Sequence[CliStatusSnapshot]) -> str:
        """把 CLI 条目拼成 Horizon 内层 XML。

        horizon 内容来自 provider，视为已脱敏的可信片段，Factory 不再解析业务语义。
        """
        blocks = []
        for entry in entries:
            horizon = entry.horizon.strip()
            if not horizon:
                continue
            cli = html.escape(entry.cli, quote=True)
            blocks.append(f'<cli name="{cli}">{horizon}</cli>')
        return "\n".join(blocks)

    @classmethod
    async def _detect_and_write(cls, agent_context: AgentContext) -> None:
        """执行探测并写入 Horizon current 状态。

        写入失败只记录日志，避免 init 后台检测影响用户请求。
        """
        try:
            entries = await cls.build_horizon_entries()
            status = cls.format_horizon_text(entries)
            horizon = getattr(agent_context, "horizon", None)
            if horizon is not None:
                await horizon.set_cli_status(status)
            logger.debug("[CliStatusFactory] wrote initial CLI status to horizon")
        except Exception as exc:
            logger.warning(f"[CliStatusFactory] detection failed: {exc}")
