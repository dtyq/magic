"""Keep the existing delayed sandbox upgrade behavior."""

from __future__ import annotations

import asyncio
from contextlib import suppress

from app.core.context.agent_context import AgentContext
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfig
from app.tools.core.sandbox_tool_context import LoggerLike

SANDBOX_UPGRADE_DELAY_SECONDS = 10
_pending_tasks: dict[str, asyncio.Task[None]] = {}


def schedule_sandbox_upgrade(
    *,
    agent_context: AgentContext,
    config: MagicServiceConfig,
    sandbox_id: str,
    delay_seconds: int,
    logger: LoggerLike,
) -> None:
    """
    为当前 run 安排一次延迟升级，并在 run 被中断时取消。

    MOCK DEMO：
    - 10 秒内收到新消息：取消延迟升级任务。
    - Agent 主动重启不走本调度器，由收尾协调器处理。
    """
    if agent_context.is_interruption_requested():
        raise asyncio.CancelledError("Sandbox upgrade interrupted before scheduling")
    if delay_seconds < 1:
        raise ValueError("delay_seconds must be at least 1")

    context_key = agent_context.context_id
    previous_task = _pending_tasks.get(context_key)
    if previous_task is not None and not previous_task.done():
        previous_task.cancel()

    task = asyncio.create_task(
        _run_delayed_upgrade(
            config=config,
            sandbox_id=sandbox_id,
            delay_seconds=delay_seconds,
            logger=logger,
        ),
        name=f"sandbox-upgrade-{sandbox_id}",
    )
    _pending_tasks[context_key] = task

    def _on_done(done_task: asyncio.Task[None]) -> None:
        if _pending_tasks.get(context_key) is done_task:
            _pending_tasks.pop(context_key, None)
        try:
            done_task.result()
        except asyncio.CancelledError:
            logger.info("Delayed sandbox upgrade was cancelled before execution")
        except Exception as exc:
            logger.error("Delayed sandbox upgrade failed: %s", exc, exc_info=True)

    task.add_done_callback(_on_done)

    async def _cancel_pending_upgrade() -> None:
        if _pending_tasks.get(context_key) is not task or task.done():
            return
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    agent_context.register_run_cleanup(
        f"sandbox-upgrade:{context_key}",
        _cancel_pending_upgrade,
    )


async def _run_delayed_upgrade(
    *,
    config: MagicServiceConfig,
    sandbox_id: str,
    delay_seconds: int,
    logger: LoggerLike,
) -> None:
    await asyncio.sleep(delay_seconds)
    logger.info(
        "Triggering delayed sandbox upgrade after %s seconds, sandbox_id=%s",
        delay_seconds,
        sandbox_id,
    )

    async with MagicServiceClient(config) as client:
        await client.upgrade_sandbox(sandbox_id)


__all__ = [
    "SANDBOX_UPGRADE_DELAY_SECONDS",
    "schedule_sandbox_upgrade",
]
