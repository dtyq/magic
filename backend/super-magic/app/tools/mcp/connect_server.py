"""mcp_connect_server 工具"""

from typing import Any, Dict, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.config.models import MCPServerType
from app.mcp.manager import ensure_server_connected
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

# command 类型的 MCP 服务器首次连接可能需要安装依赖，耗时较长
SdkSnippetTimeoutRegistry.register("mcp_connect_server", min_timeout=600)


class McpConnectServerParams(BaseToolParams):
    server_name: str = Field(
        ...,
        description="""<!--zh: 要连接的 MCP 服务器名称，必须是 mcp_list_servers 返回的某个名字。-->
Name of the MCP server to connect. Must be one of the names returned by
mcp_list_servers.""",
    )


@tool(name="mcp_connect_server")
class McpConnectServer(BaseMcpTool[McpConnectServerParams]):
    """<!--zh
    显式连接指定 MCP 服务器，并返回该服务器实际提供的工具清单。
    仅在 mcp_list_servers 返回 status='disconnected' 时调用；status='connected'
    时无需重复连接。
    -->
    Explicitly connect to the given MCP server and return the tools it
    exposes. Only call this when mcp_list_servers reports status
    'disconnected' for the target server. Connecting an already-connected
    server is a no-op but still incurs latency.
    """

    async def _get_action_key(self, server_name: str) -> str:
        """根据服务器类型返回 action 的 i18n key：STDIO → install_server，HTTP → connect_server。"""
        # 先尝试 manager 内存缓存
        manager = self._get_manager_or_none()
        config = manager.get_server_config(server_name) if manager else None
        if config is None:
            # manager 中没有，再从 store 读
            store = self._get_store()
            config = await store.get(server_name)
        if config and config.type == MCPServerType.STDIO:
            return "install_server"
        return "connect_server"

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        server_name = args.get("server_name", "")
        action_key = await self._get_action_key(server_name)
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": i18n.translate(
                "mcp.connect_server.connecting", category="tool.messages", server_name=server_name
            ),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        server_name = args.get("server_name", "")
        if result.ok:
            return i18n.translate(
                "mcp.connect_server.connected", category="tool.messages",
                server_name=server_name,
            )
        return i18n.translate(
            "mcp.connect_server.failed", category="tool.messages", server_name=server_name
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None,
    ) -> Dict:
        args = arguments or {}
        server_name = args.get("server_name", "")
        action_key = await self._get_action_key(server_name)
        action = i18n.translate(action_key, category="tool.actions")
        remark = self._get_remark_content(result, arguments)
        return {"action": action, "remark": remark}
    
    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.content or not result.ok:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_connect.md", content=result.content),
        )

    async def execute(
        self, tool_context: ToolContext, params: McpConnectServerParams
    ) -> ToolResult:
        server_name = params.server_name.strip()
        if not server_name:
            return ToolResult.error("server_name must not be empty.")

        ok = await self._ensure_server_in_manager(server_name)
        if not ok:
            return ToolResult.error(f"Unknown MCP server: {server_name}")

        ensure_result = await ensure_server_connected(server_name)
        if ensure_result.status != "success":
            error_msg = ensure_result.error or f"Failed to connect MCP server: {server_name}"
            return ToolResult.error(error_msg)

        manager = self._get_manager()
        tool_infos = manager.get_server_tools(server_name)

        lines = [
            f"MCP server '{server_name}' is connected. "
            f"{len(tool_infos)} tool(s) discovered:"
        ]
        for info in tool_infos:
            desc = info.description
            prefix = f"MCP server [{info.server_name}] - "
            if desc.startswith(prefix):
                desc = desc[len(prefix):]
            lines.append(f"- {info.original_name}: {desc}")

        return ToolResult(content="\n".join(lines))
