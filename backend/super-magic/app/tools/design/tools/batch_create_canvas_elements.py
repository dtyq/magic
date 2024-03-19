"""批量创建画布元素工具

此工具用于一次性创建多个画布元素，支持自动布局和智能处理。
"""

from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.paths import PathManager
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager, ElementQuery
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.canvas_image_utils import get_image_info
from app.tools.design.utils.magic_project_design_parser import (
    ImageElement,
    TextElement,
    RectangleElement,
    EllipseElement,
    TriangleElement,
    StarElement,
    FrameElement,
    GroupElement,
    ALLOWED_ELEMENT_TYPES,
)
from app.tools.design.constants import (
    DEFAULT_ELEMENT_SPACING,
    DEFAULT_ELEMENT_WIDTH,
    DEFAULT_ELEMENT_HEIGHT,
    MAX_BATCH_ELEMENTS,
)

logger = get_logger(__name__)


class ElementCreationSpec(BaseToolParams):
    """<!--zh: 单个元素的创建规格-->
    Single element creation specification"""

    # 必需字段
    element_type: str = Field(
        ...,
        description="""<!--zh: 元素类型（必需），可选：
• 'image' - 图片
• 'text' - 文本
• 'rectangle' - 矩形
• 'ellipse' - 圆形/椭圆
• 'triangle' - 三角形
• 'star' - 星形
• 'frame' - 画框（容器）
• 'group' - 组（容器）-->
Element type (required). Options:
• 'image' - Image
• 'text' - Text
• 'rectangle' - Rectangle
• 'ellipse' - Ellipse/Circle
• 'triangle' - Triangle
• 'star' - Star
• 'frame' - Frame (container)
• 'group' - Group (container)"""
    )

    name: str = Field(
        ...,
        description="""<!--zh: 元素名称（必需），用于识别元素。示例："产品图1"、"标题文字"-->
Element name (required), used to identify element. Example: "Product Image 1", "Title Text"""
    )

    # 位置和尺寸（可选，工具会自动处理）
    x: Optional[float] = Field(
        default=None,
        description="""<!--zh: X 坐标（可选）。不提供时使用自动布局计算-->
X coordinate (optional). Auto-calculated by layout if not provided"""
    )

    y: Optional[float] = Field(
        default=None,
        description="""<!--zh: Y 坐标（可选）。不提供时使用自动布局计算-->
Y coordinate (optional). Auto-calculated by layout if not provided"""
    )

    width: Optional[float] = Field(
        default=None,
        description="""<!--zh: 宽度（可选）。图片元素会自动从文件读取-->
Width (optional). Auto-read from file for image elements"""
    )

    height: Optional[float] = Field(
        default=None,
        description="""<!--zh: 高度（可选）。图片元素会自动从文件读取-->
Height (optional). Auto-read from file for image elements"""
    )

    # 图层和显示
    zIndex: Optional[int] = Field(
        default=None,
        description="""<!--zh: 图层层级（可选）。不提供时自动递增分配-->
Z-index (optional). Auto-incremented if not provided"""
    )

    visible: Optional[bool] = Field(
        default=True,
        description="""<!--zh: 是否可见，默认 true（显示）-->
Visible or not, default true (visible)"""
    )

    opacity: Optional[float] = Field(
        default=None,
        description="""<!--zh: 透明度（可选），范围 0-1。0=完全透明，1=不透明-->
Opacity (optional), range 0-1. 0=fully transparent, 1=opaque"""
    )

    rotation: Optional[float] = Field(
        default=None,
        description="""<!--zh: 旋转角度（可选），单位为度-->
Rotation angle (optional), in degrees"""
    )

    # 交互控制
    locked: Optional[bool] = Field(
        default=False,
        description="""<!--zh: 是否锁定，默认 false（可编辑）-->
Locked or not, default false (editable)"""
    )

    draggable: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否可拖拽（可选）-->
Draggable or not (optional)"""
    )

    # 类型特定属性
    properties: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 元素类型特定属性（JSON 对象）。
图片元素：{"src": "images/photo.jpg"}
文本元素：{"content": [{"text": "Hello"}]}
形状元素：{"fill": "#FF0000", "stroke": "#000000"}
详见各元素类型说明-->
Element type specific properties (JSON object).
Image: {"src": "images/photo.jpg"}
Text: {"content": [{"text": "Hello"}]}
Shape: {"fill": "#FF0000", "stroke": "#000000"}
See element type documentation for details"""
    )

    @field_validator('properties', mode='before')
    @classmethod
    def parse_properties(cls, value):
        """Parse properties from JSON string if needed"""
        if isinstance(value, str):
            import json
            return json.loads(value)
        return value


