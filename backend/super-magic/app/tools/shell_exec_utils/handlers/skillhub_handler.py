"""skillhub 命令的特殊处理器。

负责两件事：
1. 将 CLI 本身不支持的子命令（remove / install-github / install-platform-*）
   委托给 skillhub.handle_skillhub() 拦截并直接返回结果。
2. 对于 CLI 原生支持的子命令，将工作目录调整到 skills 目录的父级（.magic/），
   除非命令中已通过 --dir 显式指定了安装目录。
"""
from pathlib import Path
from typing import TYPE_CHECKING

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler
from app.tools.shell_exec_utils.handlers.skillhub import handle_skillhub

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams


class SkillhubCommandHandler(ShellCommandHandler):
    """处理所有以 `skillhub` 开头的命令。"""

    def matches(self, command: str) -> bool:
        return command.startswith("skillhub")

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        # 先尝试拦截 CLI 不支持的虚拟子命令
        intercepted = await handle_skillhub(command)
        if intercepted is not None:
            return CommandHandleResult(intercepted=intercepted)

        # CLI 原生子命令：调整工作目录到 skills 父级，除非已用 --dir 显式指定
        if "--dir" not in command:
            from app.core.skill_utils.constants import get_workspace_skills_dir
            work_dir = (await get_workspace_skills_dir()).parent
            return CommandHandleResult(work_dir=work_dir)

        return CommandHandleResult()
