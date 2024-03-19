"""Tool 子命令实现"""
import json
import asyncio
import click
import aiofiles
from rich.console import Console
from rich.table import Table
from typing import Dict, Any

from ..utils import get_config_path, format_output, truncate_text

console = Console()


async def load_tool_definitions() -> Dict[str, Any]:
    """异步加载工具定义文件

    Returns:
        工具定义字典，如果文件不存在则返回空字典

    Raises:
        json.JSONDecodeError: JSON 格式错误
    """
    config_path = get_config_path()

    if not await asyncio.to_thread(config_path.exists):
        return {
            'version': '1.0',
            'generated_at': '',
            'tool_count': 0,
            'tools': {}
        }

    async with aiofiles.open(config_path, 'r', encoding='utf-8') as f:
        content = await f.read()
        return json.loads(content)


@click.group()
def tool():
    """工具管理命令"""
    pass


@tool.command('list')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['json', 'csv', 'table']),
              default='json',
              help='输出格式')
def list_tools(output_format: str):
    """列出所有工具"""
    async def _list():
        try:
            definitions = await load_tool_definitions()
            tools = definitions.get('tools', {})

            if not tools:
                console.print("[yellow]未找到匹配的工具[/yellow]")
                return

            # 准备数据
            tools_list = [
                {
                    'name': name,
                    'description': tool_data.get('description', '')
                }
                for name, tool_data in sorted(tools.items())
            ]
            output_data = {
                'tool_count': len(tools),
                'tools': tools_list
            }

            # 格式化输出
            if output_format == 'table':
                table = Table(title=f"工具列表 (共 {len(tools)} 个)")
                table.add_column("名称", style="cyan", no_wrap=True)
                table.add_column("描述", style="white")

                for item in tools_list:
                    desc = item['description'].split('\n')[0]  # 只取第一行
                    table.add_row(
                        item['name'],
                        desc
                    )

                console.print(table)

            else:
                # JSON 或 CSV 格式
                console.print(format_output(output_data, output_format))

        except json.JSONDecodeError as e:
            console.print(f"[red]配置文件格式错误: {e}[/red]")
            raise click.Abort()
        except Exception as e:
            console.print(f"[red]未知错误: {e}[/red]")
            raise click.Abort()

    asyncio.run(_list())


@tool.command('get')
@click.argument('names', required=True)
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['json']),
              default='json',
              help='输出格式')
def get_tools(names: str, output_format: str):
    """获取指定工具的详细信息

    NAMES: 工具名称，支持逗号分隔的多个名称，例如: create_slide,analysis_slide_webpage
    """
    async def _get():
        try:
            definitions = await load_tool_definitions()
            all_tools = definitions.get('tools', {})

            # 解析工具名称列表
            tool_names = [name.strip() for name in names.split(',')]

            # 获取工具信息
            result = {}
            not_found = []

            for name in tool_names:
                if name in all_tools:
                    # 过滤掉不需要的字段
                    tool_data = all_tools[name].copy()
                    tool_data.pop('module_path', None)
                    tool_data.pop('class_name', None)
                    result[name] = tool_data
                else:
                    not_found.append(name)

            # 输出结果
            if result:
                console.print(format_output(result, 'json'))

            # 输出未找到的工具
            if not_found:
                console.print(f"\n[yellow]未找到的工具: {', '.join(not_found)}[/yellow]")

            if not result:
                raise click.Abort()

        except json.JSONDecodeError as e:
            console.print(f"[red]配置文件格式错误: {e}[/red]")
            raise click.Abort()
        except Exception as e:
            console.print(f"[red]未知错误: {e}[/red]")
            raise click.Abort()

    asyncio.run(_get())


@tool.command('schema')
@click.argument('names', required=True)
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['json']),
              default='json',
              help='输出格式')
def get_schema(names: str, output_format: str):
    """获取工具的参数 schema

    NAMES: 工具名称，支持逗号分隔的多个名称，例如: create_slide,analysis_slide_webpage
    """
    async def _get_schema():
        try:
            definitions = await load_tool_definitions()
            all_tools = definitions.get('tools', {})

            # 解析工具名称列表
            tool_names = [name.strip() for name in names.split(',')]

            # 获取工具 schema
            result = {}
            not_found = []

            for name in tool_names:
                if name in all_tools:
                    tool_data = all_tools[name]
                    result[name] = tool_data.get('parameters_schema', {})
                else:
                    not_found.append(name)

            # 输出结果
            if result:
                console.print(format_output(result, 'json'))

            # 输出未找到的工具
            if not_found:
                console.print(f"\n[yellow]未找到的工具: {', '.join(not_found)}[/yellow]")

            if not result:
                raise click.Abort()

        except json.JSONDecodeError as e:
            console.print(f"[red]配置文件格式错误: {e}[/red]")
            raise click.Abort()
        except Exception as e:
            console.print(f"[red]未知错误: {e}[/red]")
            raise click.Abort()

    asyncio.run(_get_schema())
