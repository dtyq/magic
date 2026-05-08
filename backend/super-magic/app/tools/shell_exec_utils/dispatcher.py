"""命令分发器：以 pipeline 模式依次执行所有匹配的 handler。

pipeline 语义：
- 先用 bashlex 将复合命令拆分为独立子命令（支持 &&、||、;、| 等 bash 语法）
- 对每个子命令，遍历所有 handler，所有匹配的都会被执行
- 一旦某个 handler 返回 intercepted（拦截），立即停止并返回
- 未拦截时，所有匹配 handler 的 force_background / work_dir / before_hint 会叠加合并

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
from app.tools.shell_exec_utils.command_parser import extract_sub_commands
from app.tools.shell_exec_utils.handlers.auto_background_handler import AutoBackgroundHandler
from app.tools.shell_exec_utils.handlers.cli_dir_init_handler import CliDirInitHandler
from app.tools.shell_exec_utils.handlers.pkg_mirror_handler import PkgMirrorHandler
from app.tools.shell_exec_utils.handlers.skillhub_handler import SkillhubCommandHandler
from app.tools.shell_exec_utils.handlers.super_magic_handler import SuperMagicCommandHandler

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams


class CommandDispatcher:
    """持有有序的 handler 列表，以 pipeline 模式将命令分发给所有匹配的 handler。"""

    def __init__(self, handlers: list[ShellCommandHandler]) -> None:
        # 按 priority 降序排列，数值越大越先执行
        self._handlers = sorted(handlers, key=lambda h: h.priority, reverse=True)

    async def dispatch(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        """以 pipeline 模式将命令分发给所有匹配的 handler。

        先用 bashlex 将复合命令拆分为子命令列表，再对每个子命令遍历所有 handler。
        结果按字段合并：
        - intercepted: 一旦出现，立即停止 pipeline 并返回
        - force_background: 任一 handler 设为 True 则最终为 True
        - work_dir: 后匹配的覆盖先匹配的
        - before_hint: 多个 hint 用换行拼接
        - matched_handler: 记录最后一个匹配的 handler（用于 after_hint 回调）

        Args:
            command: 去除首尾空白后的完整命令字符串（可以是复合命令）。
            params:  原始工具调用参数。
            base_dir: 工具的默认基础工作目录。

        Returns:
            CommandHandleResult，合并所有匹配 handler 的处理结果。
        """
        merged = CommandHandleResult()
        hints: list[str] = []
        sub_commands = extract_sub_commands(command)

        for handler in self._handlers:
            for sub_cmd in sub_commands:
                if not handler.matches(sub_cmd.text):
                    continue
                result = await handler.handle(sub_cmd.text, params, base_dir)
                # 拦截：立即返回，不再继续
                if result.intercepted is not None:
                    result.matched_handler = handler
                    return result
                # 合并非拦截结果
                if result.force_background:
                    merged.force_background = True
                if result.work_dir is not None:
                    merged.work_dir = result.work_dir
                if result.before_hint:
                    hints.append(result.before_hint)
                merged.matched_handler = handler

        if hints:
            merged.before_hint = "\n".join(hints)
        return merged


# 全局分发器实例，按优先级排列 handler，新增处理器在此追加即可
DISPATCHER = CommandDispatcher([
    SuperMagicCommandHandler(),
    SkillhubCommandHandler(),
    CliDirInitHandler(),
    AutoBackgroundHandler(),
    PkgMirrorHandler(),
])
