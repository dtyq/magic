"""包管理器安装命令超时时，提示大模型使用镜像源。

handler 不拦截命令，仅在 CommandHandleResult.timeout_hint 中填入对应的镜像源建议。
shell_exec.execute() 检测到超时后，若 timeout_hint 非空则将其推送到 horizon。

新增包管理器只需在 _PKG_MIRROR_RULES 中追加 (pattern, hint) 即可。
"""
import re
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler

if TYPE_CHECKING:
    from app.core.entity.tool.tool_result_types import TerminalToolResult
    from app.tools.core import BaseToolParams


_PKG_MIRROR_RULES: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"^(npm|npx)\s+(install|i|ci)\b"),
        "[Mirror Hint] npm install timed out — likely a network issue. "
        "Search the web for 'npm mirror registry' to find a faster registry, "
        "then retry with --registry=<mirror_url> or set it permanently via npm config.",
    ),
    (
        re.compile(r"^pip[23]?\s+install\b"),
        "[Mirror Hint] pip install timed out — likely a network issue. "
        "Search the web for 'pip mirror index' to find a faster PyPI mirror, "
        "then retry with -i <mirror_url>.",
    ),
    (
        re.compile(r"^yarn\s+(install|add)\b"),
        "[Mirror Hint] yarn timed out — likely a network issue. "
        "Search the web for 'yarn mirror registry' to find a faster registry, "
        "then set it via yarn config set registry <mirror_url>.",
    ),
    (
        re.compile(r"^pnpm\s+(install|add|i)\b"),
        "[Mirror Hint] pnpm timed out — likely a network issue. "
        "Search the web for 'pnpm mirror registry' to find a faster registry, "
        "then retry with --registry=<mirror_url> or set it permanently via pnpm config.",
    ),
    (
        re.compile(r"^apt(-get)?\s+install\b"),
        "[Mirror Hint] apt install timed out — likely a network issue. "
        "Search the web for 'apt sources.list mirror' for this OS version to find a faster mirror, "
        "then update /etc/apt/sources.list accordingly.",
    ),
    (
        re.compile(r"^brew\s+install\b"),
        "[Mirror Hint] brew install timed out — likely a network issue. "
        "Search the web for 'homebrew mirror' to find a faster mirror, "
        "then set the relevant HOMEBREW_*_GIT_REMOTE and HOMEBREW_BOTTLE_DOMAIN environment variables.",
    ),
    (
        re.compile(r"^cargo\s+(add|install)\b"),
        "[Mirror Hint] cargo timed out — likely a network issue. "
        "Search the web for 'cargo crates.io mirror' to find a faster registry mirror, "
        "then configure it in ~/.cargo/config.toml.",
    ),
    (
        re.compile(r"^go\s+(get|install)\b"),
        "[Mirror Hint] go timed out — likely a network issue. "
        "Search the web for 'GOPROXY mirror' to find a faster Go module proxy, "
        "then set it via: export GOPROXY=<mirror_url>,direct",
    ),
]


class PkgMirrorHandler(ShellCommandHandler):
    """为包管理器安装命令附加镜像源提示（仅在超时时生效）。

    本 handler 不拦截命令，仅设置 timeout_hint，由 shell_exec.execute() 在超时时推送。
    """

    priority: int = -20

    def matches(self, command: str) -> bool:
        return any(pattern.match(command) for pattern, _ in _PKG_MIRROR_RULES)

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        return CommandHandleResult()

    def after_hint(self, command: str, result: "TerminalToolResult") -> Optional[str]:
        if "timed out" not in (result.content or "").lower():
            return None
        for pattern, hint in _PKG_MIRROR_RULES:
            if pattern.match(command):
                return hint
        return None
