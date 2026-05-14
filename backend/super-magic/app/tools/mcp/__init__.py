"""MCP 工具集

把原 sdk/mcp.py + /api/sdk/mcp/* 路由 + agents/skills/using-mcp/scripts 收敛到
super-magic 的 @tool() 范式。

这 6 个工具均带 `code_mode_only = True`，即"注册但不挂载"——
不会进入模型默认工具列表，仅供 run_sdk_snippet 子进程通过
`from sdk.tool import tool; tool.call('mcp_xxx', {...})` 调用。

实际服务承载仍在：
- app/service/mcp_service.py
- app/mcp/manager.py
- app/mcp/store/chat_mcp_store.py
- app/mcp/connection/server_manager.py

工具层只负责把它们包装成统一的 ToolResult 形态。
"""

from app.tools.mcp.add_server import McpAddServer
from app.tools.mcp.call_tool import McpCallTool
from app.tools.mcp.connect_server import McpConnectServer
from app.tools.mcp.get_tool_schema import McpGetToolSchema
from app.tools.mcp.list_servers import McpListServers
from app.tools.mcp.list_tools import McpListTools
from app.tools.mcp.remove_server import McpRemoveServer

__all__ = [
    "McpAddServer",
    "McpCallTool",
    "McpConnectServer",
    "McpGetToolSchema",
    "McpListServers",
    "McpListTools",
    "McpRemoveServer",
]
