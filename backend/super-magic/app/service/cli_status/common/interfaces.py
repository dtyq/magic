"""CLI 状态探测的公共接口约束。

公共层只定义跨平台复用的输入输出协议，不承载具体 CLI 的业务解析。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(frozen=True)
class CliCommandResult:
    """短时只读 CLI 探测命令的执行结果。

    provider 只能基于这些字段生成脱敏摘要，不能把原始输出直接写入 Horizon。
    """

    argv: tuple[str, ...]
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    elapsed_seconds: float = 0.0

    @property
    def combined_output(self) -> str:
        """合并 stdout/stderr，便于错误场景做状态归一化判断。"""
        return "\n".join(part for part in (self.stdout, self.stderr) if part)


@dataclass(frozen=True)
class CliStatusSnapshot:
    """单个 CLI 可注入 Horizon 的最小结构。

    provider 内部自行完成安装、配置、登录态等判断；对外只暴露 CLI 名称和
    已脱敏的 Horizon 文本。horizon 为空表示该 CLI 当前不需要注入。
    """

    cli: str
    horizon: str = ""

    @property
    def has_horizon(self) -> bool:
        """Factory 只根据非空 horizon 决定是否拼接。"""
        return bool(self.horizon.strip())


class CliCommandRunner(Protocol):
    """CLI 命令执行器协议，方便单测用 mock runner 替换真实子进程。"""

    async def __call__(self, argv: Sequence[str], timeout: float) -> CliCommandResult:
        ...


class CliStatusProbe(ABC):
    """平台 CLI 探测接口。

    每个 provider 只负责自己的 CLI 状态判断，并返回可直接拼接的脱敏 Horizon 文本。
    """

    cli_name: str

    @abstractmethod
    async def detect(self) -> CliStatusSnapshot:
        """返回单个 CLI 的最小 Horizon 注入结构。"""
