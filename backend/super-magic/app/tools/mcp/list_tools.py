"""mcp_list_tools 工具"""

from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.manager import ensure_server_connected
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool


class McpListToolsParams(BaseToolParams):
    server_name: Optional[str] = Field(
        None,
        description="""<!--zh
        指定服务器时按需连接并返回该服务器的工具清单；
        不指定时仅返回当前已连接服务器的工具，不会主动建连。
        -->
        When provided, ensure that server is connected and return its tool
        list. When omitted, return tools from currently connected servers
        only (no implicit connection).""",
    )


@tool(name="mcp_list_tools")
class McpListTools(BaseMcpTool[McpListToolsParams]):
    """<!--zh
    列出 MCP 工具。指定 server_name 会按需连接对应服务器；不指定则只读地返回所有
    已连接服务器的工具。
    -->
    List MCP tools. Passing server_name connects that server on demand and
    returns its tools. Without server_name, returns tools across all
    currently connected servers without triggering any connection.
    """

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        server_name = args.get("server_name")
        if server_name:
            remark = i18n.translate(
                "mcp.list_tools.listing_server", category="tool.messages", server_name=server_name
            )
        else:
            remark = i18n.translate("mcp.list_tools.listing", category="tool.messages")
        return {
            "action": i18n.translate("list_tools", category="tool.actions"),
            "remark": remark,
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        server_name = args.get("server_name")
        if server_name:
            return i18n.translate(
                "mcp.list_tools.listed_server", category="tool.messages", server_name=server_name
            )
        return i18n.translate("mcp.list_tools.listed", category="tool.messages")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.content or result.content.startswith("No ") or not result.ok:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_tools.md", content=result.content),
        )

    async def execute(
        self, tool_context: ToolContext, params: McpListToolsParams
    ) -> ToolResult:
        server_name = params.server_name.strip() if params.server_name else None

        if server_name:
            ok = await self._ensure_server_in_manager(server_name)
            if not ok:
                return ToolResult.error(f"Unknown MCP server: {server_name}")

            ensure_result = await ensure_server_connected(server_name)
            if ensure_result.status != "success":
                return ToolResult.error(
                    ensure_result.error
                    or f"Failed to connect MCP server: {server_name}"
                )

            manager = self._get_manager()
        else:
            manager = self._get_manager_or_none()
            if not manager:
                return ToolResult(content="No MCP server is connected.")

        if server_name:
            tool_infos = manager.get_server_tools(server_name)
            unavailable_infos = manager.get_unavailable_tools(server_name)
        else:
            tool_infos = [
                info
                for tools in manager.tools.values()
                for info in tools
            ]
            unavailable_infos = [
                info
                for tools in manager.unavailable_tools.values()
                for info in tools
            ]

        if server_name:
            lines = [f"MCP server '{server_name}' exposes {len(tool_infos)} tool(s):"]
        else:
            lines = [f"Found {len(tool_infos)} tool(s) across connected MCP server(s):"]

        for info in tool_infos:
            # 描述去掉前缀 "MCP server [xxx] - "
            desc = info.description
            prefix = f"MCP server [{info.server_name}] - "
            if desc.startswith(prefix):
                desc = desc[len(prefix):]
            lines.append(f"- {info.original_name}: {desc}")

        if unavailable_infos:
            lines.append(f"\n{len(unavailable_infos)} tool(s) are unavailable:")
            for u in unavailable_infos:
                lines.append(f"- {u.name}: {u.error}")

        return ToolResult(content="\n".join(lines))
