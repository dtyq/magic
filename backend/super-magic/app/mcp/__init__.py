"""SuperMagic MCP (Model Context Protocol) 集成模块

提供全局单例的 MCP 服务器管理功能，支持配置持久化和连接池管理。
"""

from .server_config import MCPServerConfig, MCPServerType
from .client import MCPClient
from .server_manager import MCPServerManager
from .manager import (
    initialize_global_mcp_manager,
    get_global_mcp_manager,
    get_global_mcp_tools,
    is_mcp_tool,
    shutdown_global_mcp_manager
)

__all__ = [
    "MCPServerConfig",
    "MCPServerType",
    "MCPClient",
    "MCPServerManager",
    "initialize_global_mcp_manager",
    "get_global_mcp_manager",
    "get_global_mcp_tools",
    "is_mcp_tool",
    "shutdown_global_mcp_manager",
]
