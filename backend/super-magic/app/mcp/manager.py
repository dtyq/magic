"""MCP 全局管理器（按需连接版）

按需连接重构后，全局 MCP 管理器只保留连接池语义：
- 配置持久化由 `app/mcp/store/ChatMcpStore` 负责（chat 维度）
- 启动期 seed 由 `app/service/MCPService.seed_from_global_config` 写入 store
- 本模块只提供全局单例的 MCPServerManager，按需建连、按需断开、按需调用

不再提供：
- `initialize_global_mcp_manager`（批量建连入口已下线，启动期不再主动建连）
- `is_mcp_tool` / `_MCP_TOOL_PATTERN`（`mcp_{letter}_` 工具挂载链路已下线）
"""

from typing import Dict, Optional

from agentlang.logger import get_logger

from .connection.server_manager import MCPServerManager
from .tool.models import MCPServerResult, MCPToolInfo

logger = get_logger(__name__)

# 全局 MCP 管理器单例（按需创建，初始时不持有任何 server 配置）
_global_manager: Optional[MCPServerManager] = None


def get_or_create_manager() -> MCPServerManager:
    """获取或创建全局 MCPServerManager 单例。

    初次调用时以空配置创建；调用方通过 `add_server` 或 `ensure_server_connected`
    往其中注入配置与连接。
    """
    global _global_manager
    if _global_manager is None:
        _global_manager = MCPServerManager({})
        logger.debug("已创建全局 MCP 管理器（空配置）")
    return _global_manager


def get_global_mcp_manager() -> Optional[MCPServerManager]:
    """获取全局 MCP 管理器实例，未创建时返回 None。"""
    return _global_manager


def get_global_mcp_tools() -> Dict[str, MCPToolInfo]:
    """获取全局已连接的 MCP 工具字典（未连接时返回空）。"""
    if _global_manager:
        return _global_manager.get_all_tools()
    return {}


async def ensure_server_connected(server_name: str) -> MCPServerResult:
    """按需连接指定 MCP 服务器（必要时先创建全局管理器）。

    未在管理器配置中的 server_name 会直接返回 failed 结果，
    由调用方（通常是 using-mcp skill / /api/sdk/mcp/call 路由）
    在更高层决定是否从 ChatMcpStore 注入配置后再重试。
    """
    manager = get_or_create_manager()
    return await manager.ensure_server_connected(server_name)


async def disconnect_server(server_name: str) -> bool:
    """按需断开指定 MCP 服务器（保留配置）。"""
    if _global_manager is None:
        return False
    return await _global_manager.disconnect_server(server_name)


async def shutdown_global_mcp_manager() -> None:
    """关闭全局 MCP 管理器并清理所有资源。"""
    global _global_manager

    if _global_manager:
        logger.debug("开始关闭全局 MCP 管理器")
        try:
            await _global_manager.shutdown()
            logger.debug("全局 MCP 管理器已关闭")
        except Exception as e:
            logger.warning(f"关闭全局 MCP 管理器时出错: {e}")
        finally:
            _global_manager = None
