"""命令分发器：按优先级遍历已注册的 handler，找到第一个匹配项执行。

使用方式：
    result = await DISPATCHER.dispatch(command, params, base_dir)
    if result.intercepted is not None:
        return result.intercepted
    if result.work_dir is not None:
        work_dir = result.work_dir
"""
from pathlib import Path
from typing import TYPE_CHECKING

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler
from app.tools.shell_exec_utils.handlers.auto_background_handler import AutoBackgroundHandler
from app.tools.shell_exec_utils.handlers.skillhub_handler import SkillhubCommandHandler
from app.tools.shell_exec_utils.handlers.super_magic_handler import SuperMagicCommandHandler

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams


class CommandDispatcher:
    """持有有序的 handler 列表，将命令分发给第一个匹配的 handler。"""

    def __init__(self, handlers: list[ShellCommandHandler]) -> None:
        # 按 priority 降序排列，数值越大越先匹配
        self._handlers = sorted(handlers, key=lambda h: h.priority, reverse=True)

    async def dispatch(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        """将命令分发给匹配的 handler。

        Args:
            command: 去除首尾空白后的完整命令字符串。
            params:  原始工具调用参数。
            base_dir: 工具的默认基础工作目录。

        Returns:
            CommandHandleResult。若无 handler 匹配，返回空结果（两个字段均为 None）。
        """
        for handler in self._handlers:
            if handler.matches(command):
                return await handler.handle(command, params, base_dir)
        return CommandHandleResult()


# 全局分发器实例，按优先级排列 handler，新增处理器在此追加即可
DISPATCHER = CommandDispatcher([
    SuperMagicCommandHandler(),
    SkillhubCommandHandler(),
    AutoBackgroundHandler(),
])
