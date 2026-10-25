"""Code Mode tool for inspecting the sandbox that hosts the current Agent."""

from __future__ import annotations

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.run_interruption import await_with_interruption
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError, ConnectionError
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.core.sandbox_tool_context import get_sandbox_tool_context

logger = get_logger(__name__)


class GetSandboxInfoParams(BaseToolParams):
    pass


@tool(code_mode_only=True)
class GetSandboxInfo(BaseTool[GetSandboxInfoParams]):
    """Inspect the sandbox that hosts the current Agent."""

    async def execute(self, tool_context: ToolContext, params: GetSandboxInfoParams) -> ToolResult:
        sandbox_context = get_sandbox_tool_context(tool_context, logger=logger)
        if isinstance(sandbox_context, ToolResult):
            return sandbox_context

        try:
            async with MagicServiceClient(sandbox_context.config) as client:
                result = await await_with_interruption(
                    client.get_sandbox_info(sandbox_context.sandbox_id),
                    sandbox_context.agent_context.get_interruption_event(),
                )
        except ConnectionError as exc:
            logger.error("Connection error while getting sandbox info: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to inspect the current sandbox because the service connection failed: {exc}",
                extra_info={"user_error": _translate("get_sandbox_info.error")},
            )
        except ApiError as exc:
            logger.error("Sandbox info API error: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to inspect the current sandbox: {exc}",
                extra_info={"user_error": _translate("get_sandbox_info.error")},
            )
        except Exception as exc:
            logger.error("Unexpected error while getting sandbox info: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to inspect the current sandbox because an unexpected error occurred: {exc}",
                extra_info={"user_error": _translate("get_sandbox_info.error")},
            )

        content = (
            "Current sandbox information:\n"
            f"- Sandbox ID: {result['sandbox_id']}\n"
            f"- Status: {result['status'] or 'unknown'}\n"
            f"- Current Agent image version: {result['current_version'] or 'unknown'}\n"
            f"- Latest Agent image version: {result['latest_version'] or 'unknown'}\n"
            f"- Update needed: {'unknown' if result['needs_update'] is None else 'yes' if result['needs_update'] else 'no'}"
        )
        payload = dict(result)
        return ToolResult(content=content, data=payload, extra_info=payload)

    async def get_before_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "tool_name": tool_name,
            "action": _action(tool_name),
            "remark": _translate("get_sandbox_info.before"),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return _error_detail("get_sandbox_info.md", result, "get_sandbox_info.detail_failed_title")

        info = _result_data(result)
        lines = [
            f"# {_translate('get_sandbox_info.detail_title')}",
            "",
            f"- {_translate('sandbox.detail.sandbox_id')}: `{info.get('sandbox_id', '')}`",
            f"- {_translate('sandbox.detail.status')}: {_display_value(info.get('status'))}",
            f"- {_translate('sandbox.detail.current_version')}: {_display_value(info.get('current_version'))}",
            f"- {_translate('sandbox.detail.latest_version')}: {_display_value(info.get('latest_version'))}",
            f"- {_translate('sandbox.detail.needs_update')}: {_yes_no(info.get('needs_update'))}",
        ]
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="get_sandbox_info.md", content="\n".join(lines)),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        message_key = "get_sandbox_info.success" if result.ok else "get_sandbox_info.error"
        return {"tool_name": tool_name, "action": _action(tool_name), "remark": _translate(message_key)}


def _translate(key: str) -> str:
    return i18n.translate(key, category="tool.messages")


def _action(tool_name: str) -> str:
    return i18n.translate(tool_name, category="tool.actions")


def _result_data(result: ToolResult) -> dict[str, object]:
    if isinstance(result.data, dict):
        return result.data
    if isinstance(result.extra_info, dict):
        return result.extra_info
    return {}


def _display_value(value: object) -> str:
    text = str(value or "").strip()
    return f"`{text}`" if text else _translate("sandbox.detail.unknown")


def _yes_no(value: object) -> str:
    if value is None:
        return _translate("sandbox.detail.unknown")
    return _translate("sandbox.detail.yes" if value else "sandbox.detail.no")


def _error_detail(file_name: str, result: ToolResult, title_key: str) -> ToolDetail:
    extra_info = result.extra_info if isinstance(result.extra_info, dict) else {}
    user_error = extra_info.get("user_error")
    if not isinstance(user_error, str) or not user_error.strip():
        user_error = _translate("sandbox.detail.service_error")
    content = "\n".join(
        [
            f"# {_translate(title_key)}",
            "",
            f"- {_translate('sandbox.detail.error')}: {user_error}",
        ]
    )
    return ToolDetail(type=DisplayType.MD, data=FileContent(file_name=file_name, content=content))


__all__ = ["GetSandboxInfo", "GetSandboxInfoParams"]
