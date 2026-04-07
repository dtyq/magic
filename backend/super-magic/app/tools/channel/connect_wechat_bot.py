"""
ConnectWechatBot — 发起微信官方 ClawBot 扫码登录的 Tool。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk-runtime/call_tool 调用。
"""
from typing import Any, Dict

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.channel.wechat.login import WechatLoginManager, WechatLoginResult, LoginStatus
from app.core.context.agent_context import AgentContext
from app.i18n import i18n
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
    发起微信官方 ClawBot 扫码登录。仅供 SDK snippet 调用，不挂载到 LLM。
    -->
    Start the WeChat ClawBot QR login flow. Intended for SDK snippets only and not exposed as a normal LLM tool.
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

            # 仅在新 session 上挂兜底回调，复用时已有回调无需重复注册。
            # 作用：即使模型未调用 wait_wechat_login，扫码成功后也能自动写配置并激活渠道。
            if session._on_success is None:
                sandbox_id = tool_context.sandbox_id

                async def _on_login_success(result: "WechatLoginResult") -> None:
                    from app.channel.config import (
                        DEFAULT_WECHAT_CDN_BASE_URL,
                        WechatCredential,
                        load_config,
                        save_config,
                    )
                    from app.channel.wechat.channel import WechatChannel
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
                        sandbox_id=sandbox_id,
                    )
                    await save_config(config)
                    logger.info(
                        f"[ConnectWechatBot] auto-activating WechatChannel, "
                        f"ilink_bot_id={result.ilink_bot_id}"
                    )
                    await WechatChannel.get_instance().connect(config.wechat)

                session._on_success = _on_login_success

            # 复用已有 session 时，告知当前扫码状态
            status_text: str | None = None
            if session.status == LoginStatus.SCANNED:
                status_text = "scanned, waiting for confirmation in WeChat"
            return ToolResult(content=_build_qr_render_message(session.qrcode_content, status_text))
        except Exception as e:
            logger.error(f"[ConnectWechatBot] start session failed: {e}")
            return ToolResult.error(f"Failed to start the WeChat login flow: {e}")

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
                    "channel.connect_wechat_bot.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.connect_wechat_bot.success",
                category="tool.messages",
            ),
        }


def _build_qr_render_message(qrcode_url: str, status_text: str | None = None) -> str:
    lines = [
        "Reply to the user with the following content (no extra prose), "
        "adapting the heading and description to user preferred language. "
        "Then immediately call `wait_wechat_login`.",
    ]
    if status_text:
        lines.extend(("", f"Current status: {status_text}"))
    lines.extend([
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
    return "\n".join(lines)
