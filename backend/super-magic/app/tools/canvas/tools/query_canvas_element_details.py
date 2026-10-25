"""查询 Canvas Element 详情工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import CanvasToolDetailBuilder, canvas_remark, elements_content, error_result
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


@tool(name="query_canvas_element_details", code_mode_only=True)
class QueryCanvasElementDetails(BaseTool[BaseToolParams]):
    """<!--zh: 查询精确 Canvas Element 详情。-->Query exact Canvas Element details."""

    name = "query_canvas_element_details"
    feedback_action_key = "canvas.query_elements"

    class Params(BaseToolParams):
        """精确 Element 详情查询参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        element_ids: list[str] = Field(
            ...,
            min_length=1,
            max_length=10,
            description="Exact Element IDs obtained from a Canvas result.",
        )

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成精确 Element 查询前的目标反馈。"""
        args = arguments or {}
        element_ids = args.get("element_ids") or []
        target = ", ".join(str(item) for item in element_ids) or "-"
        project_path = args.get("project_path", "")
        remark = canvas_remark("canvas.element_targets", project_path, targets=target)
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
        """生成详情查询完成后的目标和结果反馈。"""
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            data = result.data or {}
            remark = canvas_remark("canvas.element_details_result", total=len(data.get("elements", [])))
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成详情查询自己的层级和 Content 摘要。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "element_details", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        builder.add_field("elements", len(data.get("elements", [])))
        for element in data.get("elements", []):
            fields = {
                "element_id": element.get("element_id", "-"),
                "type": element.get("element_type", "-"),
            }
            if element.get("name"):
                fields["name"] = element["name"]
            if element.get("parent_element_id"):
                fields["parent"] = element["parent_element_id"]
            if element.get("depth", 0) != 0:
                fields["depth"] = element["depth"]
            content_count = len(element.get("contents") or [])
            if content_count != 1:
                fields["contents"] = content_count
            child_count = len(element.get("children") or [])
            if child_count:
                fields["children"] = child_count
            builder.add_item(fields)
        for warning in data.get("warnings", []):
            builder.add_warning(warning)
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """读取指定 Element 和关联 Connection。"""
        try:
            result = await _application(tool_context).elements(params.project_path, params.element_ids)
            return ToolResult(content=elements_content(result.to_dict()), data=result.to_dict())
        except Exception as error:
            return error_result(error)
