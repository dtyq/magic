"""按空间查询画布，不生成字符地图或图片。"""

from __future__ import annotations

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.canvas.presentation import error_result
from app.tools.canvas.queries.spatial_query_service import SpatialQuery, SpatialQueryService
from app.tools.canvas.tools.management_tool import CanvasManagementTool
from app.tools.canvas.tools.support import _application
from app.tools.core import tool


# 完整说明：agents/skills/canvas-manager/references/layout.md。
@tool(name="query_canvas_layout", code_mode_only=True)
class QueryCanvasLayout(CanvasManagementTool):
    """Query a finite canvas region or search the text index."""

    name = "query_canvas_layout"

    class Params(SpatialQuery):
        project_path: str = Field(min_length=1)

    params_class = Params

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        try:
            result = await SpatialQueryService(_application(tool_context).repository).query(params.project_path, params)
            lines = [
                "Canvas spatial query completed.",
                f"Project path: {params.project_path}",
                f"Scope: {params.scope}; matched={result['matched']}; page={params.page}; has_more={result['has_more']}.",
                f"Geometry complete: {result['geometry_complete']}. Pagination does not change the world region.",
            ]
            anchor = result["anchor_bounds"]
            if anchor:
                lines.append(
                    f"Reference group bounds: top-left=({anchor['x']}, {anchor['y']}), size={anchor['width']}x{anchor['height']}."
                )
            region = result["world_bounds"]
            if region:
                lines.append(
                    f"World region: top-left=({region['x']}, {region['y']}), size={region['width']}x{region['height']}."
                )
            else:
                lines.append(
                    "Scope all searches the document text index; it does not fit or render the entire infinite Canvas."
                )
            for item in result["elements"]:
                fields = [
                    f"{key}={item[key]}"
                    for key in (
                        "element_id",
                        "type",
                        "name",
                        "parent_element_id",
                        "file_name",
                        "status",
                        "content_count",
                        "active_content_id",
                        "main_content_id",
                        "visible",
                        "locked",
                        "cropped",
                    )
                    if item.get(key) is not None
                ]
                bounds = item["world_bounds"]
                if bounds:
                    fields.append(
                        f"world_position=({bounds['x']}, {bounds['y']}) | display_size={bounds['width']}x{bounds['height']}"
                    )
                relation = item.get("relation")
                if relation:
                    fields.append("reference_bounds_overlap=" + str(relation["overlaps"]))
                    for direction in ("horizontal", "vertical"):
                        if relation.get(direction):
                            fields.append(f"{direction}={relation[direction]} | gap={relation[direction + '_gap']}")
                lines.append("- " + " | ".join(fields))
            lines.extend(str(warning) for warning in result["warnings"])
            return ToolResult(content="\n".join(lines), data=result)
        except Exception as error:
            return error_result(error)
