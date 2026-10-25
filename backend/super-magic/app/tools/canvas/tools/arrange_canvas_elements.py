"""相对整理入口，保留已有生成布局策略。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.canvas.application.arrangement_service import Arrangement, ArrangementService
from app.tools.canvas.presentation import error_result
from app.tools.canvas.tools.management_tool import CanvasManagementTool
from app.tools.canvas.tools.support import _application
from app.tools.core import tool


# 完整说明：agents/skills/canvas-manager/references/layout.md。
@tool(name="arrange_canvas_elements", code_mode_only=True)
class ArrangeCanvasElements(CanvasManagementTool):
    """Arrange existing Elements using relative placement rules."""

    name = "arrange_canvas_elements"

    class Params(Arrangement):
        project_path: str = Field(min_length=1)

    params_class = Params

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        try:
            result = await ArrangementService(_application(tool_context).repository).arrange(
                params.project_path, params
            )
            lines = [f"Canvas {params.operation} {'calculated without writing' if params.dry_run else 'completed'}."]
            lines.append(f"Layout: {result['direction']}; bounds coordinate space: {result['bounds_coordinate_space']}.")
            if params.operation != "align":
                lines.append(
                    f"Spacing: {result['gap']} Canvas units; previous bounds and viewport do not constrain rearrangement."
                )
            before_bounds, bounds = result["before_bounds"], result["bounds"]
            lines.append(
                f"Bounds: ({before_bounds['x']}, {before_bounds['y']}, {before_bounds['width']}, {before_bounds['height']})"
                f" -> ({bounds['x']}, {bounds['y']}, {bounds['width']}, {bounds['height']})."
                " Parent Frame boundaries remain enforced."
            )
            for item in result["items"]:
                before, after = item["before"], item["after"]
                lines.append(
                    f"- element_id={item['element_id']} | {item['status']} | parent_local_position=({before['x']}, {before['y']}) -> ({after['x']}, {after['y']}) | size_source={item['size_source']}"
                )
            lines.append(
                "Placeholder dimensions may change when generation finishes; no continuous arrangement constraint was created."
            )
            return ToolResult(content="\n".join(lines), data=result)
        except Exception as error:
            return error_result(error)
