"""短时间内将钉钉留言和转发事件合并为一个逻辑入站消息。"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from agentlang.logger import get_logger

logger = get_logger(__name__)


def _event_key(payload: dict[str, Any]) -> tuple[str, str] | None:
    conversation_id = str(payload.get("conversationId") or "").strip()
    sender_id = str(payload.get("senderStaffId") or payload.get("senderId") or "").strip()
    return (conversation_id, sender_id) if conversation_id and sender_id else None


def _message_type(payload: dict[str, Any]) -> str:
    return str(payload.get("msgtype") or "").strip()


@dataclass
class _Pending:
    payload: dict[str, Any]
    incoming_message: Any
    event_id: str
    received_at: float
    task: asyncio.Task[None]


class DingTalkMessageAggregator:
    """以钉钉平台字段为基础做有界、可去重的事件聚合。"""

    def __init__(
        self,
        on_ready: Callable[[list[dict[str, Any]], Any], Awaitable[None]],
        window_seconds: float = 1.0,
    ) -> None:
        self._on_ready = on_ready
        self._window_seconds = window_seconds
        self._pending: dict[tuple[str, str], _Pending] = {}
        self._seen: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def submit(self, payload: dict[str, Any], incoming_message: Any) -> None:
        message_type = _message_type(payload)
        event_id = str(payload.get("msgId") or "").strip()
        key = _event_key(payload)
        if event_id:
            async with self._lock:
                now = time.monotonic()
                self._prune_seen(now)
                if event_id in self._seen:
                    return
                self._seen[event_id] = now
        if message_type not in {"text", "chatRecord"} or key is None:
            await self._on_ready([payload], incoming_message)
            return

        ready: list[tuple[list[dict[str, Any]], Any]] = []
        async with self._lock:
            self._prune_seen(time.monotonic())
            pending = self._pending.get(key)
            if pending and self._can_join(pending.payload, payload):
                self._pending.pop(key, None)
                pending.task.cancel()
                ready.append(([pending.payload, payload], incoming_message))
            else:
                if pending:
                    self._pending.pop(key, None)
                    pending.task.cancel()
                    ready.append(([pending.payload], pending.incoming_message))
                task = asyncio.create_task(self._flush_after_timeout(key, payload, incoming_message, event_id))
                self._pending[key] = _Pending(
                    payload=payload,
                    incoming_message=incoming_message,
                    event_id=event_id,
                    received_at=time.monotonic(),
                    task=task,
                )

        for batch, context in ready:
            await self._on_ready(batch, context)

    @staticmethod
    def _can_join(first: dict[str, Any], second: dict[str, Any]) -> bool:
        types = {_message_type(first), _message_type(second)}
        return types == {"text", "chatRecord"}

    async def _flush_after_timeout(
        self,
        key: tuple[str, str],
        payload: dict[str, Any],
        incoming_message: Any,
        event_id: str,
    ) -> None:
        try:
            await asyncio.sleep(self._window_seconds)
            async with self._lock:
                pending = self._pending.get(key)
                if pending is None or pending.payload is not payload:
                    return
                self._pending.pop(key, None)
            await self._on_ready([payload], incoming_message)
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("[DingTalkMessageAggregator] 刷新待处理消息失败")

    async def flush(self) -> None:
        async with self._lock:
            pending = list(self._pending.values())
            self._pending.clear()
            for item in pending:
                item.task.cancel()
        for item in pending:
            await self._on_ready([item.payload], item.incoming_message)

    def _prune_seen(self, now: float) -> None:
        expire_before = now - max(self._window_seconds * 2, 60.0)
        self._seen = {event_id: timestamp for event_id, timestamp in self._seen.items() if timestamp >= expire_before}
