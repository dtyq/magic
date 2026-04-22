"""已知需要后台运行的命令自动设置 allow_background=True。

凡是命令前缀匹配 _AUTO_BACKGROUND_PREFIXES 中任意一项，dispatcher 就会在
CommandHandleResult 中设置 force_background=True，shell_exec 会据此将
allow_background 强制置为 True，无需大模型手动指定。

新增命令只需在 _AUTO_BACKGROUND_PREFIXES 中追加对应前缀字符串。
"""
from pathlib import Path
from typing import TYPE_CHECKING

from app.tools.shell_exec_utils.base import CommandHandleResult, ShellCommandHandler

if TYPE_CHECKING:
    from app.tools.core import BaseToolParams

# 已知必须后台运行的命令前缀列表（按命令去除首尾空白后做 startswith 匹配）
_AUTO_BACKGROUND_PREFIXES: list[str] = [
    # ── lark-cli（飞书 CLI）─────────────────────────────────────────────────
    # 配置应用凭证：输出授权链接，等待用户在浏览器完成配置（如 --new）
    "lark-cli config init",
    # 登录认证：输出授权链接或二维码，等待用户扫码/访问链接完成登录（含 --recommend 等子参数）
    "lark-cli auth login",

    # ── dws（钉钉 Workspace CLI）────────────────────────────────────────────
    # 登录认证：打开浏览器或展示设备码/二维码，等待用户完成 OAuth 授权（含 --device 等子参数）
    "dws auth login",
    # 版本升级：有交互式确认提示，除非命令中已带 -y
    "dws upgrade",

    # ── wecom-cli（企业微信 CLI）─────────────────────────────────────────────
    # 初始化凭证：交互式选择接入方式，展示二维码，等待用户扫码
    "wecom-cli init",
]


class AutoBackgroundHandler(ShellCommandHandler):
    """对已知需要后台运行的命令自动启用后台模式。

    本 handler 不拦截命令（intercepted 始终为 None），仅设置 force_background=True，
    让 shell_exec 继续正常执行，同时自动启用后台模式。
    """

    # 优先级低于其他业务 handler，避免干扰需要拦截的场景
    priority: int = -10

    def matches(self, command: str) -> bool:
        return any(
            command == prefix or command.startswith(prefix + " ")
            for prefix in _AUTO_BACKGROUND_PREFIXES
        )

    async def handle(
        self,
        command: str,
        params: "BaseToolParams",
        base_dir: Path,
    ) -> CommandHandleResult:
        return CommandHandleResult(force_background=True)
