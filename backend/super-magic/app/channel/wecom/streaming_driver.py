import asyncio
import time
from typing import Optional

from agentlang.logger import get_logger
from agentlang.streaming.interface import StreamingInterface
from agentlang.streaming.models import ChunkData, ChunkStatus, StreamingResult

from app.channel.base.reasoning import build_streaming_content_text, build_streaming_reasoning_text

logger = get_logger(__name__)


class WeComStreamingDriver(StreamingInterface):
    """Per-token LLM streaming to WeCom via reply_stream(finish=False).

    push() is non-blocking: it only updates state and sets an asyncio.Event.
    A single background coroutine (_send_loop) waits on that event and sends the
    latest display text. Because WeCom's ACK round-trip (~250ms) naturally
    blocks the next send, rapid tokens are automatically batched — no artificial
    sleep or throttle needed.

    During reasoning phase, _build_display_text() returns the thinking blockquote.
    Once content starts, it returns the answer text instead.

    The final reply_stream(finish=True) is sent by WeComStream on
    after_main_agent_run so multi-LLM-call agents don't close the bubble early.
    """

    def __init__(self, ws_client, frame: dict, stream_id: str) -> None:
        self._ws_client = ws_client
        self._frame = frame
        self._stream_id = stream_id
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time: Optional[float] = None
        self._reasoning_last_active_time: Optional[float] = None
        self._reasoning_elapsed_ms: int = 0
        self._has_new: Optional[asyncio.Event] = None
        self._worker: Optional[asyncio.Task] = None

    async def initialize(self) -> StreamingResult:
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time = None
        self._reasoning_last_active_time = None
        self._reasoning_elapsed_ms = 0
        self._has_new = asyncio.Event()
        self._worker = asyncio.create_task(self._send_loop())
        return StreamingResult(success=True)

    def _start_reasoning_timing(self) -> None:
        # 以 reasoning 真正开始时刻作为计时起点，避免只依赖状态切换导致耗时丢失。
        now = time.monotonic()
        self._reasoning_start_time = now
        self._reasoning_last_active_time = now
        self._reasoning_elapsed_ms = 0

    def _touch_reasoning_timing(self) -> None:
        # 部分模型不会稳定发送 reasoning start，收到首个非空 chunk 时也要能开始计时。
        now = time.monotonic()
        if self._reasoning_start_time is None:
            self._reasoning_start_time = now
        self._reasoning_last_active_time = now

    def _finish_reasoning_timing(self, end_time: Optional[float] = None) -> None:
        if self._reasoning_start_time is None:
            return
        resolved_end_time = max(self._reasoning_last_active_time or 0.0, end_time or time.monotonic())
        elapsed_ms = max(1, int((resolved_end_time - self._reasoning_start_time) * 1000))
        self._reasoning_elapsed_ms = max(self._reasoning_elapsed_ms, elapsed_ms)
        self._reasoning_start_time = None
        self._reasoning_last_active_time = None

    def _build_display_text(self) -> str:
        # 覆盖式流更新必须始终带上思考块，否则进入 content 阶段时会把前文冲掉。
        if self._accumulated and self._reasoning_accumulated:
            return build_streaming_content_text(
                self._accumulated,
                self._reasoning_accumulated,
                self._reasoning_elapsed_ms,
            )
        if self._accumulated:
            return self._accumulated
        if self._reasoning_accumulated:
            return build_streaming_reasoning_text(self._reasoning_accumulated)
        return ""

    async def _send_loop(self) -> None:
        """Wait for new content, send latest display text, repeat.

        The WeCom ACK round-trip (~250ms) acts as a natural throttle:
        rapid tokens pile up while waiting, then go out as one update.
        """
        assert self._has_new is not None
        while True:
            await self._has_new.wait()
            self._has_new.clear()
            text = self._build_display_text()
            if not text:
                continue
            try:
                await self._ws_client.reply_stream(self._frame, self._stream_id, text, False)
            except Exception as e:
                logger.warning(f"[WeComStreamingDriver] reply_stream failed: {e}")

    async def push(self, chunk_data: ChunkData) -> StreamingResult:
        if not chunk_data.metadata:
            return StreamingResult(success=True)

        ct = chunk_data.metadata.content_type
        status = chunk_data.delta.status if chunk_data.delta else None

        if ct == "reasoning":
            if status == ChunkStatus.START:
                self._reasoning_accumulated = ""
                self._start_reasoning_timing()
            elif status == ChunkStatus.STREAMING and chunk_data.content:
                self._touch_reasoning_timing()
                self._reasoning_accumulated += chunk_data.content
                if self._has_new is not None:
                    self._has_new.set()
            elif status == ChunkStatus.END:
                # 流结束消息会携带 reasoning 权威全文，进入 content 阶段前先对齐，避免思考块缺字。
                if chunk_data.is_final and chunk_data.content:
                    self._reasoning_accumulated = chunk_data.content
                self._finish_reasoning_timing(time.monotonic())
        elif ct == "content":
            if status == ChunkStatus.START:
                # 推理阶段结束，记录耗时
                self._finish_reasoning_timing(time.monotonic())
                self._accumulated = ""
            elif status == ChunkStatus.STREAMING and chunk_data.content:
                self._accumulated += chunk_data.content
                if self._has_new is not None:
                    self._has_new.set()
            elif status == ChunkStatus.END and chunk_data.is_final and chunk_data.content:
                # 以 LLM 权威全文同步累计值
                self._accumulated = chunk_data.content

        return StreamingResult(success=True)

    async def finalize(self) -> StreamingResult:
        # 若推理阶段异常未收到 content reset，补记耗时
        self._finish_reasoning_timing(time.monotonic())
        if self._worker and not self._worker.done():
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
        self._worker = None
        return StreamingResult(success=True)

    async def is_available(self) -> bool:
        return self._ws_client is not None

    def get_driver_name(self) -> str:
        return "wecom"

    @property
    def last_content(self) -> str:
        return self._accumulated

    @property
    def reasoning_accumulated(self) -> str:
        return self._reasoning_accumulated

    @property
    def reasoning_elapsed_ms(self) -> int:
        return self._reasoning_elapsed_ms
