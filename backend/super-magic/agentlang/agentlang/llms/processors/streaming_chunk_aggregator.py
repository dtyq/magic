"""V2 流式 chunk 语义聚合。

线上每个 LLM chunk 都会变成一个 Socket.IO 事件。chunk 特别多时，应用队列已经停了，
底层 Engine.IO 发送队列还在排空，finalize/disconnect 会跟着变成长尾。

这个模块只负责“哪些上游 chunk 可以合成一个传输包”。它不碰 Socket.IO，也不改前端协议。

行为对照：

| 阶段                         | 发送方式                         |
| 前 8 个传输包，或前 150ms    | 仍然一个上游 chunk 发一包        |
| 之后的连续 reasoning/content | 按时间 / 数量 / 大小合并         |
| 连续工具参数增量             | 按同样阈值合并，arguments 直接拼接 |
| 阶段切换、新工具头、finish   | 立刻 flush，不等待窗口           |
| usage-only                   | 不进入聚合，也不发给前端         |

上游常在工具参数片上带 `content=''`、`id=''`、`name=''`。这些空串是占位，
不是“同时有正文和工具”，也不能当成新工具头。解析时按字段不存在处理。

例：上游连续 20 个 content chunk。前 8 个立刻发出；后面 12 个合成 1 个传输包，
`i` 从 0 连续递增到 8，前端不会看到缺口。
"""

from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class V2ChunkAggregateConfig:
    """V2 聚合阈值。改这些数只影响发送节奏，不改变最终文本和工具参数。

    环境变量方便线上紧急回滚或调参，不必发版改代码：
    - V2_CHUNK_AGGREGATE_ENABLED
    - V2_CHUNK_DIRECT_SEND_COUNT
    - V2_CHUNK_DIRECT_SEND_WINDOW_MS
    - V2_CHUNK_FLUSH_WINDOW_MS
    - V2_CHUNK_MAX_SOURCE_CHUNKS
    - V2_CHUNK_MAX_PAYLOAD_BYTES
    """

    enabled: bool = True
    # 前 N 个传输包逐个发送，保证首屏尽快出现
    direct_send_count: int = 8
    # 流开始后的这段时间也保持逐个发送；和 direct_send_count 是“或”关系
    direct_send_window_ms: int = 150
    # 进入聚合后，缓冲超过该时间就发出
    flush_window_ms: int = 30
    # 单个传输包最多合并多少个上游 chunk
    max_source_chunks: int = 12
    # 单个传输包正文/思考/工具参数的合计大小上限
    max_payload_bytes: int = 6 * 1024

    @classmethod
    def from_env(cls) -> "V2ChunkAggregateConfig":
        return cls(
            enabled=_env_flag("V2_CHUNK_AGGREGATE_ENABLED", True),
            direct_send_count=max(0, _env_int("V2_CHUNK_DIRECT_SEND_COUNT", 8)),
            direct_send_window_ms=max(0, _env_int("V2_CHUNK_DIRECT_SEND_WINDOW_MS", 150)),
            flush_window_ms=max(1, _env_int("V2_CHUNK_FLUSH_WINDOW_MS", 30)),
            max_source_chunks=max(1, _env_int("V2_CHUNK_MAX_SOURCE_CHUNKS", 12)),
            max_payload_bytes=max(1, _env_int("V2_CHUNK_MAX_PAYLOAD_BYTES", 6 * 1024)),
        )


DEFAULT_V2_CHUNK_AGGREGATE_CONFIG = V2ChunkAggregateConfig.from_env()


class ChunkPhase(str, Enum):
    EMPTY = "empty"
    REASONING = "reasoning"
    CONTENT = "content"
    TOOL_CALL = "tool_call"
    MIXED = "mixed"


@dataclass
class IncomingToolCall:
    index: int
    id: Optional[str] = None
    type: Optional[str] = None
    name: Optional[str] = None
    label: Optional[str] = None
    arguments: str = ""

    @property
    def has_header(self) -> bool:
        return bool(self.id or self.name)


