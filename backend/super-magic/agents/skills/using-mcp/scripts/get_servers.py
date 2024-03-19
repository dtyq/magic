#!/usr/bin/env python3
"""
获取 MCP 服务器列表

输出格式：JSON
包含字段：name, label_name, status, tool_count, tools
"""
import json

from sdk.mcp import mcp

try:
    # 直接调用 MCP SDK
    servers = mcp.get_servers()
    print(json.dumps(servers, ensure_ascii=False, indent=2))

except Exception as e:
    error_msg = f"获取服务器列表时发生异常: {str(e)}"
    print(json.dumps({"error": error_msg}, ensure_ascii=False))
