"""python bin/super-magic.py 命令的特殊处理器。

当命令以 `python bin/super-magic.py` 开头且未显式指定 cwd 时，
将工作目录上调一层到项目根目录（base_dir 的父级）。
"""
from pathlib import Path
from typing import TYPE_CHECKING

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams

_PREFIX = "python bin/super-magic.py"


class SuperMagicCommandHandler(ShellCommandHandler):
    """将 `python bin/super-magic.py` 的工作目录调整到项目根。"""

    def matches(self, command: str) -> bool:
        return command.startswith(_PREFIX)

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        # 仅在未显式指定 cwd 时才覆盖工作目录
        if not params.cwd:
            return CommandHandleResult(work_dir=base_dir.parent)
        return CommandHandleResult()
