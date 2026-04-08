"""
GetIMChannelStatus — 查询 IM 渠道配置与连接状态。

不挂载到 LLM tool list，仅供 SDK snippet 通过 /api/sdk/tool/call 调用。
"""
from typing import Any, Dict, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.channel.base.registry import build_default_channel_registry
from app.channel.config import DisabledReason, load_config
from app.core.entity.message.server_message import DisplayType, TerminalContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool


@tool()
class GetIMChannelStatus(BaseTool[BaseToolParams]):
    """<!--zh
    查询企业微信、钉钉、飞书、微信的配置情况与实时连接状态。仅供 SDK snippet 调用，不挂载到 LLM。
    -->
    Query configuration and live connection status for WeCom, DingTalk, Lark, and WeChat. Intended for SDK snippets only and not exposed as a normal LLM tool.
    """

    async def execute(self, tool_context: ToolContext, params: BaseToolParams) -> ToolResult:
        config = await load_config()
        channels = build_default_channel_registry().get_all()
        lines = ["IM channel status", ""]
        for index, channel in enumerate(channels):
            lines.extend(channel.render_status_lines(config))
            if index < len(channels) - 1:
                lines.append("")

        return ToolResult(content="\n".join(lines))

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        config = await load_config()
        channels = build_default_channel_registry().get_all()

        f_status = i18n.translate("channel.status.field.status", category="tool.messages")
        f_config = i18n.translate("channel.status.field.config", category="tool.messages")
        f_auto = i18n.translate("channel.status.field.auto_connect", category="tool.messages")
        # 对齐字段标签宽度
        col_width = max(len(f_status), len(f_config), len(f_auto))

        output_lines = []
        for channel in channels:
            credential = getattr(config, channel.key, None)
            configured = credential is not None
            connected = channel.is_connected
            enabled = credential.enabled if configured else None

            if connected:
                status_val = f"🟢 {i18n.translate('channel.status.connected', category='tool.messages')}"
            elif configured:
                disabled_reason = getattr(credential, "disabled_reason", "")
                if disabled_reason == DisabledReason.SESSION_EXPIRED:
                    status_val = f"🟠 {i18n.translate('channel.status.session_expired', category='tool.messages')}"
                elif disabled_reason == DisabledReason.USER_DISABLED:
                    status_val = f"⚪ {i18n.translate('channel.status.user_disabled', category='tool.messages')}"
                else:
                    status_val = f"🔴 {i18n.translate('channel.status.disconnected', category='tool.messages')}"
            else:
                status_val = f"⚫ {i18n.translate('channel.status.not_configured', category='tool.messages')}"

            label = i18n.translate(f"channel.{channel.key}.label", category="tool.messages")
            output_lines.append(f"  {label} ({channel.key})")
            output_lines.append(f"    {f_status:<{col_width}}  {status_val}")

            if configured:
                summary = channel.summarize_config(config)
                if summary:
                    output_lines.append(f"    {f_config:<{col_width}}  {summary}")
                auto_state = i18n.translate(
                    "channel.status.auto_connect_enabled" if enabled else "channel.status.auto_connect_disabled",
                    category="tool.messages",
                )
                output_lines.append(f"    {f_auto:<{col_width}}  {auto_state}")

            output_lines.append("")

        return ToolDetail(
            type=DisplayType.TERMINAL,
            data=TerminalContent(
                command="im-channel status",
                output="\n".join(output_lines).rstrip(),
                exit_code=0,
            ),
        )

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
                    "channel.get_im_channel_status.error",
                    category="tool.messages",
                    error=result.content,
                ),
            }
        return {
            "action": action,
            "remark": i18n.translate(
                "channel.get_im_channel_status.success",
                category="tool.messages",
            ),
        }
