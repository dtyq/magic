"""删除启动任务；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.startup_task import StartupTaskError, StartupTaskRunStatus, StartupTaskService
from app.tools.core import BaseTool, BaseToolParams, tool

from ._base import error_result
from .display import get_argument, markdown_detail, translate_action, translate_error, translate_message


class StartupTaskDeleteParams(BaseToolParams):
    task_id: str = Field(..., description="Task ID from startup_task_list.")


@tool(name="startup_task_delete", code_mode_only=True)
class StartupTaskDelete(BaseTool[StartupTaskDeleteParams]):
    """Delete a startup task definition. A run already in progress is not stopped."""

    async def execute(self, tool_context: ToolContext, params: StartupTaskDeleteParams) -> ToolResult:
        try:
            state = await StartupTaskService.get_instance().delete(params.task_id)
        except StartupTaskError as exc:
            return error_result(exc)
        content = f"Deleted startup task {params.task_id}; it will no longer run at sandbox startup."
        if state.status == StartupTaskRunStatus.RUNNING and state.background_task_id:
            content += (
                f" A run is still in progress as background task {state.background_task_id}. "
                f'Stop it only if needed with shell_await(task_id="{state.background_task_id}", timeout=0, kill=True).'
            )
        return ToolResult(
            content=content,
            data={"task_id": params.task_id, "running_background_task_id": state.background_task_id
                  if state.status == StartupTaskRunStatus.RUNNING else None},
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name),
                "remark": translate_message("delete.before", task_id=get_argument(arguments, "task_id"))}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        task_id = get_argument(arguments, "task_id")
        remark = (
            translate_message("delete.after_success", task_id=task_id)
            if result.ok else translate_message("after_failed", error=translate_error(result.extra_info))
        )
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return markdown_detail("startup_task_delete.md", [translate_error(result.extra_info)])
        return markdown_detail("startup_task_delete.md", [
            translate_message("delete.after_success", task_id=get_argument(arguments, "task_id")),
        ])
