"""
SDK 包

提供简化的工具调用接口

使用示例:
    from sdk.tool import tool
    from sdk.mcp import mcp
    from sdk.result import Result
    from sdk.llm import create_openai_client

    # 调用工具
    result = tool.call('tool_name', {'param': 'value'})

    # 调用 MCP 工具
    result = mcp.call('server_name', 'tool_name', {'param': 'value'})

    # 检查结果
    if result.ok:
        print(result.content)

    # 创建异步 LLM 客户端（用于 async 上下文）
    client = await create_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "hello"}],
    )

    # 创建同步 LLM 客户端（用于普通脚本）
    client = create_openai_sync_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "hello"}],
    )
"""

from sdk.tool import ToolSDK, tool, get_tool
from sdk.mcp import McpSDK, mcp, get_mcp
from sdk.result import Result
from sdk.llm import create_openai_client, create_openai_sync_client, file_to_url, image_to_base64

__all__ = [
    'ToolSDK',
    'tool',
    'get_tool',
    'McpSDK',
    'mcp',
    'get_mcp',
    'Result',
    'create_openai_client',
    'create_openai_sync_client',
    'file_to_url',
    'image_to_base64',
]
