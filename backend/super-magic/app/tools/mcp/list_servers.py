"""mcp_list_servers 工具"""

from typing import Any, Dict, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool
from app.tools.mcp.shared import McpServerStatus


class McpListServersParams(BaseToolParams):
    pass


@tool(name="mcp_list_servers")
class McpListServers(BaseMcpTool[McpListServersParams]):
    """List chat-scoped MCP servers with connection status and tool counts."""

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        return {
            "action": i18n.translate("list_servers", category="tool.actions"),
            "remark": i18n.translate("mcp.list_servers.listing", category="tool.messages"),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        return i18n.translate("mcp.list_servers.listed", category="tool.messages")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        return self._build_mcp_tool_detail(
            result,
            file_name="mcp_servers.md",
            error_title="MCP server listing failed",
        )

    async def execute(
        self, tool_context: ToolContext, params: McpListServersParams
    ) -> ToolResult:
        store = self._get_store()
        entries = await store.list_all()

        manager = self._get_manager_or_none()
        connected_names = set(manager.get_connected_servers()) if manager else set()

        if not entries:
            return ToolResult(content="No MCP server is registered for the current chat.")

        lines = [f"Found {len(entries)} MCP server(s):"]
        for name, config in entries.items():
            label_name = ""
            if config.server_options and isinstance(config.server_options, dict):
                label_name = config.server_options.get("label_name", "")

            is_connected = name in connected_names
            status = McpServerStatus.CONNECTED.value if is_connected else McpServerStatus.DISCONNECTED.value

            tool_count = len(manager.get_server_tools(name)) if (manager and is_connected) else 0

            display_name = label_name or name
            if is_connected:
                lines.append(f"- {display_name} (name={name}, status={status}, {tool_count} tool(s))")
            else:
                lines.append(f"- {display_name} (name={name}, status={status})")

        return ToolResult(content="\n".join(lines))
