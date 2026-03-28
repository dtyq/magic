"""
GetIMChannelStatus — 查询 IM 渠道配置与连接状态。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from typing import Any, Dict

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.channel.base.registry import build_default_channel_registry
from app.channel.config import load_config
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool


@tool()
class GetIMChannelStatus(BaseTool[BaseToolParams]):
    """<!--zh
    查询企业微信、钉钉、飞书、微信的配置情况与实时连接状态。仅供 Skill snippet 调用，不挂载到 LLM。
    -->
    Query configuration and live connection status for WeCom, DingTalk, Lark, and WeChat. Intended for skill snippets only and not exposed as a normal LLM tool.
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
