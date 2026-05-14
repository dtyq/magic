"""SuperMagic MCP (Model Context Protocol) 集成模块

分层目录结构：
- config/     配置模型与加载
- connection/ 连接生命周期管理
- tool/       工具适配层
- store/      chat 维度配置持久化
"""

from .config.models import MCPServerConfig, MCPServerType
from .connection.client import MCPClient
from .connection.server_manager import MCPServerManager
from .manager import (
    disconnect_server,
    ensure_server_connected,
    get_global_mcp_manager,
    get_global_mcp_tools,
    get_or_create_manager,
    shutdown_global_mcp_manager,
)

__all__ = [
    "MCPServerConfig",
    "MCPServerType",
    "MCPClient",
    "MCPServerManager",
    "get_or_create_manager",
    "ensure_server_connected",
    "disconnect_server",
    "get_global_mcp_manager",
    "get_global_mcp_tools",
    "shutdown_global_mcp_manager",
]
