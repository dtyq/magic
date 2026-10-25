"""Canvas 布局工具。"""

from typing import Any, Literal

from pydantic import ConfigDict, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import LayoutCommand, LayoutElementCommand
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    error_result,
    items_content,
)
from app.tools.canvas.tools.add_canvas_elements import CanvasPositionInput
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


class LayoutInput(BaseToolParams):
    """布局工具公开的确定布局参数。"""

    model_config = ConfigDict(extra="forbid")

    strategy: Literal["row_incremental", "dependency_flow", "explicit_position"]
    position: CanvasPositionInput | None = None

    @model_validator(mode="after")
    def validate_position(self) -> "LayoutInput":
        """限制显式坐标只用于 explicit_position。"""
        if self.strategy == "explicit_position" and self.position is None:
            raise ValueError("explicit_position requires position")
        if self.strategy != "explicit_position" and self.position is not None:
            raise ValueError("position is only allowed for explicit_position")
        return self

    def to_command(self) -> LayoutCommand:
        """转换为应用层布局命令。"""
        position = (self.position.x, self.position.y) if self.position is not None else None
        return LayoutCommand(strategy=self.strategy, position=position)


class LayoutElementInput(BaseToolParams):
    """单个 Element 布局参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_id: str = Field(..., min_length=1)
    layout: LayoutInput

    def to_command(self) -> LayoutElementCommand:
        """转换为应用层 Element 布局命令。"""
        return LayoutElementCommand(self.item_ref, self.element_id, self.layout.to_command())


@tool(name="layout_canvas_elements", code_mode_only=True)
class LayoutCanvasElements(BaseTool[BaseToolParams]):
    """<!--zh: 使用布局策略调整 Element。-->Apply named layout strategies to Elements."""

    name = "layout_canvas_elements"
    feedback_action_key = "canvas.layout"

    class Params(BaseToolParams):
        """批量布局参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[LayoutElementInput] = Field(..., min_length=1)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成布局执行前的策略和数量反馈。"""
        args = arguments or {}
        items = args.get("items") or []
        strategies = {
            str(item.get("layout", {}).get("strategy"))
            for item in items
            if isinstance(item, dict) and isinstance(item.get("layout"), dict)
        }
        strategy_text = ", ".join(sorted(strategies)) if strategies else "default strategy"
        project_path = args.get("project_path", "")
        remark = canvas_remark(
            "canvas.layout_pending",
            project_path,
            total=len(items),
            strategies=strategy_text,
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
        """生成布局执行后的变更数量反馈。"""
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            values = (result.data or {}).get("items", [])
            remark = canvas_remark("canvas.layout_result", total=len(values))
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成布局工具自己的坐标变更详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "layout", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            layout = item.get("layout") or {}
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "element_id": item.get("element_id", "-"),
                    "position": f"({layout.get('x', '-')}, {layout.get('y', '-')})",
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """执行布局策略，不修改 Content 或 Connection。"""
        try:
            application = _application(tool_context)
            commands = [item.to_command() for item in params.items]
            await CanvasAgentWritePolicy.validate_targets(application.repository, params.project_path, commands)
            result = await application.layout(params.project_path, commands)
            return batch_tool_result(
                content=items_content(
                    "Canvas layout updated successfully.",
                    result.to_dict(),
                    "call query_canvas_overview with the same project_path to verify the persisted layout",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
