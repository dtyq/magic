"""
WaitWechatLogin — 等待微信官方 ClawBot 扫码结果的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.channel.config import WechatCredential, load_config, save_config
from app.channel.wechat import login as wechat_login
from app.channel.wechat.channel import WechatChannel
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class WaitWechatLoginParams(BaseToolParams):
    timeout_seconds: int = Field(
        default=60,
        description="""<!--zh: 等待扫码完成的最长秒数，默认 60 秒-->
Maximum seconds to wait for the QR confirmation. Defaults to 60.""",
    )


@tool()
class WaitWechatLogin(BaseTool[WaitWechatLoginParams]):
    """<!--zh
    等待微信扫码登录结果。仅供 Skill snippet 调用，不挂载到 LLM。
    -->
    Wait for the WeChat QR login result. Intended for skill snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: WaitWechatLoginParams) -> ToolResult:
        try:
            outcome = await wechat_login.wait_for_login(params.timeout_seconds)
            if outcome.requires_qr_render:
                return ToolResult(content=_build_qr_refresh_message(outcome.qrcode_js_string_literal()))
            if outcome.success:
                await self._activate_channel(outcome, tool_context.sandbox_id)
            return ToolResult(content=outcome.message)
        except Exception as e:
            logger.error(f"[WaitWechatLogin] 等待登录结果失败: {e}")
            return ToolResult.error(f"WeChat login wait failed: {e}")

    async def _activate_channel(self, outcome: wechat_login.WechatLoginOutcome, sandbox_id: str) -> None:
        """扫码成功后保存凭据并启动 WechatChannel。"""
        if outcome.result is None:
            raise RuntimeError("The WeChat login succeeded, but the result payload is missing.")

        result = outcome.result
        config = await load_config()
        config.wechat = WechatCredential(
            bot_token=result.bot_token,
            ilink_bot_id=result.ilink_bot_id,
            base_url=result.base_url,
            ilink_user_id=result.ilink_user_id,
            sandbox_id=sandbox_id,
        )
        await save_config(config)
        logger.info("[WaitWechatLogin] 微信凭据已保存")

        channel = WechatChannel.get_instance()
        await channel.connect(config.wechat)


def _build_qr_refresh_message(qrcode_js_string_literal: str) -> str:
    return "\n".join(
        [
            "The previous WeChat QR code expired and a fresh one is ready.",
            "You must do two things now:",
            "1. Use the WeChat QR HTML template from the current skill again and replace "
            "`{{QRCODE_JS_STRING_LITERAL}}` with the exact literal below.",
            "2. Reply to the user with raw HTML only, without Markdown code fences or extra prose, and "
            "then immediately call `wait_wechat_login` again.",
            "",
            "Exact JavaScript string literal:",
            qrcode_js_string_literal,
        ]
    )
