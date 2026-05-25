"""MCP 工具共享基类

只承担三件事：
1. 统一拿 ChatMcpStore（chat 维度配置存储）
2. 统一拿全局 MCPServerManager（连接池）
3. 把"运行期 manager 没持有，但 store 里有"的兜底注入逻辑收口

不抽生命周期、不抽状态机、不为"将来可能新增 MCP 能力"留扩展点（AGENTS.md §2）。
"""
from abc import ABC
from typing import ClassVar, Generic, Optional, TypeVar

from app.mcp.connection.server_manager import MCPServerManager
from app.mcp.manager import get_global_mcp_manager, get_or_create_manager
from app.mcp.store import get_chat_mcp_store
from app.mcp.store.chat_mcp_store import ChatMcpStore
from app.tools.core import BaseTool, BaseToolParams

P = TypeVar("P", bound=BaseToolParams)


class BaseMcpTool(BaseTool[P], Generic[P], ABC):
    """MCP 工具共享基类。

    继承本类的工具默认 `code_mode_only = True`，意味着它们：
    - 仍然会被 tool_factory 注册（dispatcher 能找到）
    - 但**不会**出现在 LLM 看到的工具列表里
    - 只能通过 `run_sdk_snippet` + `sdk.tool.call('mcp_xxx', ...)` 调用

    详见 agents/guides/TOOL_OR_SKILL.md §「Code Mode 专属工具」。
    """

    code_mode_only: ClassVar[bool] = True

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
