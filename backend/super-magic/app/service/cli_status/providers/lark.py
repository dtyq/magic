"""飞书/Lark lark-cli 状态探测实现。"""
from __future__ import annotations

from agentlang.logger import get_logger
from app.service.cli_status.common.interfaces import CliCommandResult, CliCommandRunner, CliStatusProbe, CliStatusSnapshot
from app.service.cli_status.common.parsing import (
    json_find_status,
    loads_json,
    parse_auth_from_text,
)
from app.service.cli_status.common.runner import CLI_STATUS_COMMAND_TIMEOUT_SECONDS, run_cli_command

logger = get_logger(__name__)

LARK_HORIZON_TEXT = (
    "lark-cli is currently authenticated. It can connect to Lark/Feishu/飞书 capabilities. "
    "To use these capabilities, call read_skills(['lark-cli'])."
)


class LarkCliStatusProbe(CliStatusProbe):
    """只负责 lark-cli 状态命令的身份可用性摘要。

    `auth status` 输出可能包含身份或凭证字段，本类只输出归一化状态。
    """

    cli_name = "lark-cli"

    def __init__(
        self,
        runner: CliCommandRunner = run_cli_command,
        timeout: float = CLI_STATUS_COMMAND_TIMEOUT_SECONDS,
    ) -> None:
        self._runner = runner
        self._timeout = timeout

    async def detect(self) -> CliStatusSnapshot:
        """探测 lark-cli 状态并返回最小 Horizon 结构。

        只运行 `lark-cli auth status`；只有可用身份存在时才返回可注入文本。
        """
        auth_status_result = await self._run("lark-cli", "auth", "status")
        if auth_status_result.exit_code == 127:
            self._log_summary(auth_status_result, auth="unknown", horizon_enabled=False)
            return CliStatusSnapshot(cli=self.cli_name)

        auth = self._parse_auth_status(auth_status_result)
        horizon_enabled = auth == "authenticated"
        self._log_summary(auth_status_result, auth=auth, horizon_enabled=horizon_enabled)
        return CliStatusSnapshot(
            cli=self.cli_name,
            horizon=LARK_HORIZON_TEXT if horizon_enabled else "",
        )

    def _log_summary(self, result: CliCommandResult, auth: str, horizon_enabled: bool) -> None:
        """记录 lark-cli 探测摘要，不输出原始命令内容。"""
        logger.info(
            "[CliStatus][lark-cli] 检测完成: "
            f"auth={auth}, horizon={'enabled' if horizon_enabled else 'skipped'}, "
            f"argv={' '.join(result.argv)}, exit_code={result.exit_code}, "
            f"timed_out={result.timed_out}, elapsed_ms={result.elapsed_seconds * 1000:.1f}"
        )

    async def _run(self, *argv: str) -> CliCommandResult:
        """用统一 runner 执行 lark-cli 探测命令，继承短超时策略。"""
        return await self._runner(argv, self._timeout)

    def _parse_auth_status(self, result: CliCommandResult) -> str:
        """从 auth status 输出中归一化授权状态。

        支持 lark-cli 当前 identities.bot/user 结构；不提取 openId、userName、scope 等原始字段。
        """
        if result.timed_out:
            return "unknown"

        lowered = result.combined_output.lower()
        if "keychain" in lowered:
            # keychain 错误说明状态不可确认，不能推断用户未授权。
            return "unknown"

        data = loads_json(result.stdout)
        if isinstance(data, dict):
            error = data.get("error")
            if data.get("ok") is False and isinstance(error, dict):
                subtype = str(error.get("subtype") or error.get("type") or "error").lower()
                if subtype in {"not_configured", "config"}:
                    return "not_authenticated"
                return "unknown"

            identities = data.get("identities")
            if isinstance(identities, dict):
                bot_available = self._identity_available(identities.get("bot"))
                user_available = self._identity_available(identities.get("user"))
                return "authenticated" if bot_available or user_available else "not_authenticated"

            credential_status = json_find_status(data, {"tokenstatus", "status"})
            if credential_status:
                if credential_status in {"ok", "ready", "valid", "active", "authenticated"}:
                    return "authenticated"
                if credential_status in {"missing", "no_token", "not_found", "expired", "invalid"}:
                    return "not_authenticated"

        if result.exit_code != 0:
            return "unknown"
        auth, _detail = parse_auth_from_text(result.combined_output)
        return auth

    def _identity_available(self, value: object) -> bool:
        """判断 identities.<type>.available 是否为 True。"""
        return isinstance(value, dict) and value.get("available") is True
