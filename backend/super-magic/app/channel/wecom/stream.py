"""
WeComStream — 侦听 agent 事件流，在整个 agent run 结束时向企微发送 finish=True。

per-token 流式推送（reply_stream finish=False）由 WeComStreamingDriver 负责。
此类仅做两件事：
  1. 从 after_agent_reply 事件中捕获完整内容（非流式模型兜底）
  2. after_main_agent_run 时用 build_final_message 拼接推理块 + answer 后发送
"""
import json
from typing import TYPE_CHECKING, Optional

from agentlang.logger import get_logger
from app.channel.base.reasoning import build_final_message
from app.core.stream import Stream

if TYPE_CHECKING:
    from app.channel.wecom.streaming_driver import WeComStreamingDriver

logger = get_logger(__name__)


class WeComStream(Stream):
    def __init__(self, ws_client, frame: dict, stream_id: str, driver: "WeComStreamingDriver") -> None:
        super().__init__()
        self._ws_client = ws_client
        self._frame = frame
        self._stream_id = stream_id
        self._driver = driver
        self._finished = False
        self._last_content = ""

    async def write(self, data: str, data_type: str = "json") -> int:
        if self._finished:
            return 0
        try:
            msg = json.loads(data)
            payload = msg.get("payload", {})
            event = payload.get("event", "")

            # 捕获最终内容（非流式模型兜底；流式场景此值与 streaming driver 累计值相同）
            if payload.get("type") == "agent_reply" and payload.get("content_type") == "content":
                content = payload.get("content", "")
                if content:
                    self._last_content = content

            # agent run 彻底结束，关闭企微消息气泡
            elif event == "after_main_agent_run":
                self._finished = True
                final_text = build_final_message(
                    self._last_content,
                    self._driver.reasoning_accumulated,
                    self._driver.reasoning_elapsed_ms,
                )
                await self._ws_client.reply_stream(self._frame, self._stream_id, final_text, True)

        except Exception as e:
            logger.error(f"[WeComStream] write 失败: {e}")
        return len(data)

    def read(self, size: Optional[int] = None) -> str:
        raise NotImplementedError("WeComStream is write-only")
