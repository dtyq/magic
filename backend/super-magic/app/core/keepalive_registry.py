from __future__ import annotations

import asyncio
from typing import Optional

from agentlang.logger import get_logger
from app.utils.time_utils import now_ms

logger = get_logger(__name__)

KEEPALIVE_WINDOW_HOURS = 72
KEEPALIVE_INTERVAL_SECONDS = 5 * 60
_KEEPALIVE_WINDOW_MS = KEEPALIVE_WINDOW_HOURS * 60 * 60 * 1000


class KeepaliveRegistry:
    """统一管理各来源的沙盒保活。"""

    _instance: Optional["KeepaliveRegistry"] = None

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._last_message_at_ms_by_source: dict[str, int] = {}
        self._connected_once_sources: set[str] = set()

    @classmethod
    def get_instance(cls) -> "KeepaliveRegistry":
        if cls._instance is None:
            cls._instance = KeepaliveRegistry()
        return cls._instance

    def notify_connected_once(self, source: str) -> None:
        """连接建立后只允许同一来源续期一次，避免长连无限续命。"""
        normalized_source = source.strip()
        if not normalized_source:
            return
        if normalized_source in self._connected_once_sources:
            logger.debug(f"[KeepaliveRegistry] 跳过重复连接续期: source={normalized_source}")
            return
        self._connected_once_sources.add(normalized_source)
        self.keepalive_once(f"{normalized_source}.connected")

    def notify_message(self, source: str, occurred_at_ms: int | None = None) -> None:
        """记录真实用户消息时间，并确保消息保活循环运行。"""
        normalized_source = source.strip()
        if not normalized_source:
            return
        message_at_ms = occurred_at_ms if occurred_at_ms and occurred_at_ms > 0 else now_ms()
        current_value = self._last_message_at_ms_by_source.get(normalized_source, 0)
        self._last_message_at_ms_by_source[normalized_source] = max(current_value, message_at_ms)
        self.keepalive_once(f"{normalized_source}.message")
        self._ensure_loop_running()

    def restore_message_time(self, source: str, last_message_at_ms: int) -> None:
        """按来源恢复历史消息时间，避免重启后必须等下一条消息才恢复保活。"""
        normalized_source = source.strip()
        if not normalized_source or last_message_at_ms <= 0:
            return
        current_value = self._last_message_at_ms_by_source.get(normalized_source, 0)
        restored_value = max(current_value, last_message_at_ms)
        self._last_message_at_ms_by_source[normalized_source] = restored_value
        if self._is_within_window(restored_value):
            self._ensure_loop_running()
            logger.info(
                f"[KeepaliveRegistry] 已恢复历史消息时间: source={normalized_source}, "
                f"last_message_at_ms={restored_value}"
            )

    def keepalive_once(self, source: str) -> None:
        """立刻续期一次，但不改变消息保活窗口。"""
        from app.service.agent_dispatcher import AgentDispatcher

        ctx = AgentDispatcher.get_instance().agent_context
        if ctx is None:
            logger.debug(f"[KeepaliveRegistry] 跳过一次性续期，agent_context 未初始化: source={source}")
            return
        ctx.update_activity_time()
        logger.info(f"[KeepaliveRegistry] 已执行一次性续期: source={source}")

    def reset_source(self, source: str) -> None:
        """清理某个来源留下的连接标记和消息时间。"""
        normalized_source = source.strip()
        if not normalized_source:
            return
        self._connected_once_sources.discard(normalized_source)
        self._last_message_at_ms_by_source.pop(normalized_source, None)
        logger.info(f"[KeepaliveRegistry] 已重置来源状态: source={normalized_source}")

    def _ensure_loop_running(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name="keepalive-registry")
        logger.info("[KeepaliveRegistry] 消息保活循环已启动")

    async def _run(self) -> None:
        try:
            while True:
                latest_message_at_ms = self._get_latest_message_at_ms()
                if latest_message_at_ms <= 0:
                    logger.info("[KeepaliveRegistry] 无可用消息活跃时间，停止消息保活循环")
                    return
                if not self._is_within_window(latest_message_at_ms):
                    logger.info(
                        "[KeepaliveRegistry] 最新消息已超出保活窗口，停止消息保活循环: "
                        f"last_message_at_ms={latest_message_at_ms}"
                    )
                    return
                await asyncio.sleep(KEEPALIVE_INTERVAL_SECONDS)
                latest_message_at_ms = self._get_latest_message_at_ms()
                if latest_message_at_ms <= 0 or not self._is_within_window(latest_message_at_ms):
                    logger.info("[KeepaliveRegistry] 消息窗口已失效，停止消息保活循环")
                    return
                self.keepalive_once("message-window")
        except asyncio.CancelledError:
            logger.debug("[KeepaliveRegistry] 消息保活循环已取消")
            raise
        finally:
            self._task = None

    def _get_latest_message_at_ms(self) -> int:
        if not self._last_message_at_ms_by_source:
            return 0
        return max(self._last_message_at_ms_by_source.values(), default=0)

    def _is_within_window(self, message_at_ms: int) -> bool:
        return now_ms() - message_at_ms <= _KEEPALIVE_WINDOW_MS
