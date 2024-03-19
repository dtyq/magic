"""模拟 MCP 服务器

用于单元测试的简单 MCP 服务器实现。
"""

import asyncio
import json
import sys
from typing import Dict, Any, List

from mcp import types
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio


class MockMCPServer:
    """模拟 MCP 服务器，提供基本的工具支持"""
    
    def __init__(self):
        self.server = Server("mock-mcp-server")
        self._setup_tools()
    
    def _setup_tools(self):
        """设置模拟工具"""
        
        @self.server.list_tools()
        async def handle_list_tools() -> List[types.Tool]:
            """返回可用工具列表"""
            return [
                types.Tool(
                    name="echo",
                    description="回显输入的消息",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": "要回显的消息"
                            }
                        },
                        "required": ["message"]
                    }
                ),
                types.Tool(
                    name="add",
                    description="计算两个数字的和",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "a": {
                                "type": "number",
                                "description": "第一个数字"
                            },
                            "b": {
                                "type": "number",
                                "description": "第二个数字"
                            }
                        },
                        "required": ["a", "b"]
                    }
                ),
                types.Tool(
                    name="error_tool",
                    description="故意抛出错误的工具",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                ),
                types.Tool(
                    name="get_user_info",
                    description="获取用户信息，返回 JSON 格式",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "用户ID"
                            }
                        },
                        "required": ["user_id"]
                    }
                ),
                types.Tool(
                    name="validation_error",
                    description="返回验证错误信息的工具",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "data": {
                                "type": "string",
                                "description": "要验证的数据"
                            }
                        },
                        "required": ["data"]
                    }
                )
            ]
        
        @self.server.call_tool()
        async def handle_call_tool(
            name: str, arguments: Dict[str, Any]
        ) -> List[types.TextContent]:
            """处理工具调用"""
            if name == "echo":
                message = arguments.get("message", "")
                return [
                    types.TextContent(
                        type="text",
                        text=f"Echo: {message}"
                    )
                ]
            elif name == "add":
                a = arguments.get("a", 0)
                b = arguments.get("b", 0)
                result = a + b
                return [
                    types.TextContent(
                        type="text",
                        text=f"Result: {result}"
                    )
                ]
            elif name == "error_tool":
                raise RuntimeError("这是一个故意的错误")
            elif name == "get_user_info":
                user_id = arguments.get("user_id", "unknown")
                user_data = {
                    "user_id": user_id,
                    "name": f"User {user_id}",
                    "email": f"{user_id}@example.com",
                    "age": 25,
                    "is_active": True,
                    "roles": ["user", "member"],
                    "metadata": {
                        "created_at": "2024-01-01T00:00:00Z",
                        "last_login": "2024-01-15T10:30:00Z"
                    }
                }
                # 返回 JSON 字符串
                return [
                    types.TextContent(
                        type="text",
                        text=json.dumps(user_data, indent=2, ensure_ascii=False)
                    )
                ]
            elif name == "validation_error":
                data = arguments.get("data", "")
                # 根据 MCP 官方文档，工具执行错误应该通过抛出异常来设置 isError=True
                error_response = {
                    "error": "ValidationError",
                    "message": f"数据验证失败: '{data}' 不符合预期格式",
                    "details": {
                        "field": "data",
                        "value": data,
                        "expected": "符合特定格式的字符串",
                        "code": "VALIDATION_FAILED"
                    }
                }
                # 抛出异常以设置 isError=True，异常消息包含 JSON 数据
                raise Exception(json.dumps(error_response, indent=2, ensure_ascii=False))
            else:
                raise ValueError(f"未知工具: {name}")
    
    async def run(self):
        """运行服务器"""
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="mock-mcp-server",
                    server_version="0.1.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """主函数，用于独立运行模拟服务器"""
    server = MockMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main()) 