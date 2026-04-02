"""
LarkStreamingDriver — per-token 流式推送到飞书 CardKit。

与 WeComStreamingDriver / DingTalkStreamingDriver 相同的 asyncio.Event 节流：
push() 非阻塞，仅更新 _accumulated + 设置事件；
_send_loop 等待事件，调用 CardKit element.content API。

最终的 close streaming + update final card 由 LarkStream 在 after_main_agent_run 处理。
"""
import asyncio
import time
import uuid
from typing import Optional, TYPE_CHECKING

from agentlang.logger import get_logger
from agentlang.streaming.interface import StreamingInterface
from agentlang.streaming.models import ChunkData, ChunkStatus, StreamingResult
from app.channel.base.reasoning import build_streaming_content_text, build_streaming_reasoning_text
from app.channel.config import IMChannelDisplay

if TYPE_CHECKING:
    import lark_oapi as lark

logger = get_logger(__name__)

STREAMING_ELEMENT_ID = "streaming_content"
CARDKIT_RATE_LIMIT_CODE = 230020  # 飞书 CardKit 限频错误码


class LarkStreamingDriver(StreamingInterface):
    """Per-token LLM streaming to Lark via CardKit element.content API.

    Same asyncio.Event throttle pattern as WeComStreamingDriver/DingTalkStreamingDriver.
    push() is non-blocking: updates _accumulated + sets event.
    _send_loop coalesces rapid tokens and sends latest accumulated text.

    Exposes `sequence` property so LarkStream can read the current sequence
    counter when finalizing the card without double-counting.
    """

    def __init__(
        self,
        sdk_client: "lark.Client",
        card_id: str,
        display: IMChannelDisplay | None = None,
    ) -> None:
        self._client = sdk_client
        self._card_id = card_id
        self._display = display or IMChannelDisplay()
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time: Optional[float] = None
        self._reasoning_last_active_time: Optional[float] = None
        self._reasoning_elapsed_ms: int = 0
        self._sequence = 2  # CardKit 序列号（创建卡片时已消耗 1）
        self._has_new: Optional[asyncio.Event] = None
        self._worker: Optional[asyncio.Task] = None

    async def initialize(self) -> StreamingResult:
        self._accumulated = ""
        self._reasoning_accumulated = ""
        self._reasoning_start_time = None
        self._reasoning_last_active_time = None
        self._reasoning_elapsed_ms = 0
        self._sequence = 2
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
        # show_reasoning=False 时只推送正文，思考阶段保持静默直到 content 出现。
        if self._accumulated:
            if self._reasoning_accumulated and self._display.show_reasoning:
                return build_streaming_content_text(
                    self._accumulated,
                    self._reasoning_accumulated,
                    self._reasoning_elapsed_ms,
                )
            return self._accumulated
        if self._reasoning_accumulated and self._display.show_reasoning:
            return build_streaming_reasoning_text(self._reasoning_accumulated)
        return ""

    async def _send_loop(self) -> None:
        from lark_oapi.api.cardkit.v1.model import (
            ContentCardElementRequest,
            ContentCardElementRequestBody,
        )

        assert self._has_new is not None
        while True:
            await self._has_new.wait()
            self._has_new.clear()
            text = self._build_display_text()
            if not text:
                continue
            try:
                req = (
                    ContentCardElementRequest.builder()
                    .card_id(self._card_id)
                    .element_id(STREAMING_ELEMENT_ID)
                    .request_body(
                        ContentCardElementRequestBody.builder()
                        .uuid(uuid.uuid4().hex)
                        .content(text)
                        .sequence(self._sequence)
                        .build()
                    )
                    .build()
                )
                resp = await self._client.cardkit.v1.card_element.acontent(req)
                if not resp.success():
                    if resp.code == CARDKIT_RATE_LIMIT_CODE:
                        logger.debug(f"[LarkStreamingDriver] rate limited (230020), skip seq={self._sequence}")
                    else:
                        logger.warning(
                            f"[LarkStreamingDriver] element.content 失败: code={resp.code}, msg={resp.msg}"
                        )
                self._sequence += 1
            except Exception as e:
                logger.warning(f"[LarkStreamingDriver] element.content 异常: {e}")

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
        return self._client is not None

    def get_driver_name(self) -> str:
        return "lark"

    @property
    def last_content(self) -> str:
        return self._accumulated

    @property
    def reasoning_accumulated(self) -> str:
        return self._reasoning_accumulated

    @property
    def reasoning_elapsed_ms(self) -> int:
        return self._reasoning_elapsed_ms

    @property
    def sequence(self) -> int:
        """当前 CardKit 序列号，供 LarkStream 在完成时读取以保持连续。"""
        return self._sequence
