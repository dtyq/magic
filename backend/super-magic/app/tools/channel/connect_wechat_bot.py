"""
ConnectWechatBot — 发起微信官方 ClawBot 扫码登录的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.channel.wechat import login as wechat_login
from app.tools.core import BaseTool, BaseToolParams, tool

logger = get_logger(__name__)


class ConnectWechatBotParams(BaseToolParams):
    force_refresh: bool = Field(
        default=False,
        description="""<!--zh: 为 true 时强制取消旧登录会话并重新发起扫码-->
Force-cancel the current login session and generate a new QR flow when set to true.""",
    )


@tool()
class ConnectWechatBot(BaseTool[ConnectWechatBotParams]):
    """<!--zh
    发起微信官方 ClawBot 扫码登录。仅供 Skill snippet 调用，不挂载到 LLM。
    -->
    Start the WeChat ClawBot QR login flow. Intended for skill snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: ConnectWechatBotParams) -> ToolResult:
        # 已有活跃会话且不强制刷新时，直接返回当前二维码链接
        existing = wechat_login.get_active_session()
        if existing and existing.is_active() and not params.force_refresh:
            qr_path = existing.qr_relative_path()
            status_text = (
                "waiting for scan"
                if existing.status == wechat_login.LoginStatus.WAITING
                else "scanned, waiting for confirmation in WeChat"
            )
            return ToolResult(
                content=(
                    "You must do two things now:\n"
                    "1. Relay the Markdown link below to the user verbatim without changing the path.\n"
                    "2. Immediately call `wait_wechat_login` and wait for the QR result.\n\n"
                    f"Current status: {status_text}\n\n"
                    "Relay this line verbatim:\n"
                    f"[Open WeChat QR Page]({qr_path})"
                )
            )

        try:
            session, _on_confirmed = await wechat_login.start_login_session(
                force_refresh=params.force_refresh
            )
            qr_path = session.qr_relative_path()

            return ToolResult(
                content=(
                    "You must do two things now:\n"
                    "1. Relay the Markdown link below to the user verbatim without changing the path.\n"
                    "2. Immediately call `wait_wechat_login` and wait for the QR result.\n\n"
                    "Relay this line verbatim:\n"
                    f"[Open WeChat QR Page]({qr_path})"
                )
            )
        except Exception as e:
            logger.error(f"[ConnectWechatBot] 发起登录失败: {e}")
            return ToolResult.error(f"Failed to start the WeChat login flow: {e}")
