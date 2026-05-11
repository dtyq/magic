"""CLI Skill 安装命令拦截器

拦截通过 shell 直接执行 clawhub/npx 等 CLI 的 skill 安装命令，
强制引导模型使用 install_skills 工具（唯一合法安装入口）。

匹配模式（正则）：
  - clawhub install ...
  - npx ... skills ... install|fetch ...
"""
import re
import shlex
from pathlib import Path
from typing import TYPE_CHECKING

from agentlang.logger import get_logger
from app.core.entity.tool.tool_result_types import TerminalToolResult
from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler
from app.tools.shell_exec_utils.handlers.skillhub import _make_forbidden_result

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams

logger = get_logger(__name__)

# clawhub install <slug> [--dir ...]
_CLAWHUB_INSTALL_RE = re.compile(
    r"^\s*clawhub\b.*\binstall\b", re.IGNORECASE
)

# npx ... skills ... install|fetch|add ...
_NPX_ADDSKILLS_INSTALL_RE = re.compile(
    r"^\s*npx\b.*skills\b.*(install|fetch|add)\b", re.IGNORECASE
)


def _detect_provider_and_id(command: str) -> tuple[str, str]:
    """从命令中猜测 provider 和 skill id，用于生成更友好的示例"""
    try:
        parts = shlex.split(command)
    except ValueError:
        return "clawhub", "<name>"

    cmd_lower = command.lower()
    if "clawhub" in cmd_lower:
        provider = "clawhub"
    elif "skills" in cmd_lower or "npx" in cmd_lower:
        provider = "npx"
    else:
        provider = "skillhub"

    # 找非 flag 参数（过滤掉以 - 开头和 install/fetch 等子命令）
    _SKIP = {"install", "fetch", "add", "npx", "clawhub", "skills", "-y"}
    skill_id = "<name>"
    for part in parts:
        if part.startswith("-"):
            continue
        if part.lower() in _SKIP:
            continue
        skill_id = part
        break

    return provider, skill_id


class CliSkillInstallBlocker(ShellCommandHandler):
    """拦截通过 shell 直接调用 CLI 安装 skill 的命令

    优先级设为 90，高于 SkillhubCommandHandler（默认 0），
    确保 clawhub/npx 安装命令在到达真实 CLI 前被截获。
    """

    priority = 90

    def matches(self, command: str) -> bool:
        return bool(
            _CLAWHUB_INSTALL_RE.match(command)
            or _NPX_ADDSKILLS_INSTALL_RE.match(command)
        )

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        provider, skill_id = _detect_provider_and_id(command)
        logger.info(f"[cli_skill_blocker] 拦截安装命令，引导使用 install_skills: {command[:100]}")
        result = _make_forbidden_result(command, provider=provider, skill_id=skill_id)
        return CommandHandleResult(intercepted=result)
