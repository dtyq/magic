"""将 Lark 转发备注和合并转发回调合成为一个逻辑入站消息。"""

from __future__ import annotations

import asyncio
import hashlib
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from agentlang.logger import get_logger

logger = get_logger(__name__)

_FORWARD_NOTE_RE = re.compile(
    r"\A(?:\s*<p(?:\s[^>]*)?>.*?</p>\s*)+\Z",
    re.IGNORECASE | re.DOTALL,
)


def _fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:12] if value else ""


@dataclass(frozen=True)
class LarkInboundEvent:
    """聚合所需的稳定 Lark 回调字段，不把弱契约 SDK 对象带入核心逻辑。"""

    message_type: str
    message_id: str
    chat_id: str
    sender_id: str
    create_time: str
    root_id: str
    parent_id: str
    thread_id: str
    content: dict[str, Any]

    @property
    def aggregation_key(self) -> tuple[str, str] | None:
        return (self.chat_id, self.sender_id) if self.chat_id and self.sender_id else None

    @property
    def relation_ids(self) -> frozenset[str]:
        return frozenset(value for value in (self.root_id, self.parent_id, self.thread_id) if value)


@dataclass(frozen=True)
class LarkInboundBatch:
    """一个需要创建一张回复卡片并只分发一次的逻辑消息。"""

    events: tuple[LarkInboundEvent, ...]

    @property
    def merge_forward(self) -> LarkInboundEvent | None:
        return next((item for item in self.events if item.message_type == "merge_forward"), None)

    @property
    def note(self) -> LarkInboundEvent | None:
        return next((item for item in self.events if item.message_type == "text"), None)

    @property
    def canonical_event(self) -> LarkInboundEvent:
        # 合并转发的 message_id 是详情查询和资源下载的容器 ID，不能改用备注消息 ID。
        return self.merge_forward or self.events[-1]


@dataclass
class _Pending:
    event: LarkInboundEvent
    task: asyncio.Task[None]


def lark_event_diagnostics(event: LarkInboundEvent) -> dict[str, str]:
    """返回可比较但不暴露原始 ID 或正文的诊断摘要。"""
    return {
        "message_type": event.message_type,
        "message_id_fp": _fingerprint(event.message_id),
        "chat_id_fp": _fingerprint(event.chat_id),
        "sender_id_fp": _fingerprint(event.sender_id),
        "root_id_fp": _fingerprint(event.root_id),
        "parent_id_fp": _fingerprint(event.parent_id),
        "thread_id_fp": _fingerprint(event.thread_id),
        "create_time": event.create_time,
    }


def looks_like_forward_note(event: LarkInboundEvent) -> bool:
    text = event.content.get("text")
    return (
        event.message_type == "text"
        and isinstance(text, str)
        and bool(_FORWARD_NOTE_RE.fullmatch(text))
    )


class LarkMessageAggregator:
    """在短窗口内聚合 Lark 的转发备注和合并转发事件。"""

    def __init__(
        self,
        on_ready: Callable[[LarkInboundBatch], Awaitable[None]],
        window_seconds: float = 1.0,
    ) -> None:
        self._on_ready = on_ready
        self._window_seconds = window_seconds
        self._pending: dict[tuple[str, str], _Pending] = {}
        self._seen: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def submit(self, event: LarkInboundEvent) -> None:
        ready: list[LarkInboundBatch] = []
        async with self._lock:
            now = time.monotonic()
            self._prune_seen(now)
            if event.message_id and event.message_id in self._seen:
                return
            if event.message_id:
                self._seen[event.message_id] = now

            key = event.aggregation_key
            if not self._is_candidate(event) or key is None:
                ready.append(LarkInboundBatch((event,)))
            else:
                pending = self._pending.get(key)
                if pending and self._can_join(pending.event, event):
                    self._pending.pop(key, None)
                    pending.task.cancel()
                    ready.append(LarkInboundBatch((pending.event, event)))
                else:
                    if pending:
                        self._pending.pop(key, None)
                        pending.task.cancel()
                        ready.append(LarkInboundBatch((pending.event,)))
                    task = asyncio.create_task(self._flush_after_timeout(key, event))
                    self._pending[key] = _Pending(event=event, task=task)

        for batch in ready:
            await self._on_ready(batch)

    @staticmethod
    def _is_candidate(event: LarkInboundEvent) -> bool:
        if event.message_type == "merge_forward":
            return True
        return event.message_type == "text" and (
            looks_like_forward_note(event) or bool(event.relation_ids)
        )

    @staticmethod
    def _can_join(first: LarkInboundEvent, second: LarkInboundEvent) -> bool:
        if {first.message_type, second.message_type} != {"text", "merge_forward"}:
            return False
        if first.aggregation_key is None or first.aggregation_key != second.aggregation_key:
            return False

        directly_related = (
            bool(first.relation_ids & second.relation_ids)
            or first.message_id in second.relation_ids
            or second.message_id in first.relation_ids
        )
        if directly_related:
            return True
        if first.relation_ids and second.relation_ids:
            return False

        note = first if first.message_type == "text" else second
        return looks_like_forward_note(note)

    async def _flush_after_timeout(
        self,
        key: tuple[str, str],
        event: LarkInboundEvent,
    ) -> None:
        try:
            await asyncio.sleep(self._window_seconds)
            async with self._lock:
                pending = self._pending.get(key)
                if pending is None or pending.event is not event:
                    return
                self._pending.pop(key, None)
            await self._on_ready(LarkInboundBatch((event,)))
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("[LarkMessageAggregator] 刷新待处理消息失败")

    async def flush(self) -> None:
        async with self._lock:
            pending = list(self._pending.values())
            self._pending.clear()
            for item in pending:
                item.task.cancel()
        for item in pending:
            await self._on_ready(LarkInboundBatch((item.event,)))

    def _prune_seen(self, now: float) -> None:
        expire_before = now - max(self._window_seconds * 2, 60.0)
        self._seen = {
            message_id: timestamp
            for message_id, timestamp in self._seen.items()
            if timestamp >= expire_before
        }
