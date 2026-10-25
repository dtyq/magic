"""mcp_get_tool_schema 工具"""

import json as json_mod
from typing import Any, Dict, List, Optional, Union

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.mcp.manager import ensure_server_connected
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool


class McpGetToolSchemaParams(BaseToolParams):
    server_name: str = Field(
        ...,
        description="MCP server name.",
    )
    tool_name: Union[str, List[str]] = Field(
        ...,
        description=(
            "Tool name or names returned by mcp_list_tools. Pass a string or a "
            "string list to fetch one or more input schemas."
        ),
    )


@tool(name="mcp_get_tool_schema")
class McpGetToolSchema(BaseMcpTool[McpGetToolSchemaParams]):
    """Fetch input schemas for MCP tools, connecting the server when needed."""

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        target_tool = args.get("tool_name", "")
        return {
            "action": i18n.translate("get_tool_schema", category="tool.actions"),
            "remark": i18n.translate(
                "mcp.get_tool_schema.querying", category="tool.messages", tool_name=target_tool
            ),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        target_tool = args.get("tool_name", "")
        return i18n.translate(
            "mcp.get_tool_schema.resolved", category="tool.messages", tool_name=target_tool
        )

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        return self._build_mcp_tool_detail(
            result,
            file_name="mcp_tool_schema.md",
            error_title="MCP tool schema failed",
        )

    async def execute(
        self, tool_context: ToolContext, params: McpGetToolSchemaParams
    ) -> ToolResult:
        server_name = params.server_name.strip()
        if not server_name:
            return ToolResult.error("server_name must not be empty.")

        if isinstance(params.tool_name, list):
            tool_names = [n.strip() for n in params.tool_name if n and n.strip()]
        else:
            tool_names = [n.strip() for n in params.tool_name.split(",") if n.strip()]

        if not tool_names:
            return ToolResult.error("tool_name must contain at least one name.")

        ok = await self._ensure_server_in_manager(server_name)
        if not ok:
            return ToolResult.error(f"Unknown MCP server: {server_name}")

        ensure_result = await ensure_server_connected(server_name)
        if ensure_result.status != "success":
            return ToolResult.error(
                ensure_result.error or f"Failed to connect MCP server: {server_name}"
            )

        manager = self._get_manager()
        server_tools = {info.original_name: info for info in manager.get_server_tools(server_name)}

        lines = []
        ok_count = 0
        for t_name in tool_names:
            t_info = server_tools.get(t_name)
            if t_info:
                ok_count += 1
                lines.append(f"## {t_name}")
                if t_info.description:
                    lines.append(f"Description: {t_info.description}")
                lines.append("Input schema:")
                lines.append(f"```json\n{json_mod.dumps(t_info.inputSchema, indent=2, ensure_ascii=False)}\n```")
            else:
                lines.append(f"## {t_name}")
                lines.append(f"Error: Tool not found on server '{server_name}'.")
            lines.append("")

        header = f"Resolved {ok_count}/{len(tool_names)} tool schema(s) on server '{server_name}':\n"
        return ToolResult(content=header + "\n".join(lines))