@dataclass
class IncomingChunkView:
    """单个上游 super_magic_chunk 的可合并视图。"""

    envelope: Dict[str, Any]
    choice_index: int
    role: Optional[str] = None
    content: Optional[str] = None
    reasoning_content: Optional[str] = None
    tool_calls: List[IncomingToolCall] = field(default_factory=list)
    finish_reason: Optional[str] = None
    choice_count: int = 1
    payload_bytes: int = 0

    @property
    def has_content(self) -> bool:
        # 空串在 parse 时已收成 None。这里只认真正有字的正文。
        return bool(self.content)

    @property
    def has_reasoning(self) -> bool:
        return bool(self.reasoning_content)

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)

    @property
    def has_finish_reason(self) -> bool:
        return self.finish_reason is not None

    @property
    def phase(self) -> ChunkPhase:
        flags = (self.has_reasoning, self.has_content, self.has_tool_calls)
        active = sum(1 for flag in flags if flag)
        if active > 1:
            return ChunkPhase.MIXED
        if self.has_tool_calls:
            return ChunkPhase.TOOL_CALL
        if self.has_reasoning:
            return ChunkPhase.REASONING
        if self.has_content:
            return ChunkPhase.CONTENT
        return ChunkPhase.EMPTY


def parse_incoming_chunk(chunk: Dict[str, Any]) -> IncomingChunkView:
    choices = chunk.get("choices") or []
    if not choices:
        return IncomingChunkView(envelope=chunk, choice_index=0, choice_count=0)

    # 多 choice 整包前端会忽略。这里只读第一个 choice 做聚合判断，
    # 真正发送时若 choice 多于 1 个，会原样直出，避免改协议语义。
    first = choices[0] if isinstance(choices[0], dict) else {}
    delta = first.get("delta") if isinstance(first.get("delta"), dict) else {}
    raw_tool_calls = delta.get("tool_calls") or []

    tool_calls: List[IncomingToolCall] = []
    if isinstance(raw_tool_calls, list):
        for raw in raw_tool_calls:
            if not isinstance(raw, dict):
                continue
            function = raw.get("function") if isinstance(raw.get("function"), dict) else {}
            index = raw.get("index", 0)
            try:
                tool_index = int(index)
            except (TypeError, ValueError):
                continue
            arguments = function.get("arguments")
            tool_calls.append(
                IncomingToolCall(
                    index=tool_index,
                    id=_absent_if_blank(raw.get("id")),
                    type=_absent_if_blank(raw.get("type")),
                    name=_absent_if_blank(function.get("name")),
                    label=_absent_if_blank(function.get("label")),
                    arguments="" if arguments is None else str(arguments),
                )
            )

    content = _absent_if_blank(delta.get("content")) if "content" in delta else None
    reasoning = (
        _absent_if_blank(delta.get("reasoning_content"))
        if "reasoning_content" in delta
        else None
    )
    payload = _estimate_payload_bytes(content, reasoning, tool_calls)
    try:
        choice_index = int(first.get("index", 0))
    except (TypeError, ValueError):
        choice_index = 0

    return IncomingChunkView(
        envelope=chunk,
        choice_index=choice_index,
        role=_absent_if_blank(delta.get("role")),
        content=content,
        reasoning_content=reasoning,
        tool_calls=tool_calls,
        finish_reason=first.get("finish_reason"),
        choice_count=len(choices),
        payload_bytes=payload,
    )


def _absent_if_blank(value: Any) -> Optional[str]:
    """空串和 None 当成字段不存在；单个空格仍算有效正文。

    例：DeepSeek 的工具参数增量经常是
    `content=''` + `id=''` + `name=''` + `arguments='冻土'`。
    若把空串当“有正文”或“新工具头”，每个参数片都会被判成 MIXED 并立刻发出，
    870 个上游 chunk 几乎合不成包。
    """
    if value is None:
        return None
    text = str(value)
    return text if text else None


def _estimate_payload_bytes(
    content: Optional[str],
    reasoning: Optional[str],
    tool_calls: List[IncomingToolCall],
) -> int:
    total = 0
    if content:
        total += len(content.encode("utf-8"))
    if reasoning:
        total += len(reasoning.encode("utf-8"))
    for tool_call in tool_calls:
        if tool_call.arguments:
            total += len(tool_call.arguments.encode("utf-8"))
        if tool_call.name:
            total += len(tool_call.name.encode("utf-8"))
    return total


def _clone_tool_call(tool_call: IncomingToolCall) -> IncomingToolCall:
    return IncomingToolCall(
        index=tool_call.index,
        id=tool_call.id,
        type=tool_call.type,
        name=tool_call.name,
        label=tool_call.label,
        arguments=tool_call.arguments,
    )


