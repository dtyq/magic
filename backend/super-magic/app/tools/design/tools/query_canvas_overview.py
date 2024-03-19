"""查询画布概览工具

此工具用于查询设计项目画布的概览信息，包括元素列表、统计信息、空间分布等。
"""

from app.i18n import i18n
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager, ElementQuery
from app.tools.design.tools.base_design_tool import BaseDesignTool

logger = get_logger(__name__)

# 允许的排序方式
ALLOWED_SORT_TYPES = {"layer", "position", "type"}


class QueryCanvasOverviewParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    sort_by: str = Field(
        default="layer",
        description="""<!--zh: 排序方式：
- "layer"：按图层层级排序（zIndex 从小到大，底层在前）
- "position"：按位置排序（从左上到右下，先 y 后 x）
- "type"：按元素类型分组排序
-->
Sort method:
- "layer": Sort by layer level (zIndex from small to large, bottom layer first)
- "position": Sort by position (top-left to bottom-right, y first then x)
- "type": Sort by element type grouping
"""
    )

    visible_only: bool = Field(
        default=False,
        description="""<!--zh: 是否只显示可见元素（visible=true）-->
Whether to show only visible elements (visible=true)"""
    )

    element_types: Optional[List[str]] = Field(
        default=None,
        description="""<!--zh: 元素类型过滤列表，如 ["image", "text"]，为空则显示所有类型-->
Element type filter list, e.g., ["image", "text"], empty shows all types"""
    )

    offset: int = Field(
        default=0,
        ge=0,
        description="""<!--zh: 分页偏移量，从第几个元素开始返回（从 0 开始）-->
Pagination offset, which element to start from (0-based)"""
    )

    limit: int = Field(
        default=50,
        ge=1,
        le=50,
        description="""<!--zh: 每页返回的最大元素数量（最大 50）-->
Maximum number of elements per page (max 50)"""
    )

    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v: str) -> str:
        """Validate sort_by is allowed"""
        if v not in ALLOWED_SORT_TYPES:
            raise ValueError(
                f"Invalid sort_by '{v}'. Allowed values: {', '.join(sorted(ALLOWED_SORT_TYPES))}"
            )
        return v


