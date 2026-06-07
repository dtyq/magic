"""钉钉 dws CLI 状态探测实现。"""
from __future__ import annotations

from agentlang.logger import get_logger
from app.service.cli_status.common.interfaces import CliCommandResult, CliCommandRunner, CliStatusProbe, CliStatusSnapshot
from app.service.cli_status.common.parsing import json_contains_truthy, loads_json, parse_auth_from_text
from app.service.cli_status.common.runner import run_cli_command

logger = get_logger(__name__)

DWS_STATUS_COMMAND_TIMEOUT_SECONDS = 2.0

DWS_HORIZON_TEXT = (
    "dws CLI is currently authenticated. It can connect to DingTalk/钉钉 capabilities. "
    "To use these capabilities, call read_skills(['dingtalk-cli'])."
)


class DwsCliStatusProbe(CliStatusProbe):
    """只负责 dws 状态命令的授权摘要。

    本类不参与平台选择，只返回脱敏后的 Horizon 环境上下文文本。
    """

    cli_name = "dws"

    def __init__(
        self,
        runner: CliCommandRunner = run_cli_command,
        timeout: float = DWS_STATUS_COMMAND_TIMEOUT_SECONDS,
    ) -> None:
        self._runner = runner
        self._timeout = timeout

    async def detect(self) -> CliStatusSnapshot:
        """探测 dws 状态并返回最小 Horizon 结构。

        只运行 `dws auth status`；只有已登录时才返回可注入文本。
        """
        auth_result = await self._run("dws", "auth", "status")
        if auth_result.exit_code == 127:
            self._log_summary(auth_result, auth="unknown", horizon_enabled=False)
            return CliStatusSnapshot(cli=self.cli_name)

        auth = self._parse_auth(auth_result)
        horizon_enabled = auth == "authenticated"
        self._log_summary(auth_result, auth=auth, horizon_enabled=horizon_enabled)
        return CliStatusSnapshot(
            cli=self.cli_name,
            horizon=DWS_HORIZON_TEXT if horizon_enabled else "",
        )

    def _log_summary(self, result: CliCommandResult, auth: str, horizon_enabled: bool) -> None:
        """记录 dws 探测摘要，不输出原始命令内容。"""
        logger.info(
            "[CliStatus][dws] 检测完成: "
            f"auth={auth}, horizon={'enabled' if horizon_enabled else 'skipped'}, "
            f"argv={' '.join(result.argv)}, exit_code={result.exit_code}, "
            f"timed_out={result.timed_out}, elapsed_ms={result.elapsed_seconds * 1000:.1f}"
        )

    async def _run(self, *argv: str) -> CliCommandResult:
        """用统一 runner 执行 dws 探测命令，继承短超时策略。"""
        return await self._runner(argv, self._timeout)

    def _parse_auth(self, result: CliCommandResult) -> str:
        """把 dws auth status 输出归一化为认证状态。

        JSON 中的 authenticated 优先；非 JSON 或失败输出只做保守文本兜底。
        """
        if result.timed_out:
            return "unknown"

        data = loads_json(result.stdout)
        if data is not None:
            authenticated = json_contains_truthy(
                data,
                {"authenticated", "loggedin", "login", "isauthenticated"},
            )
            if authenticated is True:
                return "authenticated"
            if authenticated is False:
                return "not_authenticated"

        if result.exit_code != 0:
            auth, _detail = parse_auth_from_text(result.combined_output)
            # 命令失败且文本无法识别时，标为 error 而不是猜测登录状态。
            return auth if auth != "unknown" else "error"

        auth, _detail = parse_auth_from_text(result.combined_output)
        return auth
