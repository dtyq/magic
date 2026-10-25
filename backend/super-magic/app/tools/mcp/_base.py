"""MCP 工具共享基类

只承担三件事：
1. 统一拿 ChatMcpStore（chat 维度配置存储）
2. 统一拿全局 MCPServerManager（连接池）
3. 把"运行期 manager 没持有，但 store 里有"的兜底注入逻辑收口

不抽生命周期、不抽状态机、不为"将来可能新增 MCP 能力"留扩展点（AGENTS.md §2）。
"""
from abc import ABC
from typing import Generic, Optional, TypeVar

from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.mcp.connection.server_manager import MCPServerManager
from app.mcp.manager import get_global_mcp_manager, get_or_create_manager
from app.mcp.store import get_chat_mcp_store
from app.mcp.store.chat_mcp_store import ChatMcpStore
from app.tools.core import BaseTool, BaseToolParams, tool

P = TypeVar("P", bound=BaseToolParams)


@tool(code_mode_only=True)
class BaseMcpTool(BaseTool[P], Generic[P], ABC):
    """Shared base for MCP tools available only through Code Mode.

    Subclasses inherit `@tool(code_mode_only=True)`: they remain registered for
    dispatch but are excluded from the LLM tool list and must be called through
    `run_sdk_snippet` with `sdk.tool.call(...)`.
    """

    @staticmethod
    def _get_store() -> ChatMcpStore:
        """获取当前 chat 维度的 MCP 配置存储。"""
        return get_chat_mcp_store()

    @staticmethod
    def _get_manager() -> MCPServerManager:
        """获取全局 MCPServerManager 单例（必要时创建空配置实例）。"""
        return get_or_create_manager()

    @staticmethod
    def _get_manager_or_none() -> Optional[MCPServerManager]:
        """只读地拿全局 manager，未创建时返回 None。"""
        return get_global_mcp_manager()

    @staticmethod
    def _build_mcp_tool_detail(
        result: ToolResult,
        file_name: str,
        error_title: str,
    ) -> Optional[ToolDetail]:
        """将 MCP 工具结果转换为用户侧 Markdown 详情。"""
        content = (result.content or "").strip()
        if not result.ok:
            content = f"## {error_title}\n\n{content or 'MCP tool execution failed.'}"
        if not content:
            return None
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name=file_name, content=content),
        )

    @staticmethod
    async def _ensure_server_in_manager(server_name: str) -> bool:
        """确保 manager 持有该 server 的配置；缺失时从 store 拉回并 add_server。

        Returns:
            True  -- manager 已经持有或已成功从 store 注入
            False -- store 里也找不到该 server（调用方应返回 Unknown MCP server 错误）
        """
        manager = get_or_create_manager()
        if server_name in manager.server_configs:
            return True

        store = get_chat_mcp_store()
        stored_config = await store.get(server_name)
        if stored_config is None:
            return False

        await manager.add_server(stored_config, connect=False)
        return True
