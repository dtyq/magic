"""本地 CLI 状态探测入口。

外部只依赖 CliStatusFactory，不直接感知具体平台 CLI 的探测实现。
"""

from app.service.cli_status.factory import CliStatusFactory
from app.service.cli_status.common import CliCommandResult, CliCommandRunner, CliStatusProbe

__all__ = [
    "CliCommandResult",
    "CliCommandRunner",
    "CliStatusFactory",
    "CliStatusProbe",
]
