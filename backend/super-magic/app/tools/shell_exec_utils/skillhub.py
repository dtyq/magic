"""skillhub 虚拟命令处理器

skillhub CLI 本身不支持的命令（remove、install-github）由此模块拦截并内部实现。
"""
import shlex
from typing import Optional

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result import TerminalToolResult

logger = get_logger(__name__)


async def handle_skillhub(command: str) -> Optional[TerminalToolResult]:
    """拦截 skillhub 虚拟命令，内部按子命令分发处理

    仅处理 CLI 本身不支持的子命令，其余命令返回 None 交给真实 CLI 执行。

    Args:
        command: 完整命令字符串

    Returns:
        TerminalToolResult，或 None（非虚拟命令，继续正常执行）
    """
    parts = shlex.split(command)
    if len(parts) < 2 or parts[0] != "skillhub":
        return None

    subcommand = parts[1]

    if subcommand == "remove":
        return await _handle_remove(command, parts)

    if subcommand == "install-github":
        return await _handle_install_github(command, parts)

    if subcommand == "install-platform-me":
        return await _handle_install_platform_me(command, parts)

    if subcommand == "install-platform-market":
        return await _handle_install_platform_market(command, parts)

    return None


async def _handle_remove(command: str, parts: list) -> TerminalToolResult:
    from app.core.skill_manager import skillhub_remove

    if len(parts) < 3:
        return TerminalToolResult(content="usage: skillhub remove <name-or-slug>", command=command, exit_code=1)

    success, message = await skillhub_remove(parts[2])
    return TerminalToolResult(content=message, command=command, exit_code=0 if success else 1)


async def _handle_install_github(command: str, parts: list) -> TerminalToolResult:
    from app.core.skill_manager import skillhub_install_github

    if len(parts) < 3:
        return TerminalToolResult(content="usage: skillhub install-github <github-url>", command=command, exit_code=1)

    success, message = await skillhub_install_github(parts[2])
    return TerminalToolResult(content=message, command=command, exit_code=0 if success else 1)


async def _handle_install_platform_me(command: str, parts: list) -> TerminalToolResult:
    from app.core.skill_manager import skillhub_install_platform_me

    if len(parts) < 3:
        return TerminalToolResult(content="usage: skillhub install-platform-me <skill-code>", command=command, exit_code=1)

    success, message = await skillhub_install_platform_me(parts[2])
    return TerminalToolResult(content=message, command=command, exit_code=0 if success else 1)


async def _handle_install_platform_market(command: str, parts: list) -> TerminalToolResult:
    from app.core.skill_manager import skillhub_install_platform_market

    if len(parts) < 3:
        return TerminalToolResult(content="usage: skillhub install-platform-market <skill-code>", command=command, exit_code=1)

    success, message = await skillhub_install_platform_market(parts[2])
    return TerminalToolResult(content=message, command=command, exit_code=0 if success else 1)
