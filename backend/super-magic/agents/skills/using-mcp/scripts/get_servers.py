#!/usr/bin/env python3
"""
获取当前 chat 的 MCP 服务器列表

按需连接模式下返回全量配置，包括尚未连接的服务器。

输出格式：JSON 数组，每个元素包含字段：
    name         服务器内部名称
    label_name   服务器显示名称
    description  服务器用途描述（用于判断是否需要调用）
    source       配置来源（global_config / client_config）
    status       连接状态：connected 或 disconnected
    tool_count   已发现的工具数量（未连接时为 0）
    tools        已发现的工具名称列表（未连接时为空数组）
    error        错误信息（正常时为 null）
    next_action  下一步建议的操作提示（未连接时提示调用 connect_server.py；已连接时提示直接走 schema/call）
"""
import json

from sdk.mcp import mcp


def _build_next_action(server: dict) -> str:
    """给每条服务器生成一句面向 agent 的下一步提示。"""
    name = server.get("name") or ""
    status = server.get("status")
    if status == "disconnected":
        return (
            f"Not connected yet. Run `python scripts/connect_server.py --server-name {name}` "
            f"to connect and fetch its real tool list before any tool call."
        )
    if status == "connected":
        return (
            "Already connected. Use `python scripts/get_tool_schema.py --server-name "
            f"{name} --tool-name <tool>` for parameters, then call via "
            "`mcp.call(server_name, tool_name, tool_params)`."
        )
    return f"Unknown status: {status!r}. Inspect the entry before further action."


try:
    servers = mcp.get_servers()
    for server in servers:
        server["next_action"] = _build_next_action(server)
    print(json.dumps(servers, ensure_ascii=False, indent=2))

except Exception as e:
    error_msg = f"获取服务器列表时发生异常: {str(e)}"
    print(json.dumps({"error": error_msg}, ensure_ascii=False))
