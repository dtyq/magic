"""等待 Canvas 生成工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    error_result,
    items_content,
    summarize_items,
)
from app.tools.canvas.tools.support import (
    _application,
    resolve_element_types,
    resolve_generation_task_types,
)
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("wait_canvas_generation", min_timeout=600)


class WaitTask(BaseToolParams):
    """单个异步生成任务参数。"""

    model_config = ConfigDict(extra="forbid")

    generation_task_id: str = Field(..., min_length=1)


@tool(name="wait_canvas_generation", code_mode_only=True)
class WaitCanvasGeneration(BaseTool[BaseToolParams]):
    """<!--zh: 等待异步生成任务。-->Wait for Canvas generation tasks."""

    name = "wait_canvas_generation"
    feedback_action_key = "canvas.wait_generation"

    class Params(BaseToolParams):
        """批量等待参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        tasks: list[WaitTask] = Field(..., min_length=1)
        max_wait_seconds: int = Field(60, ge=1, le=600)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成等待生成任务前的任务数量和时间上限反馈。"""
        args = arguments or {}
        tasks = args.get("tasks") or []
        project_path = args.get("project_path", "")
        seconds = args.get("max_wait_seconds", 60)
        task_ids = [
            str(task.get("generation_task_id"))
            for task in tasks
            if isinstance(task, dict) and task.get("generation_task_id")
        ]
        media_types = await resolve_generation_task_types(tool_context, task_ids)
        remark_key = (
            "canvas.wait_image_pending"
            if media_types == {"image"}
            else "canvas.wait_video_pending"
            if media_types == {"video"}
            else "canvas.wait_pending"
        )
        remark_kwargs = {"seconds": seconds}
        if remark_key == "canvas.wait_pending":
            remark_kwargs["total"] = len(tasks)
        remark = canvas_remark(remark_key, project_path, **remark_kwargs)
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        """根据任务状态生成等待完成、超时或部分完成反馈。"""
        args = arguments or {}
        values = (result.data or {}).get("items", [])
        batch_status = summarize_items(values, fallback_ok=result.ok)
        project_path = str((arguments or {}).get("project_path") or "")
        element_ids = [
            str(item.get("element_id"))
            for item in values
            if isinstance(item, dict) and item.get("element_id")
        ]
        media_types = await resolve_element_types(tool_context, project_path, element_ids)
        if not media_types:
            task_ids = [
                str(item.get("generation_task_id"))
                for item in values
                if isinstance(item, dict) and item.get("generation_task_id")
            ] or [
                str(item.get("generation_task_id"))
                for item in args.get("tasks", [])
                if isinstance(item, dict) and item.get("generation_task_id")
            ]
            media_types = await resolve_generation_task_types(tool_context, task_ids)
        media_action_key = (
            "canvas.wait_image_"
            if media_types == {"image"}
            else "canvas.wait_video_"
            if media_types == {"video"}
            else None
        )
        if not values and not result.ok:
            action_key = "canvas.wait_generation_failed"
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            completed = batch_status.succeeded
            failed = batch_status.failed
            if any(item.get("timed_out") for item in values):
                action_key = "canvas.wait_generation_timeout"
                remark = canvas_remark("canvas.wait_timeout", completed=completed, total=len(values))
            elif batch_status.status == "succeeded":
                action_key = "canvas.wait_generation_completed"
                remark = canvas_remark("canvas.wait_completed", completed=completed, total=len(values))
            elif batch_status.status == "failed":
                action_key = "canvas.wait_generation_failed"
                remark = canvas_remark("canvas.wait_failed", failed=failed, total=len(values))
            elif batch_status.status == "processing":
                action_key = "canvas.wait_generation_processing"
                remark = canvas_remark(
                    "canvas.wait_processing",
                    completed=completed,
                    processing=batch_status.processing,
                    failed=failed,
                    total=len(values),
                )
            else:
                action_key = "canvas.wait_generation_partial"
                remark = canvas_remark(
                    "canvas.wait_partial",
                    completed=completed,
                    failed=failed,
                    total=len(values),
                )
        media_status_suffix = {
            "succeeded": "completed",
            "failed": "failed",
            "processing": "processing",
            "partial": "partial",
        }.get(batch_status.status)
        if any(item.get("timed_out") for item in values):
            media_status_suffix = "timeout"
        resolved_action_key = (
            f"{media_action_key}{media_status_suffix}"
            if media_action_key and media_status_suffix
            else media_action_key or action_key
        )
        return {
            "action": i18n.translate(resolved_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成等待工具自己的任务状态详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "generation_wait", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "task_id": item.get("generation_task_id", "-"),
                    "status": item.get("status", "-"),
                    "timed_out": item.get("timed_out"),
                    "element_id": item.get("element_id", "-"),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """查询任务状态；超时后继续使用原任务 ID。"""
        try:
            task_ids = [task.generation_task_id for task in params.tasks]
            result = await _application(tool_context).wait(
                params.project_path,
                task_ids,
                params.max_wait_seconds,
                tool_context,
            )
            return batch_tool_result(
                content=items_content("Canvas generation status returned.", result.to_dict()),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
