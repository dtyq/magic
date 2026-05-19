"""skillhub 命令拦截器

安装类子命令（install / upgrade / install-github / install-platform-*）已被统一
迁移到 install_skills 工具。本模块拦截这些子命令并抛出 SkillInstallForbiddenError，
引导模型改用 install_skills 工具。

非安装类子命令（search / list / info 等）不受影响，仍放行给真实 CLI 执行。
"""
import shlex
from typing import Optional

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import TerminalToolResult

logger = get_logger(__name__)

# 安装类子命令黑名单（完全匹配 subcommand）
_INSTALL_SUBCOMMANDS = frozenset({
    "install",
    "upgrade",
    "install-github",
    "install-platform-me",
    "install-platform-market",
})


def _make_forbidden_result(command: str, provider: str, skill_id: str = "<id>") -> TerminalToolResult:
    """生成统一的 SkillInstallForbiddenError 提示"""
    msg = (
        "SkillInstallForbiddenError: 请使用 install_skills 工具安装 skill，而非直接执行 shell 命令。\n\n"
        f"示例：\n"
        f'  install_skills(items=[{{"provider": "{provider}", "id": "{skill_id}", "mode": "install"}}])\n\n'
        "支持的 provider：my_library | market | skillhub | clawhub | npx | github\n"
        "如需搜索 skill，请使用 find_skills(keywords=[\"关键词\"]) 工具。"
    )
    return TerminalToolResult(content=msg, command=command, exit_code=1)


async def handle_skillhub(command: str) -> Optional[TerminalToolResult]:
    """拦截 skillhub 安装类命令，返回 SkillInstallForbiddenError。

    非安装类子命令（search、list、info 等）返回 None，交给真实 CLI 执行。

    Args:
        command: 完整命令字符串

    Returns:
        TerminalToolResult（安装类命令）或 None（放行给真实 CLI）
    """
    try:
        parts = shlex.split(command)
    except ValueError:
        return None

    if len(parts) < 2 or parts[0] != "skillhub":
        return None

    subcommand = parts[1]

    if subcommand not in _INSTALL_SUBCOMMANDS:
        # search / list / info 等非安装类命令放行
        return None

    # 尝试从参数中提取 skill id 以便给出更具体的示例
    skill_id = parts[2] if len(parts) >= 3 else "<id>"

    logger.info(f"[skillhub handler] 拦截安装类命令，引导使用 install_skills: {command}")
    return _make_forbidden_result(command, provider="skillhub", skill_id=skill_id)

