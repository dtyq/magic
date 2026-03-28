"""
LarkStream — 侦听 agent 事件，在整个 agent run 结束时完成飞书 CardKit 卡片。

per-token 流式推送（element.content）由 LarkStreamingDriver 负责。
此类仅做两件事：
  1. 从 after_agent_reply 事件捕获完整内容（非流式模型兜底）
  2. after_main_agent_run 时执行结束序列：
     card.asettings(streaming_mode=false) → 关闭流式通道
     card.aupdate(最终卡片 JSON)         → 切换完成状态
"""
import json
from typing import Optional, TYPE_CHECKING

from agentlang.logger import get_logger
from app.core.stream import Stream

if TYPE_CHECKING:
    import lark_oapi as lark
    from app.channel.lark.streaming_driver import LarkStreamingDriver

logger = get_logger(__name__)


def _build_final_card(answer: str, reasoning: str = "", elapsed_ms: int = 0) -> dict:
    """构建流式结束后的最终卡片 JSON。有推理内容时在正文前插入折叠面板。"""
    from app.channel.base.reasoning import format_elapsed

    elements = []
    if reasoning:
        dur = format_elapsed(elapsed_ms)
        elements.append({
            "tag": "collapsible_panel",
            "expanded": False,
            "header": {
                "title": {
                    "tag": "markdown",
                    "content": f"💭 思考了 {dur}",
                    "i18n_content": {"zh_cn": f"💭 思考了 {dur}", "en_us": f"💭 Thought for {dur}"},
                },
                "vertical_align": "center",
                "icon": {"tag": "standard_icon", "token": "down-small-ccm_outlined", "size": "16px 16px"},
                "icon_position": "follow_text",
                "icon_expanded_angle": -180,
            },
            "border": {"color": "grey", "corner_radius": "5px"},
            "vertical_spacing": "8px",
            "padding": "8px 8px 8px 8px",
            "elements": [{"tag": "markdown", "content": f"\n{reasoning}", "text_size": "notation"}],
        })
    elements.append({"tag": "markdown", "content": answer or "(无内容)"})
    return {"schema": "2.0", "body": {"elements": elements}}


class LarkStream(Stream):
    def __init__(
        self,
        sdk_client: "lark.Client",
        card_id: str,
        driver: "LarkStreamingDriver",
    ) -> None:
        super().__init__()
        self._client = sdk_client
        self._card_id = card_id
        self._driver = driver  # 共享 sequence 计数器，确保序列号连续
        self._finished = False
        self._last_content = ""
        self._last_reasoning = ""

    async def write(self, data: str, data_type: str = "json") -> int:
        if self._finished:
            return 0
        try:
            msg = json.loads(data)
            payload = msg.get("payload", {})
            event = payload.get("event", "")

            # 捕获最终内容（非流式模型兜底；流式场景此值与 driver 累计值相同）
            if payload.get("type") == "agent_reply" and payload.get("content_type") == "content":
                content = payload.get("content", "")
                if content:
                    self._last_content = content
            elif payload.get("type") == "agent_reply" and payload.get("content_type") == "reasoning":
                content = payload.get("content", "")
                if content:
                    self._last_reasoning = content  # 非流式模型兜底

            elif event == "after_main_agent_run":
                self._finished = True
                reasoning = self._driver.reasoning_accumulated or self._last_reasoning
                await self._finish_card(
                    self._last_content,
                    reasoning,
                    self._driver.reasoning_elapsed_ms,
                )

        except Exception as e:
            logger.error(f"[LarkStream] write 失败: {e}")
        return len(data)

    async def _finish_card(self, content: str, reasoning: str = "", elapsed_ms: int = 0) -> None:
        """关闭流式通道并更新最终卡片。

        序列：先停止 driver 的 send_loop 冻结序列号，再 asettings(streaming_mode=false) → aupdate(最终卡片)。
        _send_loop 可能正在 await acontent()，此时 _sequence 尚未 +1，若直接读会拿到旧值导致
        asettings 序列号冲突（code=300317 sequence number compare failed）。
        finalize() 是幂等的，在此调用不影响外部再次调用的安全性。
        """
        from lark_oapi.api.cardkit.v1.model import (
            SettingsCardRequest,
            SettingsCardRequestBody,
            UpdateCardRequest,
            UpdateCardRequestBody,
            Card as CardkitCard,
        )

        # 停止 send_loop，确保 _sequence 不再变化后再读取
        await self._driver.finalize()
        seq = self._driver.sequence

        # 1. 关闭流式模式（streaming_mode=false），解锁卡片交互
        try:
            req = (
                SettingsCardRequest.builder()
                .card_id(self._card_id)
                .request_body(
                    SettingsCardRequestBody.builder()
                    .settings(json.dumps({"streaming_mode": False}))
                    .sequence(seq)
                    .build()
                )
                .build()
            )
            resp = await self._client.cardkit.v1.card.asettings(req)
            if not resp.success():
                logger.warning(f"[LarkStream] asettings 失败: code={resp.code}, msg={resp.msg}")
            seq += 1
        except Exception as e:
            logger.warning(f"[LarkStream] asettings 异常: {e}")
            seq += 1

        # 2. 更新最终卡片内容（去掉 streaming_mode 配置，渲染正式内容）
        try:
            final_card = _build_final_card(content, reasoning, elapsed_ms)
            req = (
                UpdateCardRequest.builder()
                .card_id(self._card_id)
                .request_body(
                    UpdateCardRequestBody.builder()
                    .card(
                        CardkitCard.builder()
                        .type("card_json")
                        .data(json.dumps(final_card, ensure_ascii=False))
                        .build()
                    )
                    .sequence(seq)
                    .build()
                )
                .build()
            )
            resp = await self._client.cardkit.v1.card.aupdate(req)
            if not resp.success():
                logger.warning(f"[LarkStream] aupdate 失败: code={resp.code}, msg={resp.msg}")
        except Exception as e:
            logger.warning(f"[LarkStream] aupdate 异常: {e}")

    def read(self, size: Optional[int] = None) -> str:
        raise NotImplementedError("LarkStream is write-only")
