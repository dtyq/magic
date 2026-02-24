"""
ConnectWechatBot — 发起微信官方 ClawBot 扫码登录的 Tool。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.channel.wechat.login import WechatLoginManager, LoginStatus
from app.core.context.agent_context import AgentContext
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
        manager = WechatLoginManager.get_instance()
        agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

        try:
            session = await manager.start_or_resume_session(force_refresh=params.force_refresh)

            # 向当前 run 注册 cleanup：中断时自动取消此 session
            if agent_context is not None:
                captured_id = session.session_id

                async def _wechat_cleanup() -> None:
                    await manager.cancel_session(session_id=captured_id)

                agent_context.register_run_cleanup("wechat_login", _wechat_cleanup)

            # 复用已有 session 时，告知当前扫码状态
            status_text: str | None = None
            if session.status == LoginStatus.SCANNED:
                status_text = "scanned, waiting for confirmation in WeChat"
            return ToolResult(content=_build_qr_render_message(session.qrcode_js_string_literal(), status_text))
        except Exception as e:
            logger.error(f"[ConnectWechatBot] start session failed: {e}")
            return ToolResult.error(f"Failed to start the WeChat login flow: {e}")


def _build_qr_render_message(qrcode_js_string_literal: str, status_text: str | None = None) -> str:
    lines = [
        "You must do two things now:",
        "1. Use the WeChat QR HTML template from the current skill and replace "
        "`{{QRCODE_JS_STRING_LITERAL}}` with the exact literal below.",
        "2. Reply to the user with exactly one ```html fenced code block and no prose outside the block, "
        "then immediately call `wait_wechat_login`.",
    ]
    if status_text:
        lines.extend(("", f"Current status: {status_text}"))
    lines.extend(("", "Exact JavaScript string literal:", qrcode_js_string_literal))
    return "\n".join(lines)
