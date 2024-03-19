#!/usr/bin/env python3
"""第二个模拟 MCP 服务器 - 提供不同的工具集"""

import asyncio
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from pydantic import AnyUrl
import mcp.types as types


# 创建服务器实例
server = Server("mock-mcp-server-2")


@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """返回可用工具列表"""
    return [
        Tool(
            name="multiply",
            description="计算两个数字的乘积",
            inputSchema={
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "第一个数字"},
                    "y": {"type": "number", "description": "第二个数字"}
                },
                "required": ["x", "y"]
            }
        ),
        Tool(
            name="greet",
            description="生成个性化问候语",
            inputSchema={
                "type": "object", 
                "properties": {
                    "name": {"type": "string", "description": "要问候的人名"},
                    "language": {"type": "string", "description": "问候语言", "default": "zh"}
                },
                "required": ["name"]
            }
        ),
        Tool(
            name="divide",
            description="计算两个数字的除法（可能出错）",
            inputSchema={
                "type": "object",
                "properties": {
                    "dividend": {"type": "number", "description": "被除数"},
                    "divisor": {"type": "number", "description": "除数"}
                },
                "required": ["dividend", "divisor"]
            }
        )
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    """处理工具调用"""
    
    if name == "multiply":
        x = arguments.get("x", 0)
        y = arguments.get("y", 0)
        result = x * y
        return [TextContent(type="text", text=f"Product: {result}")]
    
    elif name == "greet":
        name_arg = arguments.get("name", "朋友")
        language = arguments.get("language", "zh")
        
        if language == "en":
            greeting = f"Hello, {name_arg}!"
        else:
            greeting = f"你好, {name_arg}!"
            
        return [TextContent(type="text", text=greeting)]
    
    elif name == "divide":
        dividend = arguments.get("dividend", 0)
        divisor = arguments.get("divisor", 1)
        
        if divisor == 0:
            raise RuntimeError("除数不能为零")
        
        result = dividend / divisor
        return [TextContent(type="text", text=f"Quotient: {result}")]
    
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
                server_name="mock-mcp-server-2",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main()) 