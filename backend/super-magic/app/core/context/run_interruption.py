"""
单次 agent run 的取消状态、cleanup 注册表、worker cancel 句柄。

只服务于"当前 agent 单轮运行"的中断与清理。
AgentContext 在每次新 run 开始前（reset_run_state）重置它们。
"""
from __future__ import annotations

import asyncio
from collections.abc import Callable, Awaitable
from dataclasses import dataclass
from typing import Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RunCancelState:
    """当前 run 所处的取消阶段，用于幂等判断。"""
    requested: bool = False
    reason: str = ""
    cleanup_started: bool = False
    cleanup_finished: bool = False


class RunCleanupRegistry:
    """当前 run 的业务 cleanup handler 注册表。

    - 按 key 注册，可替换、可注销
    - run_all() 在单次 run 内只执行一次（幂等保护）
    - AgentContext.reset_run_state() 创建新实例，旧 handler 自然失效
    """

    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[], Awaitable[None]]] = {}
        self._executed: bool = False

    def register(self, key: str, handler: Callable[[], Awaitable[None]]) -> None:
        self._handlers[key] = handler

    async def run_all(self) -> None:
        """执行所有已注册的 handler，幂等，最多执行一次。"""
        if self._executed:
            return
        self._executed = True
        for key, handler in list(self._handlers.items()):
            try:
                await handler()
            except Exception as e:
                logger.error(f"[RunCleanupRegistry] handler '{key}' raised: {e}", exc_info=True)


class RunCancellationHandle:
    """当前 run 的 worker cancel 入口。

    worker task 创建后通过 register() 注入 cancel callback，
    AgentContext.stop_run() 通过此句柄取消 worker。
    """

    def __init__(self) -> None:
        self._cancel_cb: Optional[Callable[[], Awaitable[None]]] = None

    def register(self, cb: Callable[[], Awaitable[None]]) -> None:
        self._cancel_cb = cb

    async def cancel(self) -> None:
        if self._cancel_cb is not None:
            try:
                await self._cancel_cb()
            except Exception as e:
                logger.error(f"[RunCancellationHandle] cancel callback raised: {e}", exc_info=True)
