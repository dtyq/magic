"""mcp_call_tool 工具"""

import json
from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.manager import ensure_server_connected
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool

logger = get_logger(__name__)


class McpCallToolParams(BaseToolParams):
    server_name: str = Field(
        ...,
        description="""<!--zh: 目标 MCP 服务器名称。-->
Target MCP server name.""",
    )
    tool_name: str = Field(
        ...,
        description="""<!--zh: 要调用的工具名，需与 mcp_list_tools / mcp_get_tool_schema 返回的 name 完全一致。-->
Name of the tool to invoke. Must match the `name` returned by
mcp_list_tools / mcp_get_tool_schema exactly.""",
    )
    tool_params: str = Field(
        ...,
        description="""<!--zh
        传给目标工具的参数，必须是 JSON 对象字符串（顶层是 object），如 '{"key": "value"}'。
        内部会 json.loads 后转发给 MCP 上游工具；结构必须与 mcp_get_tool_schema 返回的 schema 匹配。
        没有参数时传 '{}'。
        -->
        JSON object string forwarded to the target tool, e.g. '{"key": "value"}'.
        It will be json.loads'd into a dict before being relayed; the parsed
        shape must match the schema returned by mcp_get_tool_schema. Pass '{}'
        when the target tool takes no parameters.""",
    )


@tool(name="mcp_call_tool")
class McpCallTool(BaseMcpTool[McpCallToolParams]):
    """<!--zh
    调用 MCP 服务器上的具体工具，等价于"远程函数调用"。若目标服务器未连接会先按需建连。
    返回值的 content/data 直接来自上游工具的原始结果。
    -->
    Invoke a specific tool on an MCP server, similar to a remote function
    call. Connects the server on demand when needed. The returned content
    and data fields come straight from the upstream tool's raw result.
    """

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        server_name = args.get("server_name", "")
        target_tool = args.get("tool_name", "")
        return {
            "action": i18n.translate("call_tool", category="tool.actions"),
            "remark": i18n.translate(
                "mcp.call_tool.calling", category="tool.messages",
                server_name=server_name, tool_name=target_tool,
            ),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        server_name = args.get("server_name", "")
        target_tool = args.get("tool_name", "")
        if result.ok:
            return i18n.translate(
                "mcp.call_tool.called", category="tool.messages",
                server_name=server_name, tool_name=target_tool,
            )
        return i18n.translate(
            "mcp.call_tool.failed", category="tool.messages",
            server_name=server_name, tool_name=target_tool,
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None,
    ) -> Dict:
        action = i18n.translate("call_tool", category="tool.actions")
        remark = self._get_remark_content(result, arguments)
        return {"action": action, "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        args = arguments or {}
        server_name = args.get("server_name", "")
        target_tool = args.get("tool_name", "")
        title = f"**{server_name}.{target_tool}**"
        content_text = result.content or ""
        # 截断过长内容避免详情页过大
        if len(content_text) > 2000:
            content_text = content_text[:2000] + "\n\n...(truncated)"
        status = "✅" if result.ok else "❌"
        md = f"{title} {status}\n\n{content_text}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_call_result.md", content=md),
        )

    async def execute(
        self, tool_context: ToolContext, params: McpCallToolParams
    ) -> ToolResult:
        server_name = params.server_name.strip()
        tool_name = params.tool_name.strip()
        if not server_name or not tool_name:
            return ToolResult.error("server_name and tool_name must not be empty.")

        ok = await self._ensure_server_in_manager(server_name)
        if not ok:
            return ToolResult.error(f"Unknown MCP server: {server_name}")

        try:
            parsed_params = json.loads(params.tool_params)
        except json.JSONDecodeError as e:
            return ToolResult.error(
                f"tool_params must be a valid JSON object string: {e!s}"
            )
        if not isinstance(parsed_params, dict):
            return ToolResult.error(
                "tool_params must decode to a JSON object (dict at top level)."
            )

        ensure_result = await ensure_server_connected(server_name)
        if ensure_result.status != "success":
            return ToolResult.error(
                ensure_result.error or f"Failed to connect MCP server: {server_name}",
            )

        manager = self._get_manager()
        try:
            result = await manager.call_tool(server_name, tool_name, parsed_params)
        except Exception as e:
            logger.error(
                f"MCP call failed: {server_name}.{tool_name}: {e}", exc_info=True
            )
            return ToolResult.error(f"MCP tool call failed: {e!s}")

        # 原始 ToolResult 已经有 content/data/ok，直接透传
        result.name = f"{server_name}.{tool_name}"
        return result
