"""
SDK 包

提供简化的工具调用接口

使用示例:
    from sdk.tool import tool
    from sdk.result import Result
    from sdk.llm import create_openai_client

    # 调用工具（含 MCP 工具：mcp_list_servers / mcp_call_tool 等）
    result = tool.call('tool_name', {'param': 'value'})

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

from sdk.async_file_utils import (
    async_copy2,
    async_exists,
    async_file_lock,
    async_is_dir,
    async_is_file,
    async_mkdir,
    async_move_file,
    async_read_bytes,
    async_read_json,
    async_read_text,
    async_stat,
    async_try_read_json,
    async_unlink,
    async_write_bytes,
    async_write_json,
    async_write_text,
)
from sdk.llm import create_openai_client, create_openai_sync_client, file_to_url, image_to_base64
from sdk.result import Result
from sdk.script_output import (
    SuperMagicArgumentParser,
    build_markdown_tool_detail,
    print_json,
    print_script_result,
    print_super_magic_tool_detail,
)
from sdk.tool import ToolSDK, get_tool, tool
from sdk.workspace import (
    get_project_root,
    get_workspace_path,
    get_workspace_relative_path,
    get_workspace_root,
    resolve_project_path,
    resolve_workspace_file_path,
)

__all__ = [
    'Result',
    'SuperMagicArgumentParser',
    'ToolSDK',
    'async_copy2',
    'async_exists',
    'async_file_lock',
    'async_is_dir',
    'async_is_file',
    'async_mkdir',
    'async_move_file',
    'async_read_bytes',
    'async_read_json',
    'async_read_text',
    'async_stat',
    'async_try_read_json',
    'async_unlink',
    'async_write_bytes',
    'async_write_json',
    'async_write_text',
    'build_markdown_tool_detail',
    'create_openai_client',
    'create_openai_sync_client',
    'file_to_url',
    'get_project_root',
    'get_tool',
    'get_workspace_path',
    'get_workspace_relative_path',
    'get_workspace_root',
    'image_to_base64',
    'print_json',
    'print_script_result',
    'print_super_magic_tool_detail',
    'resolve_project_path',
    'resolve_workspace_file_path',
    'tool',
]
