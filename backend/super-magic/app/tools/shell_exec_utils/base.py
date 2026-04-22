"""shell 命令特殊处理器的抽象接口与结果类。

新增命令特殊处理只需：
1. 继承 ShellCommandHandler 并实现 matches / handle
2. 将实例追加到 shell_exec.py 的 _COMMAND_HANDLERS 列表
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.core.entity.tool.tool_result_types import TerminalToolResult
    from app.tools.core import BaseToolParams


@dataclass
class CommandHandleResult:
    """handler 处理命令后返回的结果。

    intercepted:      非 None 时直接作为工具结果返回，命令不再交给真实 shell 执行。
    work_dir:         非 None 时覆盖 execute() 中的默认工作目录。
    force_background: True 时强制开启后台模式，等同于调用方传入 allow_background=True。
    before_hint:      非 None 时在命令执行前推送到 horizon，供 LLM 参考。
    matched_handler:  dispatch 时匹配到的 handler 实例，用于执行后回调 after_hint()。
    """
    intercepted: Optional["TerminalToolResult"] = field(default=None)
    work_dir: Optional[Path] = field(default=None)
    force_background: bool = field(default=False)
    before_hint: Optional[str] = field(default=None)
    matched_handler: Optional["ShellCommandHandler"] = field(default=None)


class ShellCommandHandler(ABC):
    """shell 命令特殊处理器基类。

    子类通过 matches() 声明自己关心哪些命令，
    通过 handle() 实现对应的拦截或工作目录调整逻辑，
    通过 after_hint() 在执行结果确定后返回需推送到 horizon 的提示。

    priority: 数值越大优先级越高，dispatcher 按降序排列后依次匹配。
              默认值为 0，仅当多个 handler 可能匹配同一命令时才需要显式设置。
    """

    priority: int = 0

    @abstractmethod
    def matches(self, command: str) -> bool:
        """判断是否处理该命令。

        Args:
            command: 去除首尾空白后的完整命令字符串。

        Returns:
            True 表示由本 handler 处理。
        """

    @abstractmethod
    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        """执行命令的特殊处理逻辑。

        Args:
            command: 去除首尾空白后的完整命令字符串。
            params:  原始工具调用参数。
            base_dir: 工具的默认基础工作目录。

        Returns:
            CommandHandleResult，intercepted 或 work_dir 二选一或都填充。
        """

    def after_hint(self, command: str, result: "TerminalToolResult") -> Optional[str]:
        """根据执行结果决定是否推送提示到 horizon。

        Args:
            command: 去除首尾空白后的完整命令字符串。
            result:  命令执行结果。

        Returns:
            需要推送的提示字符串，无需推送时返回 None。
        """
        return None