@dataclass
class _Buffer:
    envelope: Dict[str, Any]
    choice_index: int
    role: Optional[str] = None
    content: Optional[str] = None
    reasoning_content: Optional[str] = None
    tool_calls: Dict[int, IncomingToolCall] = field(default_factory=dict)
    finish_reason: Optional[str] = None
    source_chunk_count: int = 0
    payload_bytes: int = 0
    started_at: float = 0.0
    phase: ChunkPhase = ChunkPhase.EMPTY

    def to_view(self) -> IncomingChunkView:
        return IncomingChunkView(
            envelope=self.envelope,
            choice_index=self.choice_index,
            role=self.role,
            content=self.content,
            reasoning_content=self.reasoning_content,
            tool_calls=[self.tool_calls[index] for index in sorted(self.tool_calls)],
            finish_reason=self.finish_reason,
            choice_count=1,
            payload_bytes=self.payload_bytes,
        )


class V2ChunkAggregator:
    """把同一轮 V2 流里的上游 chunk 合成连续传输包。

    调用方每收到一个可发送的 super_magic_chunk 就调用 accept()。
    返回值是现在必须发出的传输包；空列表表示先缓着，等窗口或下次 accept/flush。
    """

    def __init__(
        self,
        config: Optional[V2ChunkAggregateConfig] = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config = config or DEFAULT_V2_CHUNK_AGGREGATE_CONFIG
        self._clock = clock
        self._buffer: Optional[_Buffer] = None
        self._stream_started_at: Optional[float] = None
        self.source_chunk_count = 0
        self.emitted_count = 0

    @property
    def has_pending(self) -> bool:
        return self._buffer is not None

    @property
    def pending_source_count(self) -> int:
        return self._buffer.source_chunk_count if self._buffer else 0

    def accept(self, chunk: Dict[str, Any], now: Optional[float] = None) -> List[Dict[str, Any]]:
        current_time = self._now(now)
        if self._stream_started_at is None:
            self._stream_started_at = current_time
        self.source_chunk_count += 1

        incoming = parse_incoming_chunk(chunk)
        if not self.config.enabled:
            return self._emit_views([incoming])

        # 多 choice 不是当前前端的有效协议，原样直出，避免聚合器 invent 新语义。
        if incoming.choice_count != 1:
            packets = self.flush(now=current_time)
            packets.extend(self._emit_views([incoming]))
            return packets

        packets: List[Dict[str, Any]] = []
        if self._buffer is not None and not self._can_merge(incoming):
            packets.extend(self.flush(now=current_time))

        if incoming.has_finish_reason:
            if self._buffer is not None and self._can_merge(incoming):
                self._merge(incoming, current_time)
                packets.extend(self.flush(now=current_time))
            else:
                packets.extend(self._emit_views([incoming]))
            return packets

        if self._buffer is None:
            self._start_buffer(incoming, current_time)
        else:
            self._merge(incoming, current_time)

        if self._should_flush_now(current_time):
            packets.extend(self.flush(now=current_time))
        return packets

    def flush(self, now: Optional[float] = None) -> List[Dict[str, Any]]:
        if self._buffer is None:
            return []
        view = self._buffer.to_view()
        self._buffer = None
        return self._emit_views([view])

    def _now(self, now: Optional[float]) -> float:
        return self._clock() if now is None else now

    def _in_direct_send_window(self, now: float) -> bool:
        if self.emitted_count < self.config.direct_send_count:
            return True
        if self._stream_started_at is None:
            return False
        elapsed_ms = (now - self._stream_started_at) * 1000
        return elapsed_ms < self.config.direct_send_window_ms

    def _should_flush_now(self, now: float) -> bool:
        if self._buffer is None:
            return False
        if self._in_direct_send_window(now):
            return True
        if self._buffer.phase == ChunkPhase.MIXED:
            return True
        if self._buffer.source_chunk_count >= self.config.max_source_chunks:
            return True
        if self._buffer.payload_bytes >= self.config.max_payload_bytes:
            return True
        return False

    def _can_merge(self, incoming: IncomingChunkView) -> bool:
        buffer = self._buffer
        if buffer is None:
            return True
        if incoming.choice_index != buffer.choice_index:
            return False
        if incoming.has_finish_reason:
            return self._same_merge_phase(buffer.phase, incoming.phase)
        if incoming.phase == ChunkPhase.MIXED or buffer.phase == ChunkPhase.MIXED:
            return False
        if not self._same_merge_phase(buffer.phase, incoming.phase):
            return False
        if incoming.phase == ChunkPhase.TOOL_CALL and self._has_new_tool_header(incoming):
            return False
        return True

    def _same_merge_phase(self, current: ChunkPhase, incoming: ChunkPhase) -> bool:
        if current == ChunkPhase.EMPTY or incoming == ChunkPhase.EMPTY:
            return True
        return current == incoming

    def _has_new_tool_header(self, incoming: IncomingChunkView) -> bool:
        if self._buffer is None:
            return False
        for tool_call in incoming.tool_calls:
            existing = self._buffer.tool_calls.get(tool_call.index)
            if existing is None:
                if tool_call.has_header:
                    return True
                continue
            if tool_call.id and existing.id and tool_call.id != existing.id:
                return True
            if tool_call.name and existing.name and tool_call.name != existing.name:
                return True
        return False

    def _start_buffer(self, incoming: IncomingChunkView, now: float) -> None:
        self._buffer = _Buffer(
            envelope=dict(incoming.envelope),
            choice_index=incoming.choice_index,
            role=incoming.role,
            content=incoming.content,
            reasoning_content=incoming.reasoning_content,
            tool_calls={item.index: _clone_tool_call(item) for item in incoming.tool_calls},
            finish_reason=incoming.finish_reason,
            source_chunk_count=1,
            payload_bytes=incoming.payload_bytes,
            started_at=now,
            phase=incoming.phase,
        )

    def _merge(self, incoming: IncomingChunkView, now: float) -> None:
        buffer = self._buffer
        if buffer is None:
            self._start_buffer(incoming, now)
            return
        if incoming.role and not buffer.role:
            buffer.role = incoming.role
        if incoming.has_content:
            buffer.content = (buffer.content or "") + (incoming.content or "")
        if incoming.has_reasoning:
            buffer.reasoning_content = (buffer.reasoning_content or "") + (incoming.reasoning_content or "")
        for tool_call in incoming.tool_calls:
            existing = buffer.tool_calls.get(tool_call.index)
            if existing is None:
                buffer.tool_calls[tool_call.index] = _clone_tool_call(tool_call)
                continue
            if tool_call.id and not existing.id:
                existing.id = tool_call.id
            if tool_call.type and not existing.type:
                existing.type = tool_call.type
            if tool_call.name and not existing.name:
                existing.name = tool_call.name
            if tool_call.label and not existing.label:
                existing.label = tool_call.label
            existing.arguments += tool_call.arguments
        if incoming.has_finish_reason:
            buffer.finish_reason = incoming.finish_reason
        buffer.source_chunk_count += 1
        buffer.payload_bytes += incoming.payload_bytes
        if buffer.phase == ChunkPhase.EMPTY:
            buffer.phase = incoming.phase
        elif incoming.phase != ChunkPhase.EMPTY and incoming.phase != buffer.phase:
            buffer.phase = ChunkPhase.MIXED

    def _emit_views(self, views: List[IncomingChunkView]) -> List[Dict[str, Any]]:
        packets: List[Dict[str, Any]] = []
        for view in views:
            packets.append(self._to_super_magic_chunk(view, self.emitted_count))
            self.emitted_count += 1
        return packets

    def _to_super_magic_chunk(self, view: IncomingChunkView, transport_index: int) -> Dict[str, Any]:
        if view.choice_count != 1:
            packet = dict(view.envelope)
            packet["i"] = transport_index
            packet["usage"] = None
            return packet

        delta: Dict[str, Any] = {}
        if view.role:
            delta["role"] = view.role
        if view.content is not None:
            delta["content"] = view.content
        if view.reasoning_content is not None:
            delta["reasoning_content"] = view.reasoning_content
        if view.tool_calls:
            delta["tool_calls"] = [self._tool_call_to_dict(item) for item in view.tool_calls]

        packet = dict(view.envelope)
        packet["i"] = transport_index
        packet["usage"] = None
        packet["choices"] = [
            {
                "finish_reason": view.finish_reason,
                "index": view.choice_index,
                "logprobs": None,
                "delta": delta,
            }
        ]
        return packet

    @staticmethod
    def _tool_call_to_dict(tool_call: IncomingToolCall) -> Dict[str, Any]:
        item: Dict[str, Any] = {"index": tool_call.index}
        if tool_call.id is not None:
            item["id"] = tool_call.id
        if tool_call.type is not None:
            item["type"] = tool_call.type
        function: Dict[str, Any] = {}
        if tool_call.name is not None:
            function["name"] = tool_call.name
        if tool_call.label:
            function["label"] = tool_call.label
        if tool_call.arguments:
            function["arguments"] = tool_call.arguments
        if function:
            item["function"] = function
        return item


PushChunkCallback = Callable[[Dict[str, Any], int], Awaitable[None]]


class V2ChunkTransport:
    """给一轮 V2 流使用的发送出口：聚合、分配连续 i、按窗口补发、结束时冲刷。"""

    def __init__(
        self,
        push_chunk: PushChunkCallback,
        request_id: str,
        config: Optional[V2ChunkAggregateConfig] = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._push_chunk = push_chunk
        self._request_id = request_id
        self._config = config or DEFAULT_V2_CHUNK_AGGREGATE_CONFIG
        self._sleep = sleep
        self._aggregator = V2ChunkAggregator(config=self._config)
        self._lock = asyncio.Lock()
        self._generation = 0
        self._sleep_task: Optional[asyncio.Task[None]] = None
        self._flush_task: Optional[asyncio.Task[None]] = None
        self._closed = False

    @property
    def emitted_count(self) -> int:
        return self._aggregator.emitted_count

    @property
    def source_chunk_count(self) -> int:
        return self._aggregator.source_chunk_count

    async def accept(self, chunk: Dict[str, Any]) -> None:
        async with self._lock:
            if self._closed:
                return
            packets = self._aggregator.accept(chunk)
            await self._emit(packets)
            self._arm_flush_timer()

    async def close(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            self._generation += 1
            await self._cancel_sleep()
            packets = self._aggregator.flush()
            await self._emit(packets)
            if self.source_chunk_count or self.emitted_count:
                logger.info(self._format_aggregate_summary())

        flush_task = self._flush_task
        if flush_task and not flush_task.done():
            flush_task.cancel()
            try:
                await flush_task
            except asyncio.CancelledError:
                pass

    async def _emit(self, packets: List[Dict[str, Any]]) -> None:
        for packet in packets:
            await self._push_chunk(packet, packet["i"])

    def _arm_flush_timer(self) -> None:
        self._generation += 1
        generation = self._generation
        if self._sleep_task and not self._sleep_task.done():
            self._sleep_task.cancel()
            self._sleep_task = None
        if self._closed or not self._aggregator.has_pending:
            return

        window_seconds = self._config.flush_window_ms / 1000
        sleep_task = asyncio.create_task(
            self._sleep(window_seconds),
            name=f"v2_chunk_flush_sleep_{self._request_id}",
        )
        self._sleep_task = sleep_task
        self._flush_task = asyncio.create_task(
            self._delayed_flush(generation, sleep_task),
            name=f"v2_chunk_flush_{self._request_id}",
        )

    async def _delayed_flush(
        self,
        generation: int,
        sleep_task: asyncio.Task[None],
    ) -> None:
        try:
            await sleep_task
        except asyncio.CancelledError:
            return

        async with self._lock:
            if self._closed or generation != self._generation:
                return
            packets = self._aggregator.flush()
            await self._emit(packets)

    async def _cancel_sleep(self) -> None:
        sleep_task = self._sleep_task
        self._sleep_task = None
        if sleep_task is None or sleep_task.done():
            return
        sleep_task.cancel()
        try:
            await sleep_task
        except asyncio.CancelledError:
            pass

    def _format_aggregate_summary(self) -> str:
        upstream = self.source_chunk_count
        emitted = self.emitted_count
        if upstream > 0 and emitted < upstream:
            reduced = (1 - emitted / upstream) * 100
            reduction = f", 减少 {reduced:.1f}%"
        else:
            reduction = ""
        return (
            f"[{self._request_id}] V2 chunk 聚合: "
            f"上游 {upstream} 个, 整合后 {emitted} 个{reduction}, "
            f"enabled={self._config.enabled}"
        )
