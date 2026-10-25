"""登记新的启动任务；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

import html

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.startup_task import StartupTaskError, StartupTaskService
from app.tools.core import BaseTool, BaseToolParams, tool

from ._base import describe_task, error_result
from .display import get_argument, markdown_detail, translate_action, translate_error, translate_message


class StartupTaskCreateParams(BaseToolParams):
    name: str = Field(..., description="Human-readable task name; the task ID is derived from it.")
    script: str = Field(..., description="Non-interactive bash script to run at every sandbox startup.")
    workdir: str = Field(".", description="Existing directory relative to .workspace to run the script in.")
    timeout_seconds: int | None = Field(None, description="Maximum run time in seconds. Omit to use the default.")
    enabled: bool = Field(True, description="Whether the task runs automatically at sandbox startup.")
    confirmed: bool = Field(False, description="Set true only after the user explicitly approves this startup task.")


@tool(name="startup_task_create", code_mode_only=True)
class StartupTaskCreate(BaseTool[StartupTaskCreateParams]):
    """Register a script to run in the background every time this sandbox starts."""

    async def execute(self, tool_context: ToolContext, params: StartupTaskCreateParams) -> ToolResult:
        try:
            task = await StartupTaskService.get_instance().create(
                name=params.name,
                script=params.script,
                workdir=params.workdir,
                timeout_seconds=params.timeout_seconds,
                enabled=params.enabled,
                confirmed=params.confirmed,
            )
        except StartupTaskError as exc:
            return error_result(exc)
        schedule = (
            "It will run in the background every time the sandbox starts."
            if task.enabled else "It is disabled and will not run automatically until enabled."
        )
        content = (
            f"Registered startup task {describe_task(task)}. {schedule} "
            f'Test it now with startup_task_run(task_id="{task.task_id}"), then wait with shell_await if it moves to the background.'
        )
        return ToolResult(content=content, data={"task_id": task.task_id})

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name),
                "remark": translate_message("create.before", name=get_argument(arguments, "name"))}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        name = get_argument(arguments, "name")
        remark = (
            translate_message("create.after_success", name=name)
            if result.ok else translate_message("after_failed", error=translate_error(result.extra_info))
        )
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return markdown_detail("startup_task_create.md", [translate_error(result.extra_info)])
        return markdown_detail("startup_task_create.md", [
            translate_message("create.after_success", name=html.escape(get_argument(arguments, "name"))),
            "",
            f"- {translate_message('detail.workdir')}: <code>{html.escape(get_argument(arguments, 'workdir') or '.')}</code>",
            "",
            f"```bash\n{get_argument(arguments, 'script')}\n```",
        ])
