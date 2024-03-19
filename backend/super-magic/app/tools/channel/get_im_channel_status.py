"""
GetIMChannelStatus — 查询 IM 渠道配置与连接状态。

不挂载到 LLM tool list，仅供 Skill snippet 通过 /api/skills/call_tool 调用。
"""
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.channel.base.channel import BaseChannel
from app.channel.base.registry import build_default_channel_registry
from app.channel.config import IMChannelsConfig, load_config
from app.tools.core import BaseTool, BaseToolParams, tool


def _render_channel_status(channel: BaseChannel, config: IMChannelsConfig) -> list[str]:
    credential = getattr(config, channel.key, None)
    lines = [channel.label]
    if credential is None:
        lines.append("  状态：⚪ 未配置")
        return lines

    lines.append(f"  状态：{'🟢 已连接' if channel.is_connected else '🔴 未连接'}")
    summary = channel.summarize_config(config)
    if summary:
        lines.append(f"  {summary}")
    lines.append(f"  启动自动连接：{'已开启' if credential.enabled else '已关闭'}")
    return lines


@tool()
class GetIMChannelStatus(BaseTool[BaseToolParams]):
    """查询企业微信、钉钉、飞书的配置情况与实时连接状态。仅供 Skill snippet 调用，不挂载到 LLM。"""

    async def execute(self, tool_context: ToolContext, params: BaseToolParams) -> ToolResult:
        config = await load_config()
        channels = build_default_channel_registry().get_all()
        lines = ["📡 IM 渠道状态", ""]
        for index, channel in enumerate(channels):
            lines.extend(_render_channel_status(channel, config))
            if index < len(channels) - 1:
                lines.append("")

        return ToolResult(content="\n".join(lines))
