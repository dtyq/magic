#!/usr/bin/env python3
"""
获取 MCP 工具列表

参数：
    --server-name: 可选，指定服务器名称

输出格式：JSON
包含字段：name, server_name, description
"""
import json
import argparse

from sdk.mcp import mcp

parser = argparse.ArgumentParser(description="获取 MCP 工具列表")
parser.add_argument("--server-name", type=str, help="服务器名称（可选）")
args = parser.parse_args()

try:
    # 直接调用 MCP SDK
    tools = mcp.get_tools(server_name=args.server_name)

    # 移除 input_schema 字段，只保留基本信息
    tools_basic = [
        {
            "name": tool["original_name"],  # 使用原始工具名称
            "server_name": tool["server_name"],
            "description": tool["description"]
        }
        for tool in tools
    ]

    print(json.dumps(tools_basic, ensure_ascii=False, indent=2))

except Exception as e:
    error_msg = f"获取工具列表时发生异常: {str(e)}"
    print(json.dumps({"error": error_msg}, ensure_ascii=False))
