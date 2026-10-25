"""Coordinate Agent-triggered sandbox restarts at the end of a run."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from agentlang.logger import get_logger
from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfig

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class PendingRestart:
    """The information required to dispatch one terminal restart request."""

    context_id: str
    sandbox_id: str
    config: MagicServiceConfig
    cancel_resumption: Callable[[], Awaitable[None]]


class SandboxRestartCoordinator:
    """Keep one restart request and its terminal dispatch for the current sandbox."""

    def __init__(self) -> None:
        self._pending: PendingRestart | None = None
        self._restarting = False
        self._dispatch_task: asyncio.Task[None] | None = None

    @property
    def is_restarting(self) -> bool:
        return self._restarting

    def has_pending_restart(self, context_id: str | None = None) -> bool:
        pending = self._pending
        return pending is not None and (context_id is None or pending.context_id == context_id)

    def ensure_accepting_runs(self, context_id: str | None = None) -> None:
        """收尾期间原会话可用新消息取消重启；API 发出后不再启动任务。"""
        if self._restarting and (
            context_id is None or not self.has_pending_restart(context_id)
        ):
            from app.service.agent_runtime.errors import AgentRuntimeBusyError

            raise AgentRuntimeBusyError(
                "The sandbox is restarting. Wait for the runtime to become available."
            )

    def request_restart(
        self,
        *,
        agent_context: AgentContext,
        config: MagicServiceConfig,
        sandbox_id: str,
        cancel_resumption: Callable[[], Awaitable[None]],
    ) -> None:
        """Register a restart to dispatch after the current run is finalized."""
        if agent_context.is_interruption_requested():
            raise asyncio.CancelledError("Sandbox restart interrupted before registration")

        context_id = agent_context.context_id
        if self._pending is not None or self._restarting:
            raise ValueError("A sandbox restart is already pending")

        pending = PendingRestart(
            context_id=context_id,
            sandbox_id=sandbox_id,
            config=config,
            cancel_resumption=cancel_resumption,
        )
        self._pending = pending

        async def _cancel_pending() -> None:
            await self.cancel_pending_restart(context_id)

        try:
            agent_context.register_run_cleanup(
                f"sandbox-restart:{context_id}",
                _cancel_pending,
            )
        except Exception:
            self._pending = None
            raise

    async def cancel_pending_restart(self, context_id: str) -> None:
        """Cancel a restart that has not entered its terminal dispatch phase."""
        pending = self._pending
        if pending is None or pending.context_id != context_id:
            return
        self._pending = None
        self._restarting = False

        try:
            await pending.cancel_resumption()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "Failed to cancel sandbox restart resumption: context_id=%s error=%s",
                context_id,
                exc,
                exc_info=True,
            )

    async def prepare_pending_restart(
        self,
        *,
        agent_context: AgentContext,
        run_succeeded: bool,
    ) -> None:
        """主回复完成后，有限等待其它 Agent 中断；失败不阻止重启。"""
        if not self.has_pending_restart(agent_context.context_id):
            return
        if not run_succeeded or agent_context.is_interruption_requested():
            await self.cancel_pending_restart(agent_context.context_id)
            return

        from app.service.memory.runtime.extraction.memory_extraction_service import (
            MemoryExtractionService,
        )
        from app.tools.subagent_session_manager import subagent_session_manager

        self._restarting = True
        results = await asyncio.gather(
            MemoryExtractionService.interrupt_all(),
            subagent_session_manager.interrupt_all_runs(reason="sandbox_restart"),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, BaseException):
                logger.warning("Sandbox restart cleanup failed: %s: %s", type(result).__name__, result)

    async def dispatch_pending_restart(
        self,
        *,
        agent_context: AgentContext,
        run_succeeded: bool,
    ) -> None:
        """Dispatch one restart after all current-run finalization has completed."""
        context_id = agent_context.context_id
        pending = self._pending
        if pending is None or pending.context_id != context_id:
            return

        if not run_succeeded or agent_context.is_interruption_requested():
            await self.cancel_pending_restart(context_id)
            return

        # Removing the record before the request makes dispatch one-shot and
        # prevents a later cleanup from cancelling a request that may already
        # have reached Magic Service.
        self._pending = None
        self._restarting = True
        logger.info(
            "Dispatching terminal sandbox restart: context_id=%s sandbox_id=%s",
            pending.context_id,
            pending.sandbox_id,
        )

        self._dispatch_task = asyncio.create_task(
            self._dispatch_restart(pending),
            name=f"sandbox-restart-{pending.sandbox_id}",
        )
        # 单次请求由协调器保留引用；取消主 worker 不再阻塞等 HTTP，
        # 也不会取消可能已送达的请求。服务退出仍可取消这个任务。
        await asyncio.shield(self._dispatch_task)

    async def _dispatch_restart(self, pending: PendingRestart) -> None:
        try:
            async with MagicServiceClient(pending.config) as client:
                await client.restart_sandbox(pending.sandbox_id)
        except Exception as exc:
            self._restarting = False
            logger.error(
                "Terminal sandbox restart request failed: sandbox_id=%s error=%s",
                pending.sandbox_id,
                exc,
                exc_info=True,
            )
        finally:
            self._dispatch_task = None


sandbox_restart_coordinator = SandboxRestartCoordinator()

__all__ = [
    "PendingRestart",
    "SandboxRestartCoordinator",
    "sandbox_restart_coordinator",
]
