"""IM CLI 工具（lark-cli / dws / wecom-cli）的持久化目录懒创建。

entrypoint.sh 启动时只建立 $HOME → USER_HOME_DIR 的软链接，不预创建目标目录。
本 handler 在 AI 首次执行对应 CLI 命令时，自动创建目标目录及其父目录，
确保软链接指向的路径可写，避免 workspace 中出现从未使用的空目录。
"""
import os
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams

# CLI 二进制名 → 该 CLI 需要的持久化配置目录（相对于 USER_HOME_DIR）
_CLI_CONFIG_DIRS: dict[str, list[str]] = {
    "lark-cli": [".lark-cli", ".local/share"],
    "dws": [".dws", ".local/share"],
    "wecom-cli": [".local/share"],
}

# 所有已知的 CLI 二进制名，用于快速前缀匹配
_CLI_BINARIES: tuple[str, ...] = tuple(_CLI_CONFIG_DIRS.keys())


class CliDirInitHandler(ShellCommandHandler):
    """在 IM CLI 命令执行前，按需创建持久化配置目录。

    不拦截命令（intercepted 始终为 None），不修改工作目录，不设后台模式。
    仅做目录创建这一个副作用，然后让命令继续流转到后续 handler。
    """

    # 优先级高于 AutoBackgroundHandler（-10），确保目录先于命令执行就绪
    priority: int = -5

    def matches(self, command: str) -> bool:
        return any(
            command == cli or command.startswith(cli + " ")
            for cli in _CLI_BINARIES
        )

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        user_home_dir = os.environ.get("USER_HOME_DIR", "")
        if not user_home_dir:
            return CommandHandleResult()

        # 提取命令中的 CLI 二进制名
        cli_name = command.split()[0] if command else ""
        config_dirs = _CLI_CONFIG_DIRS.get(cli_name, [])

        for config_dir in config_dirs:
            target = Path(user_home_dir) / config_dir
            if not target.exists():
                target.mkdir(parents=True, exist_ok=True)
                logger.info(f"[CliDirInit] 为 {cli_name} 创建持久化目录: {target}")

        return CommandHandleResult()
