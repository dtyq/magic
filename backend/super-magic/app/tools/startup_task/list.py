"""查看启动任务及本次沙盒启动后的运行状态；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

import html

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.startup_task import StartupTaskError, StartupTaskService
from app.tools.core import BaseTool, BaseToolParams, tool

from ._base import describe_run_state, describe_task, error_result, view_data
from .display import markdown_detail, translate_action, translate_error, translate_message, translate_status


class StartupTaskListParams(BaseToolParams):
    """No arguments."""


@tool(name="startup_task_list", code_mode_only=True)
class StartupTaskList(BaseTool[StartupTaskListParams]):
    """List startup tasks and how each one ran after this sandbox started."""

    async def execute(self, tool_context: ToolContext, params: StartupTaskListParams) -> ToolResult:
        try:
            views = await StartupTaskService.get_instance().list_tasks()
        except StartupTaskError as exc:
            return error_result(exc)
        if not views:
            return ToolResult(content="No startup tasks are registered.", data={"tasks": []})
        lines = [f"{len(views)} startup task(s):"]
        lines.extend(f"- {describe_task(view.task)}. {describe_run_state(view)}" for view in views)
        return ToolResult(content="\n".join(lines), data={"tasks": [view_data(view) for view in views]})

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": translate_message("list.before")}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        if result.ok:
            remark = translate_message("list.after_success", count=len((result.data or {}).get("tasks", [])))
        else:
            remark = translate_message("after_failed", error=translate_error(result.extra_info))
        return {"tool_name": tool_name, "action": translate_action(tool_name), "remark": remark}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        if not result.ok:
            return markdown_detail("startup_task_list.md", [translate_error(result.extra_info)])
        tasks = (result.data or {}).get("tasks", [])
        if not tasks:
            return markdown_detail("startup_task_list.md", [translate_message("detail.empty")])
        lines = [
            f"| {translate_message('detail.name')} | {translate_message('detail.workdir')} "
            f"| {translate_message('detail.enabled')} | {translate_message('detail.status')} |",
            "| --- | --- | --- | --- |",
        ]
        for item in tasks:
            task, state = item["task"], item["state"]
            enabled = translate_message("detail.yes" if task["enabled"] else "detail.no")
            lines.append(
                f"| {html.escape(task['name'])} | <code>{html.escape(task['workdir'])}</code> "
                f"| {enabled} | {translate_status(str(state['status']))} |"
            )
        return markdown_detail("startup_task_list.md", lines)
