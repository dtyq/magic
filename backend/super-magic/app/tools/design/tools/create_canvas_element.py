"""创建画布图片元素工具

此工具用于在设计项目的画布上创建图片元素。
"""

from app.i18n import i18n
import asyncio
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager, ElementQuery
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.canvas_image_utils import get_image_info
from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position
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

logger = get_logger(__name__)


class CreateCanvasElementParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    element_type: str = Field(
        ...,
        description="""<!--zh: 元素类型，固定值：'image'（图片）-->
Element type. Fixed value: 'image' (image)"""
    )

    name: str = Field(
        ...,
        description="""<!--zh: 元素名称，用于标识元素，便于查找和管理-->
Element name for identification, easier to find and manage"""
    )

    x: Optional[float] = Field(
        default=None,
        description="""<!--zh: X 坐标位置（可选）。用户明确指定时使用指定值，不提供时自动计算合适位置避免重叠-->
X coordinate (optional). Uses specified value when provided, auto-calculates to avoid overlap when not provided"""
    )

    y: Optional[float] = Field(
        default=None,
        description="""<!--zh: Y 坐标位置（可选）。用户明确指定时使用指定值，不提供时自动计算合适位置避免重叠-->
Y coordinate (optional). Uses specified value when provided, auto-calculates to avoid overlap when not provided"""
    )

    width: Optional[float] = Field(
        default=None,
        description="""<!--zh: 元素宽度（可选）。图片元素不提供时自动从文件读取；其他需要尺寸的元素必须提供-->
Element width (optional). Image elements auto-read from file when not provided; other elements requiring dimensions must provide this"""
    )

    height: Optional[float] = Field(
        default=None,
        description="""<!--zh: 元素高度（可选）。图片元素不提供时自动从文件读取；其他需要尺寸的元素必须提供-->
Element height (optional). Image elements auto-read from file when not provided; other elements requiring dimensions must provide this"""
    )

    element_id: Optional[str] = Field(
        default=None,
        description="""<!--zh: 元素ID（可选），不提供则自动生成唯一ID-->
Element ID (optional), auto-generate unique ID if not provided"""
    )

    z_index: Optional[int] = Field(
        default=None,
        description="""<!--zh: 图层层级，数值越大越靠上，默认为当前最大值+1-->
Layer z-index, higher value on top, default is current max+1"""
    )

    visible: bool = Field(
        default=True,
        description="""<!--zh: 是否可见，默认 true-->
Visible or not, default true"""
    )

    locked: bool = Field(
        default=False,
        description="""<!--zh: 是否锁定（锁定后不可编辑），默认 false-->
Locked or not (cannot edit when locked), default false"""
    )

    opacity: float = Field(
        default=1.0,
        description="""<!--zh: 透明度（0-1），默认 1.0（完全不透明）-->
Opacity (0-1), default 1.0 (fully opaque)"""
    )

    properties: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 图片元素的属性（JSON 对象，可选）。

示例：
- 图片路径: {"src": "Demo/images/photo.jpg"}
  * src 相对于工作区根目录
- AI生成图片: {"src": "...", "generateImageRequest": {"model_id": "...", "prompt": "...", "size": "...", "resolution": "...", "image_id": "..."}}
  * 建议保存生成信息以便追溯
-->
Image element properties (JSON object, optional).

Examples:
- Image path: {"src": "Demo/images/photo.jpg"}
  * src relative to workspace root
- AI-generated image: {"src": "...", "generateImageRequest": {"model_id": "...", "prompt": "...", "size": "...", "resolution": "...", "image_id": "..."}}
  * Recommend saving generation metadata for traceability
