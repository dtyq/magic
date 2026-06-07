"""CLI 状态探测的公共基础能力。"""

from app.service.cli_status.common.interfaces import CliCommandResult, CliCommandRunner, CliStatusProbe, CliStatusSnapshot

__all__ = [
    "CliCommandResult",
    "CliCommandRunner",
    "CliStatusProbe",
    "CliStatusSnapshot",
]