@tool()
class QueryCanvasOverview(BaseDesignTool[QueryCanvasOverviewParams]):
    """<!--zh
    查询画布概览工具

    此工具用于查询设计项目画布的概览信息，返回优化的结构化数据格式。

    返回信息包括：
    - 项目基本信息（项目名称、版本等）
    - 画布统计信息（元素总数、可见元素数、类型分布等）
    - 空间分布信息（画布边界、中心点等）
    - 元素列表（按指定方式排序和过滤）

    排序方式：
    - layer：按图层层级排序（zIndex 从小到大，底层元素在前）
    - position：按位置排序（从左上到右下，先按 y 坐标后按 x 坐标）
    - type：按元素类型分组排序

    过滤选项：
    - visible_only：只显示可见元素
    - element_types：只显示指定类型的元素

    分页功能：
    - offset：从第几个元素开始返回（默认 0）
    - limit：每页最多返回多少个元素（默认 50，最大 50）
    - 当有剩余元素时，会显示剩余元素的类型统计概览
    - 提示下次查询的 offset 值以获取更多数据

    使用场景：
    - 快速了解画布上有哪些元素
    - 获取画布的整体统计信息
    - 为进一步操作提供上下文信息
    - 分析画布的空间布局

    注意：
    - 此工具不包含详细的元素属性，如需详细信息请使用 query_canvas_element
    - 返回的元素列表是简化格式，便于大模型快速理解
    - 空画布也会返回成功结果，只是元素列表为空
    - 单次最多返回 50 个元素，避免上下文过载
    -->
    Query canvas overview tool

    This tool queries the overview information of the design project canvas, returning optimized structured data format.

    Returned information includes:
    - Project basic information (project name, version, etc.)
    - Canvas statistics (total elements, visible elements, type distribution, etc.)
    - Spatial distribution (canvas bounds, center point, etc.)
    - Element list (sorted and filtered as specified)

    Sort methods:
    - layer: Sort by layer level (zIndex from small to large, bottom layer first)
    - position: Sort by position (top-left to bottom-right, y first then x)
    - type: Sort by element type grouping

    Filter options:
    - visible_only: Show only visible elements
    - element_types: Show only specified element types

    Pagination:
    - offset: Which element to start from (default 0)
    - limit: Maximum elements per page (default 50, max 50)
    - Shows remaining elements overview when there are more
    - Suggests next offset value to fetch more data

    Use cases:
    - Quickly understand what elements are on canvas
    - Get overall canvas statistics
    - Provide context for further operations
    - Analyze canvas spatial layout

    Notes:
    - This tool does not include detailed element properties, use query_canvas_element for details
    - Returned element list is simplified format for quick LLM understanding
    - Empty canvas also returns success result, just with empty element list
    - Maximum 50 elements per request to avoid context overload
    """

    async def execute(self, tool_context: ToolContext, params: QueryCanvasOverviewParams) -> ToolResult:
        """Execute canvas overview query operation

        Args:
            tool_context: Tool context
            params: Parameter object containing query information

        Returns:
            ToolResult: Contains canvas overview data
        """
        try:
            # Use base class method with retry to ensure project is ready
            project_path, error_result = await self._ensure_project_ready_with_retry(
                params.project_path,
                require_magic_project_js=True,
                max_retries=3,
                retry_delay=0.2
            )
            if error_result:
                return error_result

            # Initialize CanvasManager
            manager = CanvasManager(str(project_path))
            await manager.load()

            # Get project configuration
            config = manager.config

            # Get canvas statistics
            stats = await manager.get_statistics()

            # Build query conditions
            query = ElementQuery(
                visible_only=params.visible_only
            )

            # Query elements
            elements = await manager.query_elements(query)

            # Filter by element types if specified
            if params.element_types:
                element_types_set = set(params.element_types)
                elements = [e for e in elements if e.type in element_types_set]

            # Sort elements
            sorted_elements = self._sort_elements(elements, params.sort_by)

            # Apply pagination
            total_elements_count = len(sorted_elements)
            start_idx = params.offset
            end_idx = min(start_idx + params.limit, total_elements_count)
            paginated_elements = sorted_elements[start_idx:end_idx]

            # Calculate remaining elements statistics
            remaining_elements = sorted_elements[end_idx:]
            remaining_stats = self._calculate_remaining_stats(remaining_elements) if remaining_elements else None

            # Build element list data
            elements_data = []
            for element in paginated_elements:
                element_data = self._build_element_data(element)
                elements_data.append(element_data)

            # Build spatial distribution data
            spatial_distribution = self._build_spatial_distribution(stats)

            # Build viewport data
            viewport_data = None
            if config.canvas and config.canvas.viewport:
                viewport = config.canvas.viewport
                viewport_data = {
                    "scale": viewport.scale,
                    "x": viewport.x,
                    "y": viewport.y
                }

            # Build result data
            result_data = {
                "project_name": config.name or "Untitled",
                "project_version": config.version,
                "canvas_info": {
                    "total_elements": stats.total_elements,
                    "visible_elements": stats.visible_elements,
                    "locked_elements": stats.locked_elements,
                    "element_types": dict(stats.elements_by_type),
                    "z_index_range": {
                        "min": stats.z_index_range[0],
                        "max": stats.z_index_range[1]
                    },
                    "spatial_distribution": spatial_distribution,
                    "viewport": viewport_data
                },
                "elements": elements_data,
                "query_info": {
                    "sort_by": params.sort_by,
                    "visible_only": params.visible_only,
                    "element_types_filter": params.element_types,
                    "result_count": len(elements_data)
                },
                "pagination": {
                    "offset": params.offset,
                    "limit": params.limit,
                    "total_matched": total_elements_count,
                    "showing": len(elements_data),
                    "has_more": end_idx < total_elements_count,
                    "remaining_count": len(remaining_elements),
                    "remaining_stats": remaining_stats
                }
            }

            # Generate result content
            result_content = self._generate_result_content(result_data, params)

            return ToolResult(
                content=result_content,
                data=result_data
            )

        except Exception as e:
            logger.exception(f"Failed to query canvas overview: {e!s}")
            return ToolResult.error(
                f"Failed to query canvas overview: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    # noinspection PyMethodMayBeStatic
    def _sort_elements(self, elements: List[Any], sort_by: str) -> List[Any]:
        """Sort element list

        Args:
            elements: Element list
            sort_by: Sort method

        Returns:
            Sorted element list
        """
        if sort_by == "layer":
            # Sort by zIndex (ascending), then by id
            return sorted(elements, key=lambda e: (e.zIndex or 0, e.id))
        elif sort_by == "position":
            # Sort by position (y first, then x), then by id
            return sorted(elements, key=lambda e: (e.y or 0, e.x or 0, e.id))
        elif sort_by == "type":
            # Sort by type, then by id
            return sorted(elements, key=lambda e: (e.type, e.id))
        else:
            return elements

    # noinspection PyMethodMayBeStatic
    def _calculate_remaining_stats(self, remaining_elements: List[Any]) -> Dict[str, int]:
        """Calculate statistics for remaining elements

        Args:
            remaining_elements: List of remaining elements

        Returns:
            Dictionary with element type counts
        """
        stats = {}
        for element in remaining_elements:
            element_type = element.type
            stats[element_type] = stats.get(element_type, 0) + 1
        return stats

    # noinspection PyMethodMayBeStatic
    def _build_element_data(self, element: Any) -> Dict[str, Any]:
        """Build simplified element data for overview

        Args:
            element: Element object

        Returns:
            Simplified element data dictionary
        """
        data = {
            "id": element.id,
            "name": element.name,
            "type": element.type,
            "position": {
                "x": element.x,
                "y": element.y
            },
            "size": {
                "width": element.width,
                "height": element.height
            },
            "layer": element.zIndex or 0,
            "status": {
                "visible": element.visible if element.visible is not None else True,
                "locked": element.locked or False,
                "opacity": element.opacity if element.opacity is not None else 1.0
            }
        }

        # 对于图片元素，添加额外信息
        if element.type == 'image':
            # 1. 添加生成提示词（如果有）
            if hasattr(element, 'generateImageRequest') and element.generateImageRequest:
                gir = element.generateImageRequest
                if isinstance(gir, dict):
                    prompt = gir.get('prompt')
                else:
                    prompt = getattr(gir, 'prompt', None)

                if prompt:
                    data["prompt"] = prompt

            # 2. 添加视觉理解摘要（如果有）
            if hasattr(element, 'visualUnderstanding') and element.visualUnderstanding:
                vu = element.visualUnderstanding
                if isinstance(vu, dict):
                    summary = vu.get('summary')
                else:
                    summary = getattr(vu, 'summary', None)

                if summary:
                    data["visual_summary"] = summary

        return data

    # noinspection PyMethodMayBeStatic
    def _build_spatial_distribution(self, stats: Any) -> Optional[Dict[str, Any]]:
        """Build spatial distribution data

        Args:
            stats: Canvas statistics

        Returns:
            Spatial distribution data or None
        """
        if not stats.canvas_bounds:
            return None

        min_x, min_y, max_x, max_y = stats.canvas_bounds
        width = max_x - min_x
        height = max_y - min_y
        center_x = min_x + width / 2
        center_y = min_y + height / 2

        return {
            "bounds": {
                "min_x": round(min_x, 2),
                "min_y": round(min_y, 2),
                "max_x": round(max_x, 2),
                "max_y": round(max_y, 2),
                "width": round(width, 2),
                "height": round(height, 2)
            },
            "center": {
                "x": round(center_x, 2),
                "y": round(center_y, 2)
            }
        }

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(self, result_data: Dict[str, Any], params: QueryCanvasOverviewParams) -> str:
        """Generate structured result content

        Args:
            result_data: Result data dictionary
            params: Tool parameters

        Returns:
            Formatted result content
        """
        canvas_info = result_data["canvas_info"]
        query_info = result_data["query_info"]
        pagination = result_data["pagination"]

        result = f"""Project Information:
- Project Name: {result_data['project_name']}
- Project Version: {result_data['project_version']}

Canvas Statistics:
- Total Elements: {canvas_info['total_elements']}
- Visible Elements: {canvas_info['visible_elements']}
- Locked Elements: {canvas_info['locked_elements']}
- Z-index Range: {canvas_info['z_index_range']['min']} ~ {canvas_info['z_index_range']['max']}"""

        # Element type distribution
        if canvas_info['element_types']:
            result += "\n\nElement Type Distribution:"
            for element_type, count in sorted(canvas_info['element_types'].items()):
                result += f"\n  • {element_type}: {count}"

        # Spatial distribution
        if canvas_info['spatial_distribution']:
            spatial = canvas_info['spatial_distribution']
            bounds = spatial['bounds']
            center = spatial['center']
            result += f"\n\nSpatial Distribution:"
            result += f"\n  • Bounds: ({bounds['min_x']}, {bounds['min_y']}) ~ ({bounds['max_x']}, {bounds['max_y']})"
            result += f"\n  • Canvas Size: {bounds['width']} × {bounds['height']}"
            result += f"\n  • Center Point: ({center['x']}, {center['y']})"

        # Viewport
        if canvas_info['viewport']:
            viewport = canvas_info['viewport']
            result += f"\n\nViewport State:"
            result += f"\n  • Scale: {viewport['scale']:.2f}"
            result += f"\n  • Offset: ({viewport['x']:.1f}, {viewport['y']:.1f})"

        # Pagination info
        result += f"\n\nPagination:"
        result += f"\n  • Showing: {pagination['showing']} of {pagination['total_matched']} (offset: {pagination['offset']})"
        if pagination['has_more']:
            result += f"\n  • Remaining: {pagination['remaining_count']} elements not shown"

        # Element list (summary)
        if result_data['elements']:
            result += f"\n\nElements:"
            for i, elem in enumerate(result_data['elements'], 1 + pagination['offset']):
                result += f"\n  {i}. [{elem['type']}] {elem['name']} (element_id: {elem['id']})"
                result += f"\n     Position: ({elem['position']['x']}, {elem['position']['y']})"
                result += f", Size: {elem['size']['width']}×{elem['size']['height']}"
                result += f", Layer: {elem['layer']}"
                status_flags = []
                if not elem['status']['visible']:
                    status_flags.append("hidden")
                if elem['status']['locked']:
                    status_flags.append("locked")
                if elem['status']['opacity'] < 1.0:
                    status_flags.append(f"opacity:{elem['status']['opacity']:.2f}")
                if status_flags:
                    result += f" ({', '.join(status_flags)})"

                # 显示图片元素的额外信息
                if elem['type'] == 'image':
                    # 显示生成提示词
                    if 'prompt' in elem:
                        prompt = elem['prompt']
                        # 截断提示词以保持简洁
                        if len(prompt) > 80:
                            prompt = prompt[:77] + "..."
                        result += f"\n     Prompt: {prompt}"

                    # 显示视觉理解摘要
                    if 'visual_summary' in elem:
                        visual_summary = elem['visual_summary']
                        # 截断摘要以保持简洁
                        if len(visual_summary) > 80:
                            visual_summary = visual_summary[:77] + "..."
                        result += f"\n     Visual: {visual_summary}"

            # Show remaining elements overview if there are more
            if pagination['has_more'] and pagination['remaining_stats']:
                result += f"\n\nRemaining Elements Overview ({pagination['remaining_count']} not shown):"
                for elem_type, count in sorted(pagination['remaining_stats'].items()):
                    result += f"\n  • {elem_type}: {count}"
                result += f"\n\nTo view more elements, use offset={pagination['offset'] + pagination['showing']}"
        else:
            result += "\n\nNo elements found matching the query criteria."

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not result.ok:
            return i18n.translate("query_canvas_overview.exception", category="tool.messages")

        return i18n.translate("query_canvas_overview.success", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """Get friendly action and remark after tool call

        Args:
            tool_name: Tool name
            tool_context: Tool context
            result: Tool execution result
            execution_time: Execution time
            arguments: Execution arguments

        Returns:
            Dict: Contains action and remark
        """
        # query_canvas_overview 通常不会遇到文件修改错误（它是读操作），但仍使用统一处理
        return self._handle_design_tool_error(
            result,
            default_action_code="query_canvas_overview",
            default_success_message_code="query_canvas_overview.success"
        ) if not result.ok else {
            "action": i18n.translate("query_canvas_overview", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok or not arguments:
            return None

        try:
            project_path = arguments.get("project_path", "")
            sort_by = arguments.get("sort_by", "layer")
            visible_only = arguments.get("visible_only", False)
            element_types = arguments.get("element_types")

            # 从 result.content 提取信息（这是一个简化版本）
            content = f"""## 📊 画布概览查询完成

### 查询配置
- **项目路径**: `{project_path}`
- **排序方式**: {sort_by}
- **仅可见元素**: {'是' if visible_only else '否'}
"""
            if element_types:
                content += f"- **元素类型过滤**: {', '.join(element_types)}\n"

            # 添加原始结果内容（已经是格式化的）
            if result.content:
                content += "\n---\n\n"
                content += result.content

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name="canvas_overview.md",
                    content=content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
