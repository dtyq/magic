"""Code Mode tool for upgrading the sandbox that hosts the current Agent."""

from __future__ import annotations

import asyncio

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.context.run_interruption import await_with_interruption
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError, ConnectionError
from app.infrastructure.magic_service.sandbox_types import (
    SandboxUpgradeScheduleData,
    SandboxVersionData,
)
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.core.sandbox_rebuild_scheduler import (
    SANDBOX_UPGRADE_DELAY_SECONDS,
    schedule_sandbox_upgrade,
)
from app.tools.core.sandbox_tool_context import SandboxToolContext, get_sandbox_tool_context

logger = get_logger(__name__)


class UpgradeSandboxParams(BaseToolParams):
    pass


@tool(code_mode_only=True)
class UpgradeSandbox(BaseTool[UpgradeSandboxParams]):
    """Schedule an upgrade for the current Agent sandbox when its image is outdated."""

    async def execute(self, tool_context: ToolContext, params: UpgradeSandboxParams) -> ToolResult:
        sandbox_context = get_sandbox_tool_context(tool_context, logger=logger)
        if isinstance(sandbox_context, ToolResult):
            return sandbox_context

        try:
            version_info = await _check_current_sandbox(sandbox_context)
        except asyncio.CancelledError:
            raise
        except ConnectionError as exc:
            logger.error("Connection error during sandbox upgrade: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to upgrade the current sandbox because the service connection failed: {exc}",
                extra_info={"user_error": _translate("upgrade_sandbox.error")},
            )
        except ApiError as exc:
            logger.error("Sandbox upgrade API error: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to upgrade the current sandbox: {exc}",
                extra_info={"user_error": _translate("upgrade_sandbox.error")},
            )
        except Exception as exc:
            logger.error("Unexpected error during sandbox upgrade: %s", exc, exc_info=True)
            return ToolResult.error(
                f"Unable to upgrade the current sandbox because an unexpected error occurred: {exc}",
                extra_info={"user_error": _translate("upgrade_sandbox.error")},
            )

        if version_info["needs_update"] is False:
            result: SandboxUpgradeScheduleData = {
                "sandbox_id": sandbox_context.sandbox_id,
                "operation": "already_current",
                "current_version": version_info["current_version"],
                "latest_version": version_info["latest_version"],
                "needs_update": False,
                "delay_seconds": 0,
            }
            content = "The current sandbox is already using the latest sandbox images. No restart was performed."
        else:
            delay_seconds = SANDBOX_UPGRADE_DELAY_SECONDS
            try:
                schedule_sandbox_upgrade(
                    agent_context=sandbox_context.agent_context,
                    config=sandbox_context.config,
                    sandbox_id=sandbox_context.sandbox_id,
                    delay_seconds=delay_seconds,
                    logger=logger,
                )
            except Exception as exc:
                logger.error("Unable to schedule sandbox upgrade: %s", exc, exc_info=True)
                return ToolResult.error(
                    f"Unable to schedule the current sandbox upgrade: {exc}",
                    extra_info={"user_error": _translate("upgrade_sandbox.error")},
                )
            result = {
                "sandbox_id": sandbox_context.sandbox_id,
                "operation": "upgrade_scheduled",
                "current_version": version_info["current_version"],
                "latest_version": version_info["latest_version"],
                "needs_update": version_info["needs_update"],
                "delay_seconds": delay_seconds,
            }
            content = (
                "The current sandbox upgrade has been scheduled. "
                f"The sandbox is scheduled to be rebuilt in {delay_seconds} seconds. "
                "Reply to the user now and do not call more tools. "
                "This confirms scheduling, not completion; after the sandbox is available again, "
                "use get_sandbox_info to verify the new image version."
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
            "remark": _translate("upgrade_sandbox.before"),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return _error_detail(result)

        info = _result_data(result)
        lines = [
            f"# {_translate('upgrade_sandbox.detail_title')}",
            "",
            f"- {_translate('sandbox.detail.sandbox_id')}: `{info.get('sandbox_id', '')}`",
            f"- {_translate('sandbox.detail.operation')}: {_operation_label(info.get('operation'))}",
            f"- {_translate('sandbox.detail.current_version')}: {_display_value(info.get('current_version'))}",
            f"- {_translate('sandbox.detail.latest_version')}: {_display_value(info.get('latest_version'))}",
            f"- {_translate('sandbox.detail.needs_update')}: {_yes_no(info.get('needs_update'))}",
            f"- {_translate('sandbox.detail.delay_seconds')}: {_display_value(info.get('delay_seconds'))}",
        ]
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="upgrade_sandbox.md", content="\n".join(lines)),
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        if not result.ok:
            remark = _translate("upgrade_sandbox.error")
        else:
            info = _result_data(result)
            if info.get("operation") == "already_current":
                remark = _translate("upgrade_sandbox.already_current")
            else:
                remark = _translate(
                    "upgrade_sandbox.scheduled",
                    delay_seconds=info.get("delay_seconds", SANDBOX_UPGRADE_DELAY_SECONDS),
                )
        return {"tool_name": tool_name, "action": _action(tool_name), "remark": remark}


async def _check_current_sandbox(
    sandbox_context: SandboxToolContext,
) -> SandboxVersionData:
    if sandbox_context.agent_context.is_interruption_requested():
        raise asyncio.CancelledError("Sandbox upgrade interrupted before the request started")

    async with MagicServiceClient(sandbox_context.config) as client:
        return await await_with_interruption(
            client.check_sandbox_version(sandbox_context.sandbox_id),
            sandbox_context.agent_context.get_interruption_event(),
        )


def _translate(key: str, **kwargs: object) -> str:
    return i18n.translate(key, category="tool.messages", **kwargs)


def _action(tool_name: str) -> str:
    return i18n.translate(tool_name, category="tool.actions")


def _result_data(result: ToolResult) -> dict[str, object]:
    if isinstance(result.data, dict):
        return result.data
    if isinstance(result.extra_info, dict):
        return result.extra_info
    return {}


def _display_value(value: object) -> str:
    text = "" if value is None else str(value).strip()
    return f"`{text}`" if text else _translate("sandbox.detail.unknown")


def _yes_no(value: object) -> str:
    if value is None:
        return _translate("sandbox.detail.unknown")
    return _translate("sandbox.detail.yes" if value else "sandbox.detail.no")


def _operation_label(value: object) -> str:
    operation = str(value or "").strip()
    if operation not in {"upgrade_scheduled", "already_current"}:
        return _translate("sandbox.detail.unknown")
    return _translate(f"sandbox.operation.{operation}")


def _error_detail(result: ToolResult) -> ToolDetail:
    extra_info = result.extra_info if isinstance(result.extra_info, dict) else {}
    user_error = extra_info.get("user_error")
    if not isinstance(user_error, str) or not user_error.strip():
        user_error = _translate("sandbox.detail.service_error")
    content = "\n".join(
        [
            f"# {_translate('upgrade_sandbox.detail_failed_title')}",
            "",
            f"- {_translate('sandbox.detail.error')}: {user_error}",
        ]
    )
    return ToolDetail(
        type=DisplayType.MD,
        data=FileContent(file_name="upgrade_sandbox.md", content=content),
    )


__all__ = ["UpgradeSandbox", "UpgradeSandboxParams"]
