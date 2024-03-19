import asyncio
import time
from typing import Optional

from dingtalk_stream.card_instance import AIMarkdownCardInstance
from dingtalk_stream.card_replier import AICardStatus

from agentlang.logger import get_logger
from agentlang.streaming.interface import StreamingInterface
from agentlang.streaming.models import ChunkData, ChunkStatus, StreamingResult

from app.channel.base.reasoning import build_streaming_content_text_plain, build_streaming_reasoning_text_plain

logger = get_logger(__name__)


class DingTalkStreamingDriver(StreamingInterface):
    """Per-token LLM streaming to DingTalk via AI Card streaming API.

    Same asyncio.Event throttle pattern as WeComStreamingDriver.
    push() is non-blocking: updates _accumulated + sets event.
    _send_loop handles INPUTING state transition on first send,
    then calls async_streaming for subsequent token batches.

    During reasoning phase, _build_display_text() returns the thinking blockquote.
    Once content starts, it returns the answer text instead.

    Final streaming(isFinalize=True) + put_card_data(FINISHED) is handled
    by DingTalkStream on after_main_agent_run.
    """

    def __init__(self, card: AIMarkdownCardInstance, card_instance_id: str) -> None:
        self._card = card
        self._card_instance_id = card_instance_id
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time: Optional[float] = None
        self._reasoning_last_active_time: Optional[float] = None
        self._reasoning_elapsed_ms: int = 0
        self._has_new: Optional[asyncio.Event] = None
        self._worker: Optional[asyncio.Task] = None
        self._inputing_started = False
        self._content_started = False

    async def initialize(self) -> StreamingResult:
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time = None
        self._reasoning_last_active_time = None
        self._reasoning_elapsed_ms = 0
        self._inputing_started = False
        self._content_started = False
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
            return build_streaming_content_text_plain(
                self._accumulated,
                self._reasoning_accumulated,
                self._reasoning_elapsed_ms,
            )
        if self._accumulated:
            return self._accumulated
        if self._reasoning_accumulated:
            return build_streaming_reasoning_text_plain(self._reasoning_accumulated)
        return ""

    async def _send_loop(self) -> None:
        assert self._has_new is not None
        while True:
            await self._has_new.wait()
            self._has_new.clear()
            text = self._build_display_text()
            if not text:
                continue
            try:
                # 钉钉卡片需要先进入 INPUTING，reasoning 流才会实时显示，而不是最终一次性出现。
                if not self._inputing_started:
                    await self._card.async_put_card_data(
                        self._card_instance_id,
                        self._card.get_card_data(AICardStatus.INPUTING),
                    )
                    self._inputing_started = True

                await self._card.async_streaming(
                    self._card_instance_id, "msgContent",
                    text, append=False, finished=False, failed=False,
                )
            except Exception as e:
                logger.warning(f"[DingTalkStreamingDriver] streaming failed: {e}")

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
                self._finish_reasoning_timing(time.monotonic())
                self._accumulated = ""
                self._content_started = True
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
        return self._card is not None

    def get_driver_name(self) -> str:
        return "dingtalk"

    @property
    def last_content(self) -> str:
        return self._accumulated

    @property
    def reasoning_accumulated(self) -> str:
        return self._reasoning_accumulated

    @property
    def reasoning_elapsed_ms(self) -> int:
        return self._reasoning_elapsed_ms
