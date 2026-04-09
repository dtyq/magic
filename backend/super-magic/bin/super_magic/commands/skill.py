"""Skill 子命令实现"""
import asyncio
import sys
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from typing import List

# 添加项目根目录到 sys.path
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from agentlang.skills import SkillManager
from ..utils import get_skills_dirs, format_output

console = Console()


def get_skill_manager() -> SkillManager:
    """获取 SkillManager 实例

    Returns:
        SkillManager 实例
    """
    skills_dirs = get_skills_dirs()
    return SkillManager(skills_dirs=skills_dirs)


@click.group()
def skill():
    """Skill 管理命令"""
    pass


@skill.command('list')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['json', 'csv', 'table']),
              default='json',
              help='输出格式')
@click.option('--all', '-a', 'show_all',
              is_flag=True,
              help='显示所有 skills（包括未启用的）')
def list_skills(output_format: str, show_all: bool):
    """列出所有可用的 skills"""
    async def _list():
        try:
            manager = get_skill_manager()
            skills = await manager.list_skills(enabled_only=not show_all)

            if not skills:
                console.print("[yellow]未找到任何 skill[/yellow]")
                return

            # 准备数据
            output_data = {
                'skill_count': len(skills),
                'skills': [
                    {
                        'name': s.name,
                        'description': s.description,
                        'enabled': s.enabled,
                        'tags': s.tags
                    }
                    for s in skills
                ]
            }

            if output_format == 'table':
                table = Table(title=f"Skill 列表 (共 {len(skills)} 个)")
                table.add_column("名称", style="cyan", no_wrap=True)
                table.add_column("描述", style="white")

                for skill in sorted(skills, key=lambda s: s.name):
                    table.add_row(
                        skill.name,
                        skill.description
                    )

                console.print(table)

            else:
                # JSON 或 CSV 格式
                console.print(format_output(output_data, output_format))

        except click.Abort:
            raise
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")
            import traceback
            console.print(f"[red]{traceback.format_exc()}[/red]")
            raise click.Abort()

    asyncio.run(_list())


@skill.command('read')
@click.argument('names', required=True)
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['text', 'json']),
              default='text',
              help='输出格式')
def read_skills(names: str, output_format: str):
    """读取 skill 的完整内容

    NAMES: skill 名称，支持逗号分隔的多个名称，例如: creating-slides,canvas-designer
    """
    async def _read():
        try:
            manager = get_skill_manager()
            skill_names = [name.strip() for name in names.split(',')]

            results = []
            not_found = []

            for skill_name in skill_names:
                skill = await manager.get_skill(skill_name)
                if skill:
                    results.append({
                        'name': skill.name,
                        'description': skill.description,
                        'content': skill.content,
                        'skill_dir': str(skill.skill_dir) if skill.skill_dir else None
                    })
                else:
                    not_found.append(skill_name)

            # 输出结果
            if output_format == 'text':
                for i, result in enumerate(results):
                    if i > 0:
                        console.print("\n" + "=" * 80 + "\n")

                    # console.print(f"[cyan]Loading: {result['name']}[/cyan]")
                    # if result['skill_dir']:
                    #     console.print(f"[yellow]Base directory: {result['skill_dir']}[/yellow]")
                    console.print()
                    console.print(result['content'])
            else:
                console.print(format_output(results, output_format))

            # 输出未找到的 skills
            if not_found:
                console.print(f"\n[yellow]未找到的 skills: {', '.join(not_found)}[/yellow]")

            if not results:
                sys.exit(1)

        except click.Abort:
            raise
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")
            import traceback
            console.print(f"[red]{traceback.format_exc()}[/red]")
            raise click.Abort()

    asyncio.run(_read())


@skill.command('references')
@click.argument('skill_name', required=True)
@click.argument('ref_files', required=True)
def read_references(skill_name: str, ref_files: str):
    """读取 skill 的 reference 文档

    SKILL_NAME: skill 名称

    REF_FILES: reference 文件名，支持逗号分隔的多个文件，例如: image-generation.md,image-search.md
    """
    async def _read_refs():
        try:
            manager = get_skill_manager()
            ref_names = [name.strip() for name in ref_files.split(',')]

            results = []
            not_found = []

            for ref_file in ref_names:
                try:
                    content = await manager.get_reference_content(skill_name, ref_file)
                    results.append({
                        'reference': ref_file,
                        'content': content
                    })
                except Exception as e:
                    not_found.append((ref_file, str(e)))

            # 输出结果
            for i, result in enumerate(results):
                if i > 0:
                    console.print("\n" + "=" * 80 + "\n")

                console.print(f"[cyan]Loading: {result['reference']}[/cyan]")
                console.print(f"[yellow]From skill: {skill_name}[/yellow]")
                console.print()
                console.print(result['content'])

            # 输出未找到的 references
            if not_found:
                console.print(f"\n[yellow]未找到的 reference 文档:[/yellow]")
                for ref_file, error in not_found:
                    console.print(f"  - {ref_file}: {error}")

            if not results:
                sys.exit(1)

        except click.Abort:
            raise
        except Exception as e:
            console.print(f"[red]错误: {e}[/red]")
            import traceback
            console.print(f"[red]{traceback.format_exc()}[/red]")
            raise click.Abort()

    asyncio.run(_read_refs())
