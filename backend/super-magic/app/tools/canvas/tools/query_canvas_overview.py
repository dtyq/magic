"""查询 Canvas 概览工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import CanvasToolDetailBuilder, canvas_remark, error_result, overview_content
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


@tool(name="query_canvas_overview", code_mode_only=True)
class QueryCanvasOverview(BaseTool[BaseToolParams]):
    """<!--zh: 查询 Canvas 轻量概览。-->Query a lightweight Canvas overview."""

    name = "query_canvas_overview"
    feedback_action_key = "canvas.query_overview"

    class Params(BaseToolParams):
        """概览分页参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        page: int = Field(1, ge=1, description="One-based page number.")
        limit: int = Field(50, ge=1, le=100, description="Maximum Elements returned on this page.")

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成概览分页查询前的反馈。"""
        args = arguments or {}
        project_path = args.get("project_path", "")
        remark = canvas_remark(
            "canvas.page",
            project_path,
            page=args.get("page", 1),
            limit=args.get("limit", 50),
        )
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
        """生成概览查询完成后的分页结果反馈。"""
        args = arguments or {}
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            data = result.data or {}
            returned = len(data.get("elements", []))
            remark = canvas_remark(
                "canvas.overview_result" if returned else "canvas.overview_empty_page",
                data.get("project_path", args.get("project_path", "")),
                page=data.get("page", args.get("page", 1)),
                returned=returned,
                elements=data.get("total_elements", 0),
            )
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成概览查询自己的详情卡片。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "overview", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        builder.add_field("total_elements", data.get("total_elements", 0))
        builder.add_field("elements", len(data.get("elements", [])), label_key="returned_elements")
        builder.add_field("total_connections", data.get("total_connections", 0))
        builder.add_field("page", data.get("page", builder.arguments.get("page", 1)))
        builder.add_field("limit", data.get("limit", builder.arguments.get("limit", 50)))
        builder.add_field("has_more", builder.boolean_value(data.get("has_more", False)))
        for element in data.get("elements", []):
            fields = {
                "element_id": element.get("element_id", "-"),
                "type": element.get("element_type", "-"),
            }
            if element.get("parent_element_id"):
                fields["parent"] = element["parent_element_id"]
            if element.get("depth", 0) != 0:
                fields["depth"] = element["depth"]
            if element.get("child_count", 0) != 0:
                fields["children"] = element["child_count"]
            builder.add_item(fields)
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """读取当前分页概览。"""
        try:
            result = await _application(tool_context).overview(params.project_path, params.page, params.limit)
            return ToolResult(content=overview_content(result.to_dict()), data=result.to_dict())
        except Exception as error:
            return error_result(error)