class BatchCreateCanvasElementsParams(BaseToolParams):
    """批量创建画布元素参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）-->
Design project relative path (folder containing magic.project.js)"""
    )

    elements: List[ElementCreationSpec] = Field(
        ...,
        description=f"""<!--zh: 要创建的元素列表（1-{MAX_BATCH_ELEMENTS} 个）。
示例：创建 3 张图片
[
  {{"element_type": "image", "name": "图1", "properties": {{"src": "images/p1.jpg"}}}},
  {{"element_type": "image", "name": "图2", "properties": {{"src": "images/p2.jpg"}}}},
  {{"element_type": "image", "name": "图3", "properties": {{"src": "images/p3.jpg"}}}}
]-->
List of elements to create (1-{MAX_BATCH_ELEMENTS} elements).
Example: Create 3 images
[
  {{"element_type": "image", "name": "Image1", "properties": {{"src": "images/p1.jpg"}}}},
  {{"element_type": "image", "name": "Image2", "properties": {{"src": "images/p2.jpg"}}}},
  {{"element_type": "image", "name": "Image3", "properties": {{"src": "images/p3.jpg"}}}}
]""",
        min_length=1,
        max_length=MAX_BATCH_ELEMENTS
    )

    # 批量布局选项（可选）
    layout_mode: Optional[str] = Field(
        default=None,
        description="""<!--zh: 自动布局模式（可选）：
• 'grid' - 网格排列（像相册），可设置列数
• 'horizontal' - 水平一字排开（像导航栏）
• 'vertical' - 垂直排列（像菜单）
• 'none' - 不使用自动布局，手动指定每个元素坐标
示例：layout_mode='grid' 配合 grid_columns=3 创建 3 列网格-->
Auto layout mode (optional):
• 'grid' - Grid arrangement (like photo album), can set column count
• 'horizontal' - Horizontal row (like navigation bar)
• 'vertical' - Vertical column (like menu)
• 'none' - No auto layout, manually specify coordinates for each element
Example: layout_mode='grid' with grid_columns=3 creates 3-column grid"""
    )

    grid_columns: Optional[int] = Field(
        default=3,
        description="""<!--zh: 网格布局的列数（仅在 layout_mode='grid' 时有效）。
示例：grid_columns=4 表示每行放 4 个元素-->
Number of columns for grid layout (only when layout_mode='grid').
Example: grid_columns=4 means 4 elements per row"""
    )

    spacing: Optional[float] = Field(
        default=DEFAULT_ELEMENT_SPACING,
        description="""<!--zh: 元素之间的间距（像素），用于自动布局时计算位置-->
Spacing between elements (pixels), used to calculate positions in auto layout"""
    )

    start_x: Optional[float] = Field(
        default=100.0,
        description="""<!--zh: 自动布局的起始 X 坐标（第一个元素的位置）-->
Starting X coordinate for auto layout (position of first element)"""
    )

    start_y: Optional[float] = Field(
        default=100.0,
        description="""<!--zh: 自动布局的起始 Y 坐标（第一个元素的位置）-->
Starting Y coordinate for auto layout (position of first element)"""
    )


