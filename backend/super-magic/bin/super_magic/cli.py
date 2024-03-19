"""Super Magic CLI 主程序"""
import click
from super_magic import __version__
from super_magic.commands.tool import tool
from super_magic.commands.skill import skill


@click.group()
@click.version_option(version=__version__)
def cli():
    """Super Magic CLI - 工具和 Skill 查询命令行工具

    使用示例:

        # 列出所有工具
        python bin/super-magic.py tool list

        # 获取工具详情
        python bin/super-magic.py tool get create_slide

        # 列出所有 skills
        python bin/super-magic.py skill list

        # 读取 skill 内容
        python bin/super-magic.py skill read creating-slides
    """
    pass


# 注册子命令
cli.add_command(tool)
cli.add_command(skill)


if __name__ == '__main__':
    cli()
