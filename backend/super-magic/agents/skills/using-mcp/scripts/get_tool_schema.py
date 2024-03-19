#!/usr/bin/env python3
"""
获取指定 MCP 工具的 JSON Schema

参数：
    --server-name: 必填，服务器名称
    --tool-name: 必填，工具名称，支持多个工具

输出格式：JSON 数组，每个元素包含 tool_name, server_name, schema 或 error
"""
import json
import argparse

from sdk.mcp import mcp

parser = argparse.ArgumentParser(description="获取 MCP 工具 Schema")
parser.add_argument("--server-name", type=str, required=True, help="服务器名称")
parser.add_argument("--tool-name", type=str, nargs='+', required=True, help="工具名称（支持多个）")
args = parser.parse_args()

try:
    # 传入单个字符串或列表，统一返回数组
    tool_input = args.tool_name[0] if len(args.tool_name) == 1 else args.tool_name
    results = mcp.get_tool_schema(args.server_name, tool_input)
    print(json.dumps(results, ensure_ascii=False, indent=2))

except Exception as e:
    error_msg = f"获取工具 Schema 时发生异常: {str(e)}"
    print(json.dumps([{"error": error_msg}], ensure_ascii=False))
