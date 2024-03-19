"""
DingTalkStream — 侦听 agent 事件流，在整个 agent run 结束时完成钉钉 AI 卡片。

per-token 流式推送（async_streaming finished=False）由 DingTalkStreamingDriver 负责。
此类仅做两件事：
  1. 从 after_agent_reply 事件中捕获完整内容（非流式模型兜底）
  2. after_main_agent_run 时执行完整结束序列：
     streaming(isFinalize=True) → 关闭流式通道
     put_card_data(FINISHED)   → 切换卡片完成状态
"""
import json
from typing import TYPE_CHECKING, Optional

from dingtalk_stream.card_instance import AIMarkdownCardInstance
from dingtalk_stream.card_replier import AICardStatus

from agentlang.logger import get_logger
from app.channel.base.reasoning import build_final_message_plain
from app.core.stream import Stream

if TYPE_CHECKING:
    from app.channel.dingtalk.streaming_driver import DingTalkStreamingDriver

logger = get_logger(__name__)


class DingTalkStream(Stream):
    def __init__(
        self,
        card: AIMarkdownCardInstance,
        card_instance_id: str,
        driver: "DingTalkStreamingDriver",
    ) -> None:
        super().__init__()
        self._card = card
        self._card_instance_id = card_instance_id
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

            elif event == "after_main_agent_run":
                self._finished = True
                final = build_final_message_plain(
                    self._last_content,
                    self._driver.reasoning_accumulated,
                    self._driver.reasoning_elapsed_ms,
                )
                await self._finish_card(final)

        except Exception as e:
            logger.error(f"[DingTalkStream] write 失败: {e}")
        return len(data)

    async def _finish_card(self, content: str) -> None:
        """执行与 TS finishAICard 一致的结束序列。"""
        try:
            # 1. streaming(isFinalize=True) 关闭流式通道，确保最终内容渲染
            await self._card.async_streaming(
                self._card_instance_id, "msgContent",
                content, append=False, finished=True, failed=False,
            )
        except Exception as e:
            logger.warning(f"[DingTalkStream] streaming(isFinalize=True) 失败: {e}")

        try:
            # 2. 更新卡片状态为 FINISHED
            self._card.markdown = content
            await self._card.async_put_card_data(
                self._card_instance_id,
                self._card.get_card_data(AICardStatus.FINISHED),
            )
        except Exception as e:
            logger.warning(f"[DingTalkStream] put_card_data(FINISHED) 失败: {e}")

    def read(self, size: Optional[int] = None) -> str:
        raise NotImplementedError("DingTalkStream is write-only")
