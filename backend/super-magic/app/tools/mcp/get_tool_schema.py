"""mcp_get_tool_schema 工具"""

import json as json_mod
from typing import Any, Dict, List, Optional, Union

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.manager import ensure_server_connected
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool


class McpGetToolSchemaParams(BaseToolParams):
    server_name: str = Field(
        ...,
        description="""<!--zh: MCP 服务器名称-->
MCP server name.""",
    )
    tool_name: Union[str, List[str]] = Field(
        ...,
        description="""<!--zh
        要查询的工具名，需与 mcp_list_tools 返回的 name 完全一致。
        可传单个字符串，也可传字符串列表一次拿多个工具的 input schema。
        -->
        Tool name(s) to query. Must match the `name` returned by
        mcp_list_tools exactly. Accepts either a single string or a list of
        strings to fetch multiple schemas at once.""",
    )


@tool(name="mcp_get_tool_schema")
class McpGetToolSchema(BaseMcpTool[McpGetToolSchemaParams]):
    """<!--zh
    获取指定 MCP 工具的输入参数 schema，用于在调用前确认参数结构。
    若服务器尚未连接，会按需先建连再查询。
    -->
    Fetch the input schema(s) of one or more MCP tools, so the caller can
    validate parameters before mcp_call_tool. Connects the target server on
    demand if it is not yet connected.
    """

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
        if not result.content or not result.ok:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_tool_schema.md", content=result.content),
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
                lines.append(f"Input schema:")
                lines.append(f"```json\n{json_mod.dumps(t_info.inputSchema, indent=2, ensure_ascii=False)}\n```")
            else:
                lines.append(f"## {t_name}")
                lines.append(f"Error: Tool not found on server '{server_name}'.")
            lines.append("")

        header = f"Resolved {ok_count}/{len(tool_names)} tool schema(s) on server '{server_name}':\n"
        return ToolResult(content=header + "\n".join(lines))
