"""修改启动任务；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.startup_task import StartupTaskError, StartupTaskService
from app.tools.core import BaseTool, BaseToolParams, tool

from ._base import describe_task, error_result
from .display import get_argument, markdown_detail, translate_action, translate_error, translate_message


class StartupTaskUpdateParams(BaseToolParams):
    task_id: str = Field(..., description="Task ID from startup_task_list.")
    name: str | None = Field(None, description="New name. The task ID does not change.")
    script: str | None = Field(None, description="New non-interactive bash script.")
    workdir: str | None = Field(None, description="New existing directory relative to .workspace.")
    timeout_seconds: int | None = Field(None, description="New maximum run time in seconds.")
    enabled: bool | None = Field(None, description="Enable or disable automatic runs at sandbox startup.")
    confirmed: bool = Field(
        False,
        description="Required when changing script or passing enabled=true. Set true only after the user explicitly approves.",
    )


@tool(name="startup_task_update", code_mode_only=True)
class StartupTaskUpdate(BaseTool[StartupTaskUpdateParams]):
    """Change an existing startup task. Omitted fields stay unchanged."""

    async def execute(self, tool_context: ToolContext, params: StartupTaskUpdateParams) -> ToolResult:
        try:
            result = await StartupTaskService.get_instance().update(
                task_id=params.task_id,
                name=params.name,
                script=params.script,
                workdir=params.workdir,
                timeout_seconds=params.timeout_seconds,
                enabled=params.enabled,
                confirmed=params.confirmed,
            )
        except StartupTaskError as exc:
            return error_result(exc)
        changed = ", ".join(result.changed_fields)
        test_hint = (
            f' Test the new version with startup_task_run(task_id="{result.task.task_id}").'
            if {"script", "workdir"} & set(result.changed_fields) else ""
        )
        content = f"Updated {changed} of startup task {describe_task(result.task)}.{test_hint}"
        return ToolResult(content=content, data={"task_id": result.task.task_id, "changed_fields": result.changed_fields})

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name),
                "remark": translate_message("update.before", task_id=get_argument(arguments, "task_id"))}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        task_id = get_argument(arguments, "task_id")
        remark = (
            translate_message("update.after_success", task_id=task_id)
            if result.ok else translate_message("after_failed", error=translate_error(result.extra_info))
        )
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return markdown_detail("startup_task_update.md", [translate_error(result.extra_info)])
        return markdown_detail("startup_task_update.md", [
            translate_message("update.after_success", task_id=get_argument(arguments, "task_id")),
        ])
