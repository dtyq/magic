#!/usr/bin/env python3
"""
显式连接指定 MCP 服务器

参数：
    --server-name: 必填，待连接的 MCP 服务器名称

语义：触发该服务器的实际连接与工具发现（按需连接模式）。
前置要求：该服务器配置已存在于当前 chat 的 MCP store（由用户配置或通过 add_server.py 注入）。

输出格式：JSON
成功字段：ok(true), name, status ("connected"), tool_count, tools, duration, error (null)
失败字段：ok(false), name, status, tool_count, tools, error
"""
import json
import argparse
import sys

from sdk.mcp import mcp

parser = argparse.ArgumentParser(description="显式连接 MCP 服务器")
parser.add_argument("--server-name", type=str, required=True, help="待连接的 MCP 服务器名称")
args = parser.parse_args()

try:
    result = mcp.connect_server(server_name=args.server_name)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok", False):
        sys.exit(1)

except Exception as e:
    print(
        json.dumps(
            {"ok": False, "name": args.server_name, "error": f"连接 MCP 服务器时发生异常: {str(e)}"},
            ensure_ascii=False,
        )
    )
    sys.exit(1)