"""
    )

    @field_validator('element_type')
    @classmethod
    def validate_element_type(cls, v: str) -> str:
        """验证元素类型是否合法"""
        if v not in ALLOWED_ELEMENT_TYPES:
            raise ValueError(
                f"Invalid element_type '{v}'. Allowed types: {', '.join(sorted(ALLOWED_ELEMENT_TYPES))}"
            )
        return v

    @field_validator('opacity')
    @classmethod
    def validate_opacity(cls, v: float) -> float:
        """验证透明度范围"""
        if not 0 <= v <= 1:
            raise ValueError(f"Opacity must be between 0 and 1, got {v}")
        return v

    @field_validator('properties', mode='before')
    @classmethod
    def parse_properties(cls, v: Any) -> Optional[Dict[str, Any]]:
        """Parse properties from string or dict

        Allows LLM to pass properties as either:
        - A dictionary object: {"fill": "#FF0000"}
        - A JSON string: '{"fill": "#FF0000"}'
        """
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, str):
            # Try to parse JSON string
            import json
            try:
                parsed = json.loads(v)
                if not isinstance(parsed, dict):
                    raise ValueError("Properties must be a JSON object")
                return parsed
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON string for properties: {str(e)}")
        raise ValueError(f"Properties must be a dict or valid JSON string, got {type(v)}")


@tool()
class CreateCanvasElement(BaseDesignTool[CreateCanvasElementParams]):
    """<!--zh
    创建画布图片元素工具

    此工具用于在设计项目的画布上创建图片元素：
    - 支持设置 src（图片路径或URL）
    - 自动读取图片尺寸（如果未提供 width/height）
    - 支持保存 AI 生成信息（generateImageRequest）以便追溯
    - 支持视觉理解分析（自动提取图片内容描述）

    元素支持的属性：
    - 位置和尺寸（x、y、width、height）
      * x、y 可选：未提供时自动计算最佳位置，避免与现有元素重叠
      * width、height 可选：自动从图片文件读取实际尺寸
    - 图层层级（zIndex）：控制图片的前后层级关系
    - 可见性（visible）：是否显示图片
    - 锁定状态（locked）：锁定后不可编辑
    - 透明度（opacity）：0-1之间，1为完全不透明

    元素会自动分配唯一 ID，也可通过 element_id 参数自定义。
    创建的元素会立即保存到画布项目中。

    智能功能：
    - 自动位置计算：未提供 x/y 时，智能布局避免重叠
    - 自动尺寸读取：自动读取图片实际尺寸
    - AI 信息追溯：保存图片生成的完整上下文信息
    - 视觉理解：自动分析图片内容并生成描述

    注意事项：
    - properties 中的 src 字段是必需的（图片路径相对于工作区根目录）
    - 元素 ID 在画布内必须唯一，如果指定的 ID 已存在会返回错误
    -->
    Create canvas image element tool

    This tool creates image elements on the design project canvas:
    - Supports src (image path or URL)
    - Auto-reads image dimensions (if width/height not provided)
    - Supports saving AI generation info (generateImageRequest) for traceability
    - Supports visual understanding analysis (auto-extracts image content description)

    Supported element properties:
    - Position and size (x, y, width, height)
      * x, y optional: Auto-calculates optimal position to avoid overlap if not provided
      * width, height optional: Auto-reads from image file
    - Layer z-index (zIndex): Controls image layer order
    - Visibility (visible): Whether to display the image
    - Lock status (locked): Cannot edit when locked
    - Opacity (opacity): 0-1, 1 is fully opaque

    Elements are auto-assigned unique IDs, customizable via element_id parameter.
    Created elements are immediately saved to canvas project.

    Smart Features:
    - Auto-positioning: Smart layout to avoid overlap when x/y not provided
    - Auto-sizing: Auto-reads actual image dimensions
    - AI info tracking: Saves complete generation context
    - Visual understanding: Auto-analyzes image content and generates descriptions

    Note:
    - The src field in properties is required (image path relative to workspace root)
    - Element IDs must be unique across the canvas, error returned if specified ID already exists
    """

    async def execute(self, tool_context: ToolContext, params: CreateCanvasElementParams) -> ToolResult:
        """执行画布元素创建操作

        Args:
            tool_context: 工具上下文
            params: 包含元素信息的参数对象

        Returns:
            ToolResult: 包含创建结果详细信息
        """
        try:
            # 使用基类方法确保项目已准备好
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # 对于图片元素，自动读取尺寸（如果未提供）
            if params.element_type == 'image':
                await self._auto_fill_image_dimensions(tool_context, params)

            # 验证元素类型的必需属性
            validation_error = self._validate_element_requirements(params)
            if validation_error:
                return ToolResult.error(
                    validation_error,
                    extra_info={"error_type": "design.error_invalid_property"}
                )

            # 初始化 CanvasManager
            manager = CanvasManager(str(project_path))

            # 使用画布锁保护整个操作过程（防止并发修改）
            async with manager.with_lock():
                await manager.load()

                # 如果指定了 element_id，检查是否已存在
                if params.element_id:
                    if await manager.element_exists(params.element_id):
                        return self._error_duplicate_id(params.element_id)

                # 自动计算位置（如果未提供 x 或 y）
                if params.x is None or params.y is None:
                    await self._auto_calculate_position(manager, params)

                # 创建元素对象
                element = self._create_element(params, manager)

                # 如果未指定 z_index，使用下一个可用值
                if params.z_index is None:
                    element.zIndex = await manager.get_next_z_index()
                else:
                    element.zIndex = params.z_index

                # 对于图片元素，自动执行视觉理解（在添加元素之前）
                if params.element_type == 'image':
                    await self._perform_visual_understanding(element, project_path)

                # 添加元素到画布
                element_id = await manager.add_element(element)

                # 获取配置文件路径
                config_file = self._get_magic_project_js_path(project_path)

                # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

                # 安全地保存更改
                save_error = await self._safe_save_canvas(manager, "create element")
                if save_error:
                    return save_error

                # 触发文件更新后事件（通知其他系统）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

            # 生成结果信息
            result_content = self._generate_result_content(params, element_id)

            # 构建元素详情信息（用于前端展示），使用公共方法
            elements_detail = await self._build_elements_detail_from_ids(
                project_path,
                [element_id],
                manager
            )

            return ToolResult(
                content=result_content,
                extra_info={
                    "project_path": params.project_path,
                    "elements": elements_detail
                }
            )

        except Exception as e:
            logger.exception(f"Failed to create canvas element: {e!s}")
            return ToolResult.error(
                f"Failed to create canvas element: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    # noinspection PyMethodMayBeStatic
    def _validate_element_requirements(self, params: CreateCanvasElementParams) -> Optional[str]:
        """验证元素类型的必需属性

        Args:
            params: 工具参数

        Returns:
            错误信息，如果验证通过则返回 None
        """
        element_type = params.element_type

        # 需要 width 和 height 的元素类型（图片元素已在前面自动填充，所以此处也需要验证）
        size_required_types = {'image', 'rectangle', 'ellipse', 'triangle', 'star', 'frame'}

        if element_type in size_required_types:
            if params.width is None or params.height is None:
                return (
                    f"Element type '{element_type}' requires both width and height. "
                    f"Please provide width and height parameters."
                )

            if params.width <= 0 or params.height <= 0:
                return f"Width and height must be positive numbers, got width={params.width}, height={params.height}"

        return None

    async def _auto_fill_image_dimensions(
        self,
        tool_context: ToolContext,
        params: CreateCanvasElementParams
    ) -> None:
        """自动填充图片元素的尺寸属性（使用基类重试机制）

        从图片文件读取实际尺寸，如果 width 或 height 未提供。

        Args:
            tool_context: 工具上下文
            params: 工具参数（会被修改）

        Raises:
            ValueError: 如果图片文件不存在或无法读取
        """
        # 仅在 width 或 height 未提供时才自动读取
        if params.width is not None and params.height is not None:
            return

        # 获取图片路径
        properties = params.properties or {}
        src = properties.get('src')

        if not src:
            # 如果没有 src，无法自动读取尺寸，将在后续验证中失败
            return

        # 使用基类的重试机制读取图片尺寸
        width, height = await self._read_image_dimensions_with_retry(tool_context, src)

        if width is not None and height is not None:
            # 自动填充缺失的尺寸
            if params.width is None:
                params.width = width
                logger.info(f"自动读取图片宽度: {params.width}")

            if params.height is None:
                params.height = height
                logger.info(f"自动读取图片高度: {params.height}")

            logger.info(f"从 {src} 自动读取图片尺寸: {params.width}x{params.height}")
        else:
            # 读取失败，记录警告（将在后续验证中失败）
            logger.warning(f"无法从图片文件读取尺寸 {src}")

    async def _auto_calculate_position(
        self,
        manager: CanvasManager,
        params: CreateCanvasElementParams
    ) -> None:
        """自动计算元素位置（使用绝对坐标系统）

        如果 x 或 y 未提供，使用智能布局算法计算最佳位置。
        计算会考虑所有元素（包括容器内的子元素）。

        Args:
            manager: 画布管理器
            params: 工具参数（会被修改）
        """
        # 如果 x 和 y 都已提供，无需计算
        if params.x is not None and params.y is not None:
            return

        # 获取配置对象（用于坐标计算）
        config = manager.config

        # 确定元素尺寸（用于位置计算）
        element_width = params.width if params.width is not None else 200.0
        element_height = params.height if params.height is not None else 150.0

        # 计算最佳位置（使用新的坐标系统）
        auto_x, auto_y = calculate_next_element_position(
            config=config,
            element_width=element_width,
            element_height=element_height
        )

        # 填充缺失的坐标
        if params.x is None:
            params.x = auto_x
            logger.info(f"自动计算 X 坐标（绝对坐标）: {params.x}")

        if params.y is None:
            params.y = auto_y
            logger.info(f"自动计算 Y 坐标（绝对坐标）: {params.y}")

        logger.info(f"元素自动定位在（画布绝对坐标）: ({params.x}, {params.y})")

    # noinspection PyMethodMayBeStatic
    def _create_element(self, params: CreateCanvasElementParams, manager: CanvasManager):
        """根据参数创建对应类型的元素对象

        Args:
            params: 工具参数
            manager: 画布管理器

        Returns:
            创建的元素对象
        """
        # 生成或使用指定的元素 ID
        element_id = params.element_id if params.element_id else manager.generate_element_id()

        # 通用属性
        common_attrs = {
            'id': element_id,
            'name': params.name,
            'type': params.element_type,
            'x': params.x,
            'y': params.y,
            'width': params.width,
            'height': params.height,
            'zIndex': params.z_index,
            'visible': params.visible,
            'locked': params.locked,
            'opacity': params.opacity,
        }

        # 获取元素特定属性
        properties = params.properties or {}

        # 根据元素类型创建对应的元素对象
        if params.element_type == 'image':
            return ImageElement(
                **common_attrs,
                src=properties.get('src'),
                loading=properties.get('loading', False),
                generateImageRequest=properties.get('generateImageRequest'),
                visualUnderstanding=properties.get('visualUnderstanding')
            )

        elif params.element_type == 'text':
            return TextElement(
                **common_attrs,
                content=properties.get('content', []),
                defaultStyle=properties.get('defaultStyle')
            )

        elif params.element_type == 'rectangle':
            return RectangleElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth'),
                cornerRadius=properties.get('cornerRadius')
            )

        elif params.element_type == 'ellipse':
            return EllipseElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth')
            )

        elif params.element_type == 'triangle':
            return TriangleElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth')
            )

        elif params.element_type == 'star':
            return StarElement(
                **common_attrs,
                fill=properties.get('fill'),
                stroke=properties.get('stroke'),
                strokeWidth=properties.get('strokeWidth'),
                sides=properties.get('sides', 5),
                innerRadiusRatio=properties.get('innerRadiusRatio', 0.5),
                cornerRadius=properties.get('cornerRadius')
            )

        elif params.element_type == 'frame':
            return FrameElement(
                **common_attrs,
                children=properties.get('children', [])
            )

        elif params.element_type == 'group':
            return GroupElement(
                **common_attrs,
                children=properties.get('children', [])
            )

        else:
            raise ValueError(f"Unsupported element type: {params.element_type}")

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(self, params: CreateCanvasElementParams, element_id: str) -> str:
        """生成结构化的结果内容

        Args:
            params: 工具参数
            element_id: 创建的元素 ID

        Returns:
            格式化的结果内容
        """
        result = f"""Element Details:
- Type: {params.element_type}
- Name: {params.name}
- ID: {element_id}
- Position: ({params.x}, {params.y})"""

        if params.width is not None and params.height is not None:
            result += f"\n- Size: {params.width} × {params.height}"

        if params.z_index is not None:
            result += f"\n- Layer: {params.z_index}"

        result += f"\n\nElement added to: {params.project_path}/magic.project.js"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "element_type" not in arguments or "name" not in arguments:
            return i18n.translate("create_canvas_element.exception", category="tool.messages")

        element_type = arguments["element_type"]
        element_name = arguments["name"]

        return i18n.translate("create_canvas_element.success", category="tool.messages", element_type=element_type,
            element_name=element_name)

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
            default_action_code="create_canvas_element",
            default_success_message_code="create_canvas_element.success"
        ) if not result.ok else {
            "action": i18n.translate("create_canvas_element", category="tool.actions"),
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
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            # 优先从 extra_info 获取数据
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
