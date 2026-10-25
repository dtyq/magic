"""立即试跑一次启动任务；使用说明维护在 agents/skills/startup-manager/SKILL.md。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.service.startup_task import StartupTaskError, StartupTaskRunStatus, StartupTaskService
from app.tools.core import BaseTool, BaseToolParams, tool

from ._base import describe_run_state, error_result, view_data
from .display import get_argument, markdown_detail, translate_action, translate_error, translate_message, translate_status


class StartupTaskRunParams(BaseToolParams):
    task_id: str = Field(..., description="Task ID from startup_task_list.")


"""
| 结果 | ok | content |
| 前台观察窗口内成功 | True | 退出码与输出 |
| 前台观察窗口内失败 | False | 退出码与输出，供模型修脚本 |
| 转为后台 | True | 后台任务 ID 与 shell_await 用法；最终是否成功要等 shell_await 结束才知道 |
"""
@tool(name="startup_task_run", code_mode_only=True)
class StartupTaskRun(BaseTool[StartupTaskRunParams]):
    """Run a startup task once now, regardless of whether it is enabled."""

    async def execute(self, tool_context: ToolContext, params: StartupTaskRunParams) -> ToolResult:
        try:
            view = await StartupTaskService.get_instance().run_now(params.task_id)
        except StartupTaskError as exc:
            return error_result(exc)
        status = view.state.status
        prefix = "Started" if status == StartupTaskRunStatus.RUNNING else "Ran"
        return ToolResult(
            ok=status in (StartupTaskRunStatus.RUNNING, StartupTaskRunStatus.SUCCEEDED),
            content=f"{prefix} startup task {params.task_id}. {describe_run_state(view)}",
            data=view_data(view),
        )

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name),
                "remark": translate_message("run.before", task_id=get_argument(arguments, "task_id"))}

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {"tool_name": tool_name, "action": translate_action(tool_name),
                "remark": self._summary(result, get_argument(arguments, "task_id"))}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        return markdown_detail("startup_task_run.md", [self._summary(result, get_argument(arguments, "task_id"))])

    @staticmethod
    def _summary(result: ToolResult, task_id: str) -> str:
        state = (result.data or {}).get("state")
        if not isinstance(state, dict):
            return translate_message("after_failed", error=translate_error(result.extra_info))
        return translate_message("run.after", task_id=task_id, status=translate_status(str(state["status"])))
