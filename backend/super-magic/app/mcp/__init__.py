"""SuperMagic MCP (Model Context Protocol) 集成模块

分层目录结构：
- config/     配置模型与加载
- connection/ 连接生命周期管理
- tool/       工具适配层
"""

from .config.models import MCPServerConfig, MCPServerType
from .connection.client import MCPClient
from .connection.server_manager import MCPServerManager
from .manager import (
    get_global_mcp_manager,
    get_global_mcp_tools,
    initialize_global_mcp_manager,
    is_mcp_tool,
    shutdown_global_mcp_manager,
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
