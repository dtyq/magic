"""Frame 框选工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import FrameElementsCommand
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    error_result,
    items_content,
    summarize_tool_result,
)
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


class FrameSelectionInput(BaseToolParams):
    """单个 Frame 框选参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_ids: list[str] = Field(..., min_length=1, max_length=100)
    name: str | None = None
    padding: float | None = Field(None, ge=0)

    def to_command(self) -> FrameElementsCommand:
        """转换为应用层 Frame 命令。"""
        return FrameElementsCommand(
            item_ref=self.item_ref,
            element_ids=tuple(self.element_ids),
            name=self.name,
            padding=self.padding,
        )


@tool(name="frame_canvas_elements", code_mode_only=True)
class FrameCanvasElements(BaseTool[BaseToolParams]):
    """<!--zh: 将已有同层级节点框选为新的 Frame。-->Frame existing sibling Elements."""

    name = "frame_canvas_elements"
    feedback_action_key = "canvas.create_frame"

    class Params(BaseToolParams):
        """批量框选参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[FrameSelectionInput] = Field(..., min_length=1)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成框选前的选区反馈。"""
        args = arguments or {}
        items = args.get("items") or []
        selected = sum(len(item.get("element_ids") or []) for item in items if isinstance(item, dict))
        project_path = args.get("project_path", "")
        remark = canvas_remark("canvas.frame_pending", project_path, total=selected)
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
        """生成框选后的 Frame 数量反馈。"""
        batch_status = summarize_tool_result(result)
        if batch_status.status in {"failed", "partial"}:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            values = (result.data or {}).get("items", [])
            total = sum(1 for item in values if item.get("status") in {"created", "completed", "added"})
            remark = canvas_remark("canvas.frame_result", total=total)
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成框选工具自己的层级详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "frames_created", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "frame_element_id": item.get("frame_element_id", "-"),
                    "child_count": len(item.get("child_element_ids") or []),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """创建 Frame 并返回真实 Frame 和子节点 ID。"""
        try:
            application = _application(tool_context)
            commands = [item.to_command() for item in params.items]
            await CanvasAgentWritePolicy.validate_frame_selection(
                application.repository,
                params.project_path,
                commands,
            )
            result = await application.frame_elements(
                params.project_path,
                commands,
            )
            return batch_tool_result(
                content=items_content(
                    "Canvas Frames created successfully.",
                    result.to_dict(),
                    "call query_canvas_element_details with the returned frame_element_id values to verify the hierarchy",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
