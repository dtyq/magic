"""
WaitWechatLogin — 等待微信官方 ClawBot 扫码结果的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk/tool/call 调用。
"""
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.channel.config import (
    DEFAULT_WECHAT_CDN_BASE_URL,
    WechatCredential,
    load_config,
    save_config,
)
from app.channel.wechat.login import WechatLoginManager, WechatLoginOutcome
from app.channel.wechat.channel import WechatChannel
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class WaitWechatLoginParams(BaseToolParams):
    timeout_seconds: int = Field(
        default=300,
        description="Maximum seconds to wait for QR confirmation. Defaults to 300.",
    )


@tool(code_mode_only=True)
class WaitWechatLogin(BaseTool[WaitWechatLoginParams]):
    """Wait for the WeChat QR login result from an SDK snippet."""

    def is_visible_in_context(self, agent_context: "AgentContext") -> bool:
        return agent_context.is_interactive_main_agent_context()

    async def check_execution_permission(
        self,
        tool_context: ToolContext,
        params: WaitWechatLoginParams,
    ) -> Optional[ToolResult]:
        agent_context = tool_context.get_extension("agent_context")
        if agent_context is not None and agent_context.is_interactive_main_agent_context():
            return None

        return ToolResult.error(
            "This tool cannot be used from a sub-agent or non-interactive context. "
            "Ask the parent agent to handle the WeChat login flow instead."
        )

    async def execute(self, tool_context: ToolContext, params: WaitWechatLoginParams) -> ToolResult:
        try:
            outcome = await WechatLoginManager.get_instance().wait_for_outcome(
                timeout_seconds=params.timeout_seconds
            )
            if outcome.requires_qr_render:
                return ToolResult(content=_build_qr_refresh_message(outcome.qrcode_content))
            if outcome.success:
                await self._activate_channel(outcome, tool_context.topic_id)
            return ToolResult(content=outcome.message)
        except Exception as e:
            logger.error(f"[WaitWechatLogin] wait_for_outcome failed: {e}")
            return ToolResult.error(f"WeChat login wait failed: {e}")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate(self.name, category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate(
                    "channel.wait_wechat_login.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.wait_wechat_login.success",
                category="tool.messages",
            ),
        }

    async def _activate_channel(self, outcome: WechatLoginOutcome, topic_id: str) -> None:
        """扫码成功后保存凭据并启动 WechatChannel。"""
        if outcome.result is None:
            raise RuntimeError("The WeChat login succeeded, but the result payload is missing.")
        if not topic_id:
            raise RuntimeError("The WeChat login succeeded, but the current topic ID is missing.")

        result = outcome.result
        config = await load_config()
        existing_cdn_base_url = (
            config.wechat.cdn_base_url if config.wechat else DEFAULT_WECHAT_CDN_BASE_URL
        )
        config.wechat = WechatCredential(
            bot_token=result.bot_token,
            ilink_bot_id=result.ilink_bot_id,
            base_url=result.base_url,
            cdn_base_url=existing_cdn_base_url,
            ilink_user_id=result.ilink_user_id,
            topic_id=topic_id,
        )
        await save_config(config)
        logger.info("[WaitWechatLogin] WeChat credentials saved")

        channel = WechatChannel.get_instance()
        await channel.connect(config.wechat)


def _build_qr_refresh_message(qrcode_url: str) -> str:
    return "\n".join([
        "The previous QR code expired. Output the updated content below as your reply "
        "(no extra prose), adapting the heading and description to user preferred language, "
        "and include another `wait_wechat_login` call in the same reply. "
        "Do not end your turn after showing the QR — the user's scan would go unanswered.",
        "",
        "---",
        "",
        "### 连接 🦞 MagiClaw 到微信",
        "",
        "请使用微信扫一扫链接 MagiClaw",
        "",
        "```qrcode",
        qrcode_url,
        "```",
    ])