@tool()
class BatchCreateCanvasElements(BaseDesignTool[BatchCreateCanvasElementsParams]):
    """<!--zh
    批量创建画布元素工具

    【主要用途】一次性创建多个元素（最多 20 个），自动排版布局。

    【典型场景】
    ✓ 图片墙：创建 12 张照片，按 4x3 网格排列
    ✓ 按钮组：创建一排 5 个按钮，水平排列
    ✓ 图标列表：创建 8 个图标，垂直排列
    ✓ 快速原型：批量创建界面元素，快速搭建页面框架

    【自动布局模式】
    • grid（网格）：像相册一样按行列排列，可指定列数（grid_columns）
    • horizontal（水平）：一字横排，适合导航栏、工具栏
    • vertical（垂直）：竖向排列，适合菜单、列表
    • none（手动）：自己指定每个元素的 x, y 坐标

    【智能特性】
    • 自动读取图片尺寸：不需要手动指定 width, height
    • 自动计算位置：不需要手动算坐标
    • 自动管理图层：合理设置 zIndex 避免重叠
    • 图片视觉理解：自动并发分析图片内容（最多同时处理 10 张）

    【容错机制】
    某个元素创建失败不影响其他元素。
    最终返回成功和失败的详细信息。

    【注意事项】
    • 单次最多 20 个元素
    • 使用自动布局时，建议所有元素用相同尺寸，布局更整齐
    • 如果元素尺寸差异大，建议用 layout_mode=None 手动指定位置
    • 元素类型和属性详见 create_canvas_element 工具说明
    -->
    Batch create canvas elements tool

    【Main Purpose】Create multiple elements at once (max 20) with auto layout.

    【Typical Scenarios】
    ✓ Image wall: Create 12 photos in 4x3 grid
    ✓ Button group: Create 5 buttons in horizontal row
    ✓ Icon list: Create 8 icons in vertical column
    ✓ Quick prototype: Batch create UI elements, rapidly build page structure

    【Auto Layout Modes】
    • grid: Arrange like photo album in rows/columns, specify column count (grid_columns)
    • horizontal: Single row, suitable for navigation bars, toolbars
    • vertical: Vertical column, suitable for menus, lists
    • none: Manually specify x, y coordinates for each element

    【Smart Features】
    • Auto-read image dimensions: No need to manually specify width, height
    • Auto-calculate positions: No need to manually calculate coordinates
    • Auto-manage layers: Reasonably set zIndex to avoid overlaps
    • Image visual understanding: Auto-analyze image content concurrently (max 10 at once)

    【Error Tolerance】
    Single element failure doesn't affect others.
    Returns detailed success and failure information.

    【Notes】
    • Max 20 elements per operation
    • For auto layout, recommend same size for all elements for tidier layout
    • If element sizes vary greatly, use layout_mode=None and specify positions manually
    • Element types and properties see create_canvas_element tool description
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: BatchCreateCanvasElementsParams
    ) -> ToolResult:
        """执行批量创建元素

        Args:
            tool_context: 工具上下文
            params: 批量创建参数

        Returns:
            包含批量创建结果的 ToolResult
        """
        try:
            # 1. 确保项目已准备好
            project_path, error_result = await self._ensure_project_ready(params.project_path)
            if error_result:
                return error_result

            # 2. 验证布局模式
            if params.layout_mode and params.layout_mode not in ['grid', 'horizontal', 'vertical', 'none']:
                return ToolResult.error(
                    f"Invalid layout_mode: {params.layout_mode}. "
                    "Must be 'grid', 'horizontal', 'vertical', or 'none'.",
                    extra_info={"error_type": "design.error_invalid_property"}
                )

            # 3. 获取画布管理器
            manager = CanvasManager(str(project_path))

            # 4. 执行批量创建
            async with manager.with_lock():
                await manager.load()

                # 初始化结果列表
                results = []
                created_ids = []

                # 获取基础 z-index（批量创建的元素使用相同的 z-index）
                # 因为批量创建通常是平铺元素，不需要叠放
                base_z_index = await manager.get_next_z_index()
                if base_z_index == 0:
                    base_z_index = 1  # 如果画布为空，从 1 开始

                # 计算布局（如果启用自动布局）
                positions = await self._calculate_layout(params, manager)

                # 批量创建元素
                for i, spec in enumerate(params.elements):
                    try:
                        # 应用自动布局
                        if positions and i < len(positions):
                            if spec.x is None:
                                spec.x = positions[i]['x']
                            if spec.y is None:
                                spec.y = positions[i]['y']

                        # 如果没有布局模式，但元素缺少坐标，使用智能位置计算
                        elif spec.x is None or spec.y is None:
                            # 获取元素尺寸（用于位置计算）
                            element_width, element_height = await self._get_element_dimensions_with_fallback(
                                element_type=spec.element_type,
                                provided_width=spec.width,
                                provided_height=spec.height,
                                properties=spec.properties,
                                default_width=DEFAULT_ELEMENT_WIDTH,
                                default_height=DEFAULT_ELEMENT_HEIGHT
                            )

                            # 使用智能位置计算
                            from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position
                            try:
                                auto_x, auto_y = calculate_next_element_position(
                                    config=manager.config,
                                    element_width=element_width,
                                    element_height=element_height
                                )
                                if spec.x is None:
                                    spec.x = auto_x
                                if spec.y is None:
                                    spec.y = auto_y
                                logger.info(
                                    f"元素 {spec.name} 自动计算位置: ({spec.x}, {spec.y})"
                                )
                            except Exception as e:
                                logger.warning(f"自动计算位置失败: {e}")
                                # 失败时使用默认值
                                if spec.x is None:
                                    spec.x = 100.0
                                if spec.y is None:
                                    spec.y = 100.0

                        # 创建单个元素（传入预计算的 z-index）
                        element_id, element = await self._create_single_element(
                            tool_context, manager, spec, i, base_z_index
                        )

                        results.append({
                            "success": True,
                            "index": i + 1,
                            "element_id": element_id,
                            "name": element.name,
                            "type": element.type,
                            "x": element.x,
                            "y": element.y,
                            "width": element.width,
                            "height": element.height
                        })
                        created_ids.append(element_id)

                    except Exception as e:
                        logger.error(f"Failed to create element {spec.name}: {e}")
                        results.append({
                            "success": False,
                            "index": i + 1,
                            "name": spec.name,
                            "type": spec.element_type,
                            "error": str(e)
                        })

                # 保存配置（只保存一次）并触发文件更新事件
                config_file = self._get_magic_project_js_path(project_path)

                # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

                # 安全地保存更改
                save_error = await self._safe_save_canvas(manager, "batch create elements")
                if save_error:
                    return save_error

                # 触发文件更新后事件（通知其他系统）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

            # 5. 对图片元素执行视觉理解（批量，并发限制为 10）
            image_element_ids = [
                r["element_id"] for r in results
                if r["success"] and r["type"] == "image"
            ]

            if image_element_ids:
                await self._perform_batch_visual_understanding(
                    image_element_ids,
                    manager,
                    project_path,
                    tool_context,  # 传入 tool_context
                    concurrency=10
                )

            # 6. 生成输出
            return await self._format_batch_result(results, params, project_path, manager)

        except Exception as e:
            logger.exception(f"Failed to batch create canvas elements: {e!s}")
            return ToolResult.error(
                f"Failed to batch create canvas elements: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    async def _try_read_image_dimensions(self, src: str) -> tuple[Optional[float], Optional[float]]:
        """尝试从图片文件读取尺寸

        Args:
            src: 图片相对路径

        Returns:
            (width, height) 元组，如果读取失败返回 (None, None)
        """
        try:
            import asyncio
            from app.utils.async_file_utils import async_exists
            workspace_dir = PathManager.get_workspace_dir()
            image_path = workspace_dir / src
            if await async_exists(image_path):
                from PIL import Image
                # PIL 的 Image.open 是同步操作，需要在线程池中执行
                def _read_size():
                    with Image.open(image_path) as img:
                        return img.size
                img_width, img_height = await asyncio.to_thread(_read_size)
                return float(img_width), float(img_height)
        except Exception as e:
            logger.debug(f"无法读取图片尺寸 {src}: {e}")
        return None, None

    async def _get_element_dimensions_with_fallback(
        self,
        element_type: str,
        provided_width: Optional[float],
        provided_height: Optional[float],
        properties: Optional[Dict[str, Any]],
        default_width: float,
        default_height: float
    ) -> tuple[float, float]:
        """获取元素尺寸（配置 > 图片文件 > 默认值）

        Args:
            element_type: 元素类型
            provided_width: 配置中提供的宽度
            provided_height: 配置中提供的高度
            properties: 元素属性（可能包含 src）
            default_width: 默认宽度
            default_height: 默认高度

        Returns:
            (width, height) 元组
        """
        width = provided_width or default_width
        height = provided_height or default_height

        # 如果是图片且缺少尺寸，尝试从文件读取
        if element_type == 'image' and (not provided_width or not provided_height):
            src = properties.get('src') if properties else None
            if src:
                img_width, img_height = await self._try_read_image_dimensions(src)
                if img_width and not provided_width:
                    width = img_width
                if img_height and not provided_height:
                    height = img_height

        return width, height

    async def _calculate_layout(
        self,
        params: BatchCreateCanvasElementsParams,
        manager: CanvasManager
    ) -> Optional[List[Dict[str, float]]]:
        """计算自动布局位置

        Args:
            params: 批量创建参数
            manager: 画布管理器

        Returns:
            位置列表，每个元素为 {"x": float, "y": float}；如果不需要自动布局则返回 None
        """
        if not params.layout_mode or params.layout_mode == 'none':
            return None

        count = len(params.elements)
        positions = []

        # 获取标准尺寸（用于布局计算）
        # 优先级：配置提供的尺寸 > 图片真实尺寸 > 默认值
        # 注意：批量布局时建议所有元素使用相同尺寸，以保证布局规整

        # 默认尺寸
        standard_width = DEFAULT_ELEMENT_WIDTH
        standard_height = DEFAULT_ELEMENT_HEIGHT

        # 关键改进：自动计算布局起始位置，避免与现有元素重叠
        actual_start_x = params.start_x
        actual_start_y = params.start_y

        # 如果画布上已有元素，自动计算一个不重叠的起始位置
        if manager.config and manager.config.canvas and manager.config.canvas.elements:
            from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position
            from app.tools.design.utils.magic_project_design_parser import flatten_all_elements

            # 使用第一个元素的预估尺寸来计算起始位置
            first_elem = params.elements[0]
            estimated_width, estimated_height = await self._get_element_dimensions_with_fallback(
                element_type=first_elem.element_type,
                provided_width=first_elem.width,
                provided_height=first_elem.height,
                properties=first_elem.properties,
                default_width=standard_width,
                default_height=standard_height
            )

            # 智能换行逻辑：如果是横向布局且有多个元素，应该整体换行
            should_start_new_row = False
            if params.layout_mode == 'horizontal' and count >= 2:
                # 计算整批元素的总宽度
                total_batch_width = count * estimated_width + (count - 1) * params.spacing

                # 获取所有元素（包含子元素）
                all_elements = flatten_all_elements(manager.config)

                # 检查是否有元素在当前预期的起始行（y 坐标接近 start_y）
                # 如果有，说明当前行已经被占用，应该换到新行
                row_tolerance = estimated_height * 0.5  # 允许 50% 的误差范围
                elements_in_start_row = [
                    e for e in all_elements
                    if e.absolute_y is not None
                    and abs(e.absolute_y - params.start_y) < row_tolerance
                    and e.absolute_x is not None
                    and e.width is not None
                ]

                if elements_in_start_row:
                    # 当前行已有元素，应该换到新行
                    should_start_new_row = True
                    logger.info(
                        f"检测到当前行已有 {len(elements_in_start_row)} 个元素，"
                        f"批量创建的 {count} 个元素将整体换到新行"
                    )

            # 调用自动位置计算，找到不重叠的起始位置
            try:
                if should_start_new_row:
                    # 换到新行：找到所有元素的最大 Y + 最大 height
                    all_elements = flatten_all_elements(manager.config)
                    if all_elements:
                        max_bottom = max(
                            (e.absolute_y or 0) + (e.height or 0)
                            for e in all_elements
                            if e.absolute_y is not None and e.height is not None
                        )
                        actual_start_x = params.start_x  # 从左边开始
                        actual_start_y = max_bottom + params.spacing  # 新行的 Y 坐标
                        logger.info(
                            f"批量布局换到新行: ({actual_start_x}, {actual_start_y})"
                        )
                    else:
                        # 如果没有元素，使用默认起始位置
                        actual_start_x = params.start_x
                        actual_start_y = params.start_y
                else:
                    # 不需要换行，使用智能位置计算
                    auto_x, auto_y = calculate_next_element_position(
                        config=manager.config,
                        element_width=estimated_width,
                        element_height=estimated_height
                    )
                    actual_start_x = auto_x
                    actual_start_y = auto_y
                    logger.info(
                        f"批量布局自动计算起始位置: ({actual_start_x}, {actual_start_y})，"
                        f"避免与现有 {len(manager.config.canvas.elements)} 个元素重叠"
                    )
            except Exception as e:
                logger.warning(f"自动计算起始位置失败，使用默认值: {e}")
                # 失败时使用原始的 start_x, start_y

        if params.elements:
            first_elem = params.elements[0]

            # 获取标准尺寸（配置 > 图片文件 > 默认值）
            standard_width, standard_height = await self._get_element_dimensions_with_fallback(
                element_type=first_elem.element_type,
                provided_width=first_elem.width,
                provided_height=first_elem.height,
                properties=first_elem.properties,
                default_width=standard_width,
                default_height=standard_height
            )

            # 【方案1】如果从图片读取了尺寸，缓存到 spec 中避免后续重复读取
            if (first_elem.element_type == 'image' and
                (not first_elem.width or not first_elem.height)):
                src = first_elem.properties.get('src') if first_elem.properties else None
                if src:
                    # 回填读取到的尺寸
                    if first_elem.width is None:
                        first_elem.width = standard_width
                    if first_elem.height is None:
                        first_elem.height = standard_height
                    logger.info(
                        f"从图片文件读取尺寸用于布局计算并缓存: "
                        f"{standard_width}x{standard_height} (来源: {src})"
                    )

            # 【方案1】批量处理：为所有图片元素预读取并缓存尺寸
            for elem in params.elements:
                if (elem.element_type == 'image' and
                    (elem.width is None or elem.height is None)):
                    elem_src = elem.properties.get('src') if elem.properties else None
                    if elem_src:
                        elem_width, elem_height = await self._get_element_dimensions_with_fallback(
                            element_type=elem.element_type,
                            provided_width=elem.width,
                            provided_height=elem.height,
                            properties=elem.properties,
                            default_width=standard_width,
                            default_height=standard_height
                        )
                        # 回填尺寸到 spec
                        if elem.width is None:
                            elem.width = elem_width
                        if elem.height is None:
                            elem.height = elem_height
                        logger.debug(f"预读取并缓存图片尺寸: {elem_src} -> {elem_width}x{elem_height}")

        if params.layout_mode == 'grid':
            positions = self._calculate_grid_layout(
                count=count,
                columns=params.grid_columns,
                spacing=params.spacing,
                start_x=actual_start_x,
                start_y=actual_start_y,
                element_width=standard_width,
                element_height=standard_height
            )

        elif params.layout_mode == 'horizontal':
            positions = self._calculate_horizontal_layout(
                count=count,
                spacing=params.spacing,
                start_x=actual_start_x,
                start_y=actual_start_y,
                element_width=standard_width
            )

        elif params.layout_mode == 'vertical':
            positions = self._calculate_vertical_layout(
                count=count,
                spacing=params.spacing,
                start_x=actual_start_x,
                start_y=actual_start_y,
                element_height=standard_height
            )

        return positions

    def _calculate_grid_layout(
        self,
        count: int,
        columns: int,
        spacing: float,
        start_x: float,
        start_y: float,
        element_width: float = 100.0,
        element_height: float = 100.0
    ) -> List[Dict[str, float]]:
        """计算网格布局

        Args:
            count: 元素数量
            columns: 列数
            spacing: 间距
            start_x: 起始 X 坐标
            start_y: 起始 Y 坐标
            element_width: 元素宽度
            element_height: 元素高度

        Returns:
            位置列表
        """
        positions = []

        for i in range(count):
            row = i // columns
            col = i % columns

            x = start_x + col * (element_width + spacing)
            y = start_y + row * (element_height + spacing)

            positions.append({"x": x, "y": y})

        return positions

    def _calculate_horizontal_layout(
        self,
        count: int,
        spacing: float,
        start_x: float,
        start_y: float,
        element_width: float = 100.0
    ) -> List[Dict[str, float]]:
        """计算水平布局

        Args:
            count: 元素数量
            spacing: 间距
            start_x: 起始 X 坐标
            start_y: 起始 Y 坐标
            element_width: 元素宽度

        Returns:
            位置列表
        """
        positions = []

        for i in range(count):
            x = start_x + i * (element_width + spacing)
            y = start_y

            positions.append({"x": x, "y": y})

        return positions

    def _calculate_vertical_layout(
        self,
        count: int,
        spacing: float,
        start_x: float,
        start_y: float,
        element_height: float = 100.0
    ) -> List[Dict[str, float]]:
        """计算垂直布局

        Args:
            count: 元素数量
            spacing: 间距
            start_x: 起始 X 坐标
            start_y: 起始 Y 坐标
            element_height: 元素高度

        Returns:
            位置列表
        """
        positions = []

        for i in range(count):
            x = start_x
            y = start_y + i * (element_height + spacing)

            positions.append({"x": x, "y": y})

        return positions

    async def _create_single_element(
        self,
        tool_context: ToolContext,
        manager: CanvasManager,
        spec: ElementCreationSpec,
        index: int,
        base_z_index: int
    ) -> tuple[str, Any]:
        """创建单个元素

        Args:
            tool_context: 工具上下文
            manager: 画布管理器
            spec: 元素创建规格
            index: 元素索引（用于 z-index 递增）
            base_z_index: 基础 z-index（批量创建时统一计算）

        Returns:
            (element_id, element) 元组

        Raises:
            ValueError: 如果参数验证失败
        """
        # 1. 验证元素类型
        if spec.element_type not in ALLOWED_ELEMENT_TYPES:
            raise ValueError(
                f"Invalid element_type: {spec.element_type}. "
                f"Must be one of: {', '.join(ALLOWED_ELEMENT_TYPES)}"
            )

        # 2. 对于图片元素，自动填充尺寸
        if spec.element_type == 'image':
            await self._auto_fill_image_dimensions(tool_context, spec)

        # 3. 验证必需属性
        error = self._validate_element_requirements(spec)
        if error:
            raise ValueError(error)

        # 4. 验证位置必需
        if spec.x is None or spec.y is None:
            raise ValueError(f"Element {spec.name} missing position (x, y). Provide coordinates or enable layout_mode.")

        # 5. 生成元素 ID
        element_id = manager.generate_element_id()

        # 6. 确定 z-index（批量创建的元素使用相同的 z-index）
        if spec.zIndex is None:
            z_index = base_z_index  # 所有元素使用相同的 z-index
        else:
            z_index = spec.zIndex

        # 7. 创建元素对象
        element = self._create_element_object(element_id, spec, z_index)

        # 8. 添加元素到画布
        await manager.add_element(element)

        return element_id, element

    async def _auto_fill_image_dimensions(
        self,
        tool_context: ToolContext,
        spec: ElementCreationSpec
    ) -> None:
        """自动填充图片元素的尺寸（使用基类重试机制）

        Args:
            tool_context: 工具上下文
            spec: 元素创建规格（会被修改）
        """
        # 仅在 width 或 height 未提供时才自动读取
        if spec.width is not None and spec.height is not None:
            return

        # 获取图片路径
        properties = spec.properties or {}
        src = properties.get('src')

        if not src:
            return

        # 使用基类的重试机制读取图片尺寸
        width, height = await self._read_image_dimensions_with_retry(tool_context, src)

        if width is not None and height is not None:
            # 自动填充缺失的尺寸
            if spec.width is None:
                spec.width = width
                logger.info(f"自动读取图片宽度: {spec.width}")

            if spec.height is None:
                spec.height = height
                logger.info(f"自动读取图片高度: {spec.height}")

            logger.info(f"从 {src} 自动读取图片尺寸: {spec.width}x{spec.height}")
        else:
            # 读取失败（已在基类中记录警告）
            pass

    def _validate_element_requirements(self, spec: ElementCreationSpec) -> Optional[str]:
        """验证元素类型的必需属性

        Args:
            spec: 元素创建规格

        Returns:
            错误信息，如果验证通过则返回 None
        """
        element_type = spec.element_type

        # 需要 width 和 height 的元素类型
        size_required_types = {'image', 'rectangle', 'ellipse', 'triangle', 'star', 'frame'}

        if element_type in size_required_types:
            if spec.width is None or spec.height is None:
                return (
                    f"Element type '{element_type}' requires both width and height. "
                    f"Please provide width and height parameters."
                )

            if spec.width <= 0 or spec.height <= 0:
                return f"Width and height must be positive numbers, got width={spec.width}, height={spec.height}"

        # 验证图片元素的 src
        if element_type == 'image':
            properties = spec.properties or {}
            status = properties.get('status')
            # 只有在非生成中状态时才要求 src
            # processing/pending 状态表示图片正在生成，可以没有 src
            if status not in ('processing', 'pending') and not properties.get('src'):
                return "Image element requires 'src' property"

        return None

    def _create_element_object(
        self,
        element_id: str,
        spec: ElementCreationSpec,
        z_index: int
    ) -> Any:
        """创建元素对象

        Args:
            element_id: 元素 ID
            spec: 元素创建规格
            z_index: 图层层级

        Returns:
            元素对象
        """
        # 通用属性
        common_attrs = {
            'id': element_id,
            'name': spec.name,
            'type': spec.element_type,
            'x': spec.x,
            'y': spec.y,
            'width': spec.width,
            'height': spec.height,
            'zIndex': z_index,
            'visible': spec.visible,
            'locked': spec.locked,
            'opacity': spec.opacity,
            'rotation': spec.rotation,
            'draggable': spec.draggable,
        }

        # 获取元素特定属性
        properties = spec.properties or {}

        # 根据元素类型创建对应的元素对象
        if spec.element_type == 'image':
            return ImageElement(
                **common_attrs,
                src=properties.get('src'),
                loading=properties.get('loading', False),
                status=properties.get('status'),
                generateImageRequest=properties.get('generateImageRequest'),
                visualUnderstanding=properties.get('visualUnderstanding')
            )

        elif spec.element_type == 'text':
            return TextElement(
                **common_attrs,
                content=properties.get('content', []),
                defaultStyle=properties.get('defaultStyle')
            )

        elif spec.element_type == 'rectangle':
            return RectangleElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth'),
                cornerRadius=properties.get('cornerRadius')
            )

        elif spec.element_type == 'ellipse':
            return EllipseElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth')
            )

        elif spec.element_type == 'triangle':
            return TriangleElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth')
            )

        elif spec.element_type == 'star':
            return StarElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth'),
                sides=properties.get('sides', 5),
                innerRadiusRatio=properties.get('innerRadiusRatio', 0.5),
                cornerRadius=properties.get('cornerRadius', 0)
            )

        elif spec.element_type == 'frame':
            return FrameElement(
                **common_attrs,
                children=properties.get('children', [])
            )

        elif spec.element_type == 'group':
            return GroupElement(
                **common_attrs,
                children=properties.get('children', [])
            )

        else:
            raise ValueError(f"Unsupported element type: {spec.element_type}")

    async def _perform_batch_visual_understanding(
        self,
        image_element_ids: List[str],
        manager: CanvasManager,
        project_path: Path,
        tool_context: ToolContext,
        concurrency: int = 10
    ) -> None:
        """批量执行图片视觉理解（并发）

        Args:
            image_element_ids: 图片元素 ID 列表
            manager: 画布管理器
            project_path: 项目路径
            tool_context: 工具上下文
            concurrency: 并发数

        Note:
            此方法会在单个事务中处理所有图片的视觉理解，避免多次文件读写。
            视觉理解失败不会影响元素创建，只记录警告。
        """
        if not image_element_ids:
            return

        logger.info(f"开始批量视觉理解，共 {len(image_element_ids)} 个图片元素，并发数: {concurrency}")

        # 重新加载最新状态
        async with manager.with_lock():
            await manager.load()

            # 收集所有需要处理的图片元素
            image_elements = []
            for element_id in image_element_ids:
                element = await manager.get_element_by_id(element_id)
                if element and hasattr(element, 'src') and element.src:
                    image_elements.append((element_id, element))

            if not image_elements:
                logger.info("没有需要执行视觉理解的图片元素")
                return

            # 使用信号量限制并发数
            semaphore = asyncio.Semaphore(concurrency)

            async def process_single_image(element_id: str, element: ImageElement):
                """处理单个图片的视觉理解"""
                async with semaphore:
                    try:
                        await self._perform_visual_understanding(element, project_path)
                        logger.info(f"图片 {element_id} 视觉理解完成")
                    except Exception as e:
                        # 视觉理解失败不影响元素创建
                        logger.warning(f"图片 {element_id} 视觉理解失败: {e}")

            # 并发执行所有图片的视觉理解
            tasks = [
                process_single_image(element_id, element)
                for element_id, element in image_elements
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

            # 批量更新视觉理解结果
            for element_id, element in image_elements:
                if hasattr(element, 'visualUnderstanding') and element.visualUnderstanding:
                    await manager.update_element(
                        element_id,
                        {'visualUnderstanding': element.visualUnderstanding}
                    )

            # 保存所有更改并触发文件更新事件
            config_file = self._get_magic_project_js_path(project_path)

            # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
            await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

            # 安全地保存更改
            save_error = await self._safe_save_canvas(manager, "batch visual understanding update")
            if save_error:
                logger.error(f"保存视觉理解结果失败: {save_error.content}")
                return  # 视觉理解是后台任务，失败不影响主流程

            # 触发文件更新后事件（通知其他系统）
            await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

        logger.info(f"批量视觉理解完成")

    async def _format_batch_result(
        self,
        results: List[Dict[str, Any]],
        params: BatchCreateCanvasElementsParams,
        project_path: Path,
        manager: CanvasManager
    ) -> ToolResult:
        """格式化批量创建结果

        Args:
            results: 创建结果列表
            params: 批量创建参数
            project_path: 项目路径
            manager: 画布管理器

        Returns:
            格式化后的 ToolResult
        """
        # 统计
        total_count = len(results)
        succeeded_count = sum(1 for r in results if r["success"])
        failed_count = total_count - succeeded_count

        # 构建输出内容
        content_lines = [
            "Batch Creation Summary:",
            f"- Total: {total_count} elements",
            f"- Succeeded: {succeeded_count} elements",
            f"- Failed: {failed_count} elements",
            ""
        ]

        # 成功的元素
        if succeeded_count > 0:
            content_lines.append("Created Elements:")
            for r in results:
                if r["success"]:
                    content_lines.append(
                        f"  {r['index']}. [{r['type']}] {r['name']} "
                        f"(element_id: {r['element_id']}) - "
                        f"Position: ({r['x']:.0f}, {r['y']:.0f}), "
                        f"Size: {r['width']:.0f}×{r['height']:.0f}"
                    )
            content_lines.append("")

        # 失败的元素
        if failed_count > 0:
            content_lines.append("Failed Creations:")
            for r in results:
                if not r["success"]:
                    content_lines.append(
                        f"  {r['index']}. [{r['type']}] {r['name']} - "
                        f"Error: {r['error']}"
                    )
            content_lines.append("")

        # 布局信息
        if params.layout_mode and params.layout_mode != 'none':
            layout_desc = f"Layout: {params.layout_mode}"
            if params.layout_mode == 'grid':
                layout_desc += f" ({params.grid_columns} columns, spacing: {params.spacing}px)"
            else:
                layout_desc += f" (spacing: {params.spacing}px)"
            content_lines.append(layout_desc)

        # 保存路径
        content_lines.append(f"Changes saved to: {params.project_path}/magic.project.js")

        # 获取成功创建的元素 ID 列表
        created_element_ids = [r["element_id"] for r in results if r["success"]]

        # 构建完整的元素详情（用于前端展示）
        elements_detail = await self._build_elements_detail_from_ids(
            project_path,
            created_element_ids,
            manager
        )

        # 构建 extra_info
        extra_info = {
            "project_path": params.project_path,
            "total_count": total_count,
            "succeeded_count": succeeded_count,
            "failed_count": failed_count,
            "created_element_ids": created_element_ids,
            "elements": elements_detail,  # 完整的元素详情
            # 添加简化的元素信息（用于上层工具向后兼容）
            "created_elements": [
                {
                    "id": r["element_id"],
                    "name": r["name"],
                    "type": r["type"],
                    "x": r["x"],
                    "y": r["y"],
                    "width": r["width"],
                    "height": r["height"]
                }
                for r in results if r["success"]
            ],
            "failed_elements": [
                {
                    "index": r["index"],
                    "name": r["name"],
                    "type": r["type"],
                    "error": r["error"]
                }
                for r in results if not r["success"]
            ]
        }

        if failed_count > 0:
            # 保留原有的 errors 字段（向后兼容）
            extra_info["errors"] = extra_info["failed_elements"]

        # 总是返回成功（即使有部分失败），通过 content 和 extra_info 传递详细信息
        return ToolResult(
            content="\n".join(content_lines),
            ok=True,
            extra_info=extra_info
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not result.ok:
            return i18n.translate("create_canvas_element.exception", category="tool.messages")

        if not arguments or "elements" not in arguments:
            return i18n.translate("create_canvas_element.exception", category="tool.messages")

        elements = arguments["elements"]
        total_count = len(elements) if isinstance(elements, list) else 0

        return i18n.translate("batch_create_canvas_elements.success", category="tool.messages", count=total_count)

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: Dict[str, Any] = None
    ) -> Dict:
        """获取工具调用后的友好操作和备注

        Args:
            tool_name: 工具名称
            tool_context: 工具上下文
            result: 工具执行结果
            execution_time: 执行时间
            arguments: 执行参数

        Returns:
            Dict: 包含 action 和 remark 的字典
        """
        # 使用基类的通用错误处理方法
        return self._handle_design_tool_error(
            result,
            default_action_code="batch_create_canvas_elements",
            default_success_message_code="batch_create_canvas_elements.success"
        ) if not result.ok else {
            "action": i18n.translate("batch_create_canvas_elements", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示

        Args:
            tool_context: 工具上下文
            result: 工具结果
            arguments: 工具参数

        Returns:
            Optional[ToolDetail]: 工具详情
        """
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            # 从 extra_info 获取数据
            extra_info = result.extra_info or {}
            project_path = extra_info.get("project_path", "")
            elements = extra_info.get("elements", [])

            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=project_path,
                    elements=elements
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
