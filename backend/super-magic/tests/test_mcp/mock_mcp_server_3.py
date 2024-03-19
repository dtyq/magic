#!/usr/bin/env python3
"""第三个模拟 MCP 服务器 - 提供文本处理工具"""

import asyncio
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from pydantic import AnyUrl
import mcp.types as types


# 创建服务器实例
server = Server("mock-mcp-server-3")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """返回可用工具列表"""
    return [
        Tool(
            name="uppercase",
            description="将文本转换为大写",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要转换的文本"}
                },
                "required": ["text"]
            }
        ),
        Tool(
            name="word_count",
            description="统计文本中的单词数量",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要统计的文本"}
                },
                "required": ["text"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """处理工具调用"""
    
    if name == "uppercase":
        text = arguments.get("text", "")
        result = text.upper()
        return [TextContent(type="text", text=f"Uppercase: {result}")]
    
    elif name == "word_count":
        text = arguments.get("text", "")
        word_count = len(text.split())
        return [TextContent(type="text", text=f"Word count: {word_count}")]
    
    else:
        raise ValueError(f"未知工具: {name}")


async def main():
    """运行服务器"""
    # 使用 stdio 服务器
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="mock-mcp-server-3",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main()) 