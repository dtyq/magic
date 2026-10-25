"""MCP 工具失败结果的用户侧 Markdown 详情测试。"""

import pytest

from agentlang.tools.tool_result import ToolResult
from app.tools.mcp.call_tool import McpCallTool
from app.tools.mcp.connect_server import McpConnectServer
from app.tools.mcp.get_tool_schema import McpGetToolSchema
from app.tools.mcp.list_servers import McpListServers
from app.tools.mcp.list_tools import McpListTools


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool", "file_name", "arguments"),
    [
        (McpConnectServer(), "mcp_connect.md", {"server_name": "mock-server"}),
        (McpGetToolSchema(), "mcp_tool_schema.md", {"server_name": "mock-server", "tool_name": "mock-tool"}),
        (McpListServers(), "mcp_servers.md", {}),
        (McpListTools(), "mcp_tools.md", {"server_name": "mock-server"}),
        (
            McpCallTool(),
            "mcp_call_result.md",
            {"server_name": "mock-server", "tool_name": "mock-tool", "tool_params": "{}"},
        ),
    ],
)
async def test_mcp_error_result_has_user_facing_markdown_detail(tool, file_name, arguments):
    """MCP 管理工具失败时，detail 仍向用户展示具体错误。"""
    result = ToolResult.error("MCP server returned: 未登录")

    detail = await tool.get_tool_detail(None, result, arguments)

    assert detail is not None
    assert detail.type == "md"
    assert detail.data.file_name == file_name
    assert "MCP" in detail.data.content
    assert "未登录" in detail.data.content
