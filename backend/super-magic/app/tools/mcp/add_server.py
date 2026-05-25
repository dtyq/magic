"""mcp_add_server 工具"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.mcp.config.models import MCPConfigSource, MCPServerConfig
from app.tools.core import BaseToolParams, tool
from app.tools.mcp._base import BaseMcpTool

logger = get_logger(__name__)


class McpAddServerParams(BaseToolParams):
    name: str = Field(
        ...,
        description="""<!--zh: MCP 服务器名称（同名会被覆盖）。-->
MCP server name. An existing server with the same name will be overwritten.""",
    )
    server_type: Literal["stdio", "http"] = Field(
        ...,
        description="""<!--zh: 连接类型，仅支持 stdio 或 http。-->
Connection type. Only 'stdio' or 'http' is supported.""",
    )
    command: Optional[str] = Field(
        None,
        description="""<!--zh: 启动命令（stdio 类型必填）。-->
Launch command (required when server_type='stdio').""",
    )
    args: Optional[List[str]] = Field(
        None,
        description="""<!--zh: 命令参数列表（stdio 类型可选）。-->
Command argument list (optional for stdio).""",
    )
    url: Optional[str] = Field(
        None,
        description="""<!--zh: 服务器 URL（http 类型必填）。-->
Server URL (required when server_type='http').""",
    )
    env: Optional[Dict[str, str]] = Field(
        None,
        description="""<!--zh: 启动子进程使用的环境变量。-->
Environment variables used when launching the stdio subprocess.""",
    )
    label_name: Optional[str] = Field(
        None,
        description="""<!--zh: 服务器在前端展示的友好名称。-->
Friendly label shown in UI.""",
    )


@tool(name="mcp_add_server")
class McpAddServer(BaseMcpTool[McpAddServerParams]):
    """<!--zh
    新增或更新一个 chat 维度的 MCP 服务器配置。仅写入持久化 store + 注入运行期 manager，
    不会立即建连；首次调用其工具或显式 mcp_connect_server 时才会触发连接。
    -->
    Add or update a chat-scoped MCP server configuration. The config is
    persisted to the chat store and injected into the runtime manager but
    NOT connected immediately. The actual connection is established the
    first time mcp_connect_server / mcp_call_tool is invoked against it.
    """

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        name = args.get("name", "")
        return {
            "action": i18n.translate("add_server", category="tool.actions"),
            "remark": i18n.translate("mcp.add_server.adding", category="tool.messages", name=name),
            "tool_name": tool_name,
        }

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        args = arguments or {}
        name = args.get("name", "")
        return i18n.translate("mcp.add_server.added", category="tool.messages", name=name)
    
    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.content:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="mcp_add_server.md", content=result.content),
        )

    async def execute(
        self, tool_context: ToolContext, params: McpAddServerParams
    ) -> ToolResult:
        server_type = params.server_type.lower()

        if server_type == "stdio" and not params.command:
            return ToolResult.error(
                "stdio server requires 'command'.",
            )
        if server_type == "http" and not params.url:
            return ToolResult.error(
                "http server requires 'url'.",
            )

        config_kwargs: dict = {
            "name": params.name,
            "type": server_type,
            "source": MCPConfigSource.CLIENT_CONFIG.value,
        }
        if params.command:
            config_kwargs["command"] = params.command
        if params.args:
            config_kwargs["args"] = params.args
        if params.url:
            config_kwargs["url"] = params.url
        if params.env:
            config_kwargs["env"] = params.env
        if params.label_name:
            config_kwargs["server_options"] = {"label_name": params.label_name}

        try:
            config = MCPServerConfig(**config_kwargs)
        except Exception as e:
            logger.warning(f"Invalid MCP server config: {params.name} - {e}")
            return ToolResult.error(f"Invalid MCP server config: {e!s}")

        store = self._get_store()
        await store.upsert_many([config], source=MCPConfigSource.CLIENT_CONFIG)

        manager = self._get_manager()
        result = await manager.add_server(config)

        logger.info(f"Persisted MCP server config: {params.name} (type={server_type})")

        if result and result.status == "success":
            manager = self._get_manager()
            tool_infos = manager.get_server_tools(params.name)
            lines = [
                f"MCP server '{params.name}' has been registered and connected "
                f"(type={server_type}). {len(tool_infos)} tool(s) discovered:"
            ]
            for info in tool_infos:
                desc = info.description
                prefix = f"MCP server [{info.server_name}] - "
                if desc.startswith(prefix):
                    desc = desc[len(prefix):]
                lines.append(f"- {info.original_name}: {desc}")
            return ToolResult(content="\n".join(lines))

        error_msg = result.error if result else "Connection failed"
        return ToolResult(
            content=(
                f"MCP server '{params.name}' has been registered "
                f"(type={server_type}), but connection failed: {error_msg}. "
                f"You can retry with mcp_connect_server."
            ),
        )
