"""更新画布元素工具

此工具用于更新设计项目画布上已存在元素的属性。
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
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.canvas_image_utils import get_image_info

logger = get_logger(__name__)


class UpdateCanvasElementParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    element_id: str = Field(
        ...,
        description="""<!--zh: 要更新的元素 ID-->
ID of the element to update"""
    )

    name: Optional[str] = Field(
        default=None,
        description="""<!--zh: 元素名称（可选）-->
Element name (optional)"""
    )

    x: Optional[float] = Field(
        default=None,
        description="""<!--zh: X 坐标位置（可选）-->
X coordinate position (optional)"""
    )

    y: Optional[float] = Field(
        default=None,
        description="""<!--zh: Y 坐标位置（可选）-->
Y coordinate position (optional)"""
    )

    width: Optional[float] = Field(
        default=None,
        description="""<!--zh: 元素宽度（可选）-->
Element width (optional)"""
    )

    height: Optional[float] = Field(
        default=None,
        description="""<!--zh: 元素高度（可选）-->
Element height (optional)"""
    )

    z_index: Optional[int] = Field(
        default=None,
        description="""<!--zh: 图层层级（可选），数值越大越靠上-->
Layer z-index (optional), higher value on top"""
    )

    visible: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否可见（可选）-->
Visible or not (optional)"""
    )

    locked: Optional[bool] = Field(
        default=None,
        description="""<!--zh: 是否锁定（可选）-->
Locked or not (optional)"""
    )

    opacity: Optional[float] = Field(
        default=None,
        description="""<!--zh: 透明度（可选），范围 0-1-->
Opacity (optional), range 0-1"""
    )

    properties: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""<!--zh: 元素类型特定的属性（JSON 对象，可选）。支持深度合并，嵌套对象递归合并保留未修改字段。

常用更新：
- 修改图片: {"src": "Demo/images/new.jpg"} (自动读取新尺寸，自动清除旧AI信息)
- 修改样式: {"fill": "#FF0000"} 或 {"defaultStyle": {"fontSize": 20}}
- 更新嵌套: {"visualUnderstanding": {"summary": "新描述"}} (保留其他字段如 analyzedAt)

图片 src 变更时自动处理：
- width/height 自动从新图片读取（如未提供）
- generateImageRequest 和 visualUnderstanding 自动清除

注：只提供要修改的属性，其他保持不变。图片 src 相对于工作区根目录。
-->
Element type-specific properties (JSON object, optional). Supports deep merge, nested objects recursively merged preserving unmodified fields.

Common updates:
- Change image: {"src": "Demo/images/new.jpg"} (auto-reads new size, auto-clears old AI info)
- Change style: {"fill": "#FF0000"} or {"defaultStyle": {"fontSize": 20}}
- Update nested: {"visualUnderstanding": {"summary": "New description"}} (preserves other fields like analyzedAt)

Auto-handling when image src changes:
- width/height auto-read from new image (if not provided)
- generateImageRequest and visualUnderstanding auto-cleared

Note: Only provide properties to modify, others remain unchanged. Image src relative to workspace root.
"""
    )

    @field_validator('opacity')
    @classmethod
    def validate_opacity(cls, v: Optional[float]) -> Optional[float]:
        """Validate opacity range"""
        if v is not None and not 0 <= v <= 1:
            raise ValueError(f"Opacity must be between 0 and 1, got {v}")
        return v

    @field_validator('width', 'height')
    @classmethod
    def validate_size(cls, v: Optional[float]) -> Optional[float]:
        """Validate width and height must be positive"""
        if v is not None and v <= 0:
            raise ValueError(f"Width and height must be positive, got {v}")
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
class UpdateCanvasElement(BaseDesignTool[UpdateCanvasElementParams]):
    """<!--zh
    更新画布元素工具

    此工具用于更新设计项目画布上已存在元素的属性。支持部分更新（只更新提供的属性）。

    可更新的通用属性：
    - 名称（name）
    - 位置（x、y）
    - 尺寸（width、height）
    - 图层层级（zIndex）
    - 可见性（visible）
    - 锁定状态（locked）
    - 透明度（opacity）

    可更新的特定属性（通过 properties 参数）：
    - 图片元素：src（图片路径）、visualUnderstanding（视觉理解）、generateImageRequest（AI 生成信息）
    - 文本元素：content（富文本内容）、defaultStyle（默认样式）
    - 形状元素：fill（填充色）、stroke（描边色）、strokeWidth（描边宽度）等

    特性：
    - 部分更新：只需提供要更改的属性，其他属性保持不变
    - 深度合并：嵌套对象（如 visualUnderstanding）会递归合并，保留未修改的字段
    - 灵活性：可以更新锁定的元素（锁定状态是给前端 UI 用的，不影响工具层操作）

    智能图片更新：
    - 自动尺寸读取：更换图片 src 时，自动从新图片文件读取 width/height（如果未提供）
    - 自动清理元数据：更换图片 src 时，自动清除旧的 generateImageRequest 和 visualUnderstanding
    - 保持一致性：确保图片元数据与实际图片文件匹配

    注意：
    - element_id 必须存在，否则返回错误
    - 如果不提供任何更新字段，操作仍然成功但不会有任何变化
    - 深度合并示例：更新 visualUnderstanding.summary 不会影响 visualUnderstanding.analyzedAt
    - 可以更新锁定的元素（锁定状态是给前端 UI 用的，不影响工具层操作）
    - 更换图片时建议只提供 src，让工具自动处理尺寸和元数据清理
    -->
    Update canvas element tool

    This tool updates properties of existing elements on the design project canvas. Supports partial updates (only updates provided properties).

    Updatable common properties:
    - Name (name)
    - Position (x, y)
    - Size (width, height)
    - Layer z-index (zIndex)
    - Visibility (visible)
    - Lock status (locked)
    - Opacity (opacity)

    Updatable specific properties (via properties parameter):
    - Image element: src (image path), visualUnderstanding (visual understanding), generateImageRequest (AI generation info)
    - Text element: content (rich text content), defaultStyle (default style)
    - Shape element: fill (fill color), stroke (stroke color), strokeWidth (stroke width), etc.

    Features:
    - Partial update: Only need to provide properties to change, others remain unchanged
    - Deep merge: Nested objects (e.g., visualUnderstanding) are recursively merged, preserving unmodified fields
    - Flexibility: Can update locked elements (lock status is for frontend UI, doesn't affect tool layer operations)

    Smart Image Update:
    - Auto-sizing: When changing image src, automatically reads width/height from new image file (if not provided)
    - Auto-cleanup: When changing image src, automatically clears old generateImageRequest and visualUnderstanding
    - Consistency: Ensures image metadata matches actual image file

    Note:
    - element_id must exist, otherwise returns error
    - If no update fields are provided, operation still succeeds but nothing changes
    - Deep merge example: updating visualUnderstanding.summary won't affect visualUnderstanding.analyzedAt
    - Can update locked elements (lock status is for frontend UI, doesn't affect tool layer operations)
    - When replacing image, recommend only providing src and let tool handle sizing and metadata cleanup
    """

    async def execute(self, tool_context: ToolContext, params: UpdateCanvasElementParams) -> ToolResult:
        """Execute canvas element update operation

        Args:
            tool_context: Tool context
            params: Parameter object containing update information

        Returns:
            ToolResult: Contains update result details
        """
        try:
            # Use base class method to ensure project is ready
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True
            )
            if error_result:
                return error_result

            # Initialize CanvasManager
            manager = CanvasManager(str(project_path))

            # Use canvas lock to protect the entire operation (prevent concurrent modifications)
            async with manager.with_lock():
                await manager.load()

                # Check if element exists
                element = await manager.get_element_by_id(params.element_id)
                if element is None:
                    return self._error_element_not_found(params.element_id)

                # Build updates dictionary (only include provided fields)
                updates = self._build_updates_dict(params)

                # Handle properties with deep merge
                if params.properties is not None:
                    # Get current properties as dict
                    current_properties = self._extract_element_properties(element)
                    # Deep merge
                    merged_properties = self._deep_merge_dict(current_properties, params.properties)

                    # 特殊处理：如果是图片元素且 src 发生变化
                    if element.type == 'image':
                        await self._handle_image_src_change(
                            tool_context=tool_context,
                            element=element,
                            params=params,
                            updates=updates,
                            merged_properties=merged_properties
                        )

                    # Add merged properties to updates
                    for key, value in merged_properties.items():
                        updates[key] = value

                # Check if there are any updates
                if not updates:
                    return ToolResult(
                        content=f"No changes provided for element '{params.element_id}'. Element remains unchanged."
                    )

                # Store original values for comparison
                original_values = {key: getattr(element, key, None) for key in updates.keys()}

                # Update element
                success = await manager.update_element(params.element_id, updates)

                if not success:
                    return self._error_element_not_found(params.element_id)

                # 获取配置文件路径
                config_file = self._get_magic_project_js_path(project_path)

                # 触发文件更新前事件（保存旧内容用于checkpoint回滚）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.BEFORE_FILE_UPDATED)

                # 安全地保存更改
                save_error = await self._safe_save_canvas(manager, "update element")
                if save_error:
                    return save_error

                # 触发文件更新后事件（通知其他系统）
                await self._dispatch_file_event(tool_context, str(config_file), EventType.FILE_UPDATED)

                # Reload to get updated element
                await manager.reload()
                updated_element = await manager.get_element_by_id(params.element_id)

            # Generate result content
            result_content = self._generate_result_content(
                params,
                element,
                updated_element,
                updates,
                original_values
            )

            # 构建完整的元素详情（用于前端展示）
            elements_detail = await self._build_elements_detail_from_ids(
                project_path,
                [params.element_id],
                manager
            )

            # 将元素信息放入 extra_info
            return ToolResult(
                content=result_content,
                extra_info={
                    "project_path": params.project_path,
                    "element_name": updated_element.name,
                    "element_id": params.element_id,
                    "elements": elements_detail
                }
            )

        except Exception as e:
            logger.exception(f"Failed to update canvas element: {e!s}")
            return ToolResult.error(
                f"Failed to update canvas element: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    # noinspection PyMethodMayBeStatic
    def _build_updates_dict(self, params: UpdateCanvasElementParams) -> Dict[str, Any]:
        """Build updates dictionary from provided parameters

        Args:
            params: Tool parameters

        Returns:
            Dictionary containing only non-None update fields
        """
        updates = {}

        # Common properties
        if params.name is not None:
            updates['name'] = params.name
        if params.x is not None:
            updates['x'] = params.x
        if params.y is not None:
            updates['y'] = params.y
        if params.width is not None:
            updates['width'] = params.width
        if params.height is not None:
            updates['height'] = params.height
        if params.z_index is not None:
            updates['zIndex'] = params.z_index
        if params.visible is not None:
            updates['visible'] = params.visible
        if params.locked is not None:
            updates['locked'] = params.locked
        if params.opacity is not None:
            updates['opacity'] = params.opacity

        # Note: properties are handled separately with deep merge
        return updates

    # noinspection PyMethodMayBeStatic
    def _extract_element_properties(self, element: Any) -> Dict[str, Any]:
        """Extract element-specific properties as dictionary

        Args:
            element: Element object

        Returns:
            Dictionary of element-specific properties
        """
        from dataclasses import asdict, is_dataclass

        # Get all attributes except common ones
        common_attrs = {
            'id', 'name', 'type', 'x', 'y', 'width', 'height',
            'zIndex', 'visible', 'locked', 'opacity',
            'draggable', 'listening', 'perfectDrawEnabled', 'interactionConfig'
        }

        properties = {}

        if is_dataclass(element):
            element_dict = asdict(element)
            for key, value in element_dict.items():
                if key not in common_attrs and value is not None:
                    properties[key] = value
        else:
            for key in dir(element):
                if not key.startswith('_') and key not in common_attrs:
                    value = getattr(element, key, None)
                    if value is not None and not callable(value):
                        properties[key] = value

        return properties

    # noinspection PyMethodMayBeStatic
    def _deep_merge_dict(self, base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively merge dictionaries, preserving unmentioned keys in base

        Args:
            base: Base dictionary
            updates: Updates to apply

        Returns:
            Merged dictionary
        """
        result = base.copy()

        for key, value in updates.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursive merge for nested dicts
                result[key] = self._deep_merge_dict(result[key], value)
            else:
                # Direct assignment for non-dict values or new keys
                result[key] = value

        return result

    async def _handle_image_src_change(
        self,
        tool_context: ToolContext,
        element: Any,
        params: UpdateCanvasElementParams,
        updates: Dict[str, Any],
        merged_properties: Dict[str, Any]
    ) -> None:
        """处理图片元素 src 变更时的特殊逻辑

        当图片 src 发生变化时：
        1. 自动读取新图片的尺寸（如果未提供 width/height）
        2. 清除旧的 generateImageRequest（因为换了新图片）
        3. 清除旧的 visualUnderstanding（因为换了新图片）

        Args:
            tool_context: 工具上下文
            element: 当前元素对象
            params: 更新参数
            updates: 更新字典（会被修改）
            merged_properties: 合并后的属性字典（会被修改）
        """
        # 检查是否更新了 src
        new_src = merged_properties.get('src')
        old_src = getattr(element, 'src', None)

        # 如果 src 没有变化，无需处理
        if new_src is None or new_src == old_src:
            return

        logger.info(f"检测到图片 src 变更: {old_src} -> {new_src}")

        # 1. 自动读取新图片尺寸（如果未在本次更新中提供），使用基类重试机制
        if params.width is None and params.height is None:
            width, height = await self._read_image_dimensions_with_retry(tool_context, new_src)

            if width is not None and height is not None:
                # 自动填充尺寸到 updates
                updates['width'] = width
                updates['height'] = height
                logger.info(f"自动读取新图片尺寸: {width}x{height}")
            else:
                # 读取失败，记录警告但不阻止更新
                logger.warning(f"无法从新图片文件读取尺寸 {new_src}")

        # 2. 清除 generateImageRequest（换了图片，旧的生成信息不再适用）
        if 'generateImageRequest' in merged_properties:
            merged_properties['generateImageRequest'] = None
            logger.info("已清除 generateImageRequest（因为图片 src 已变更）")

        # 3. 清除 visualUnderstanding（换了图片，旧的视觉理解不再适用）
        if 'visualUnderstanding' in merged_properties:
            merged_properties['visualUnderstanding'] = None
            logger.info("已清除 visualUnderstanding（因为图片 src 已变更）")

        # 4. 对新图片执行视觉理解
        # 创建一个临时的图片元素对象用于视觉理解
        from app.tools.design.utils.magic_project_design_parser import ImageElement
        temp_element = ImageElement(
            id="temp",
            name="temp",
            type="image",
            x=0,
            y=0,
            width=100,
            height=100,
            src=new_src
        )

        # 调用基类方法执行视觉理解
        await self._perform_visual_understanding(temp_element, Path(tool_context.base_dir))

        # 将视觉理解结果保存到 merged_properties
        if hasattr(temp_element, 'visualUnderstanding') and temp_element.visualUnderstanding:
            merged_properties['visualUnderstanding'] = temp_element.visualUnderstanding

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(
        self,
        params: UpdateCanvasElementParams,
        original_element: Any,
        updated_element: Any,
        updates: Dict[str, Any],
        original_values: Dict[str, Any]
    ) -> str:
        """Generate structured result content

        Args:
            params: Tool parameters
            original_element: Original element before update
            updated_element: Updated element
            updates: Applied updates
            original_values: Original values before update

        Returns:
            Formatted result content
        """
        result = f"""Element Details:
- ID: {params.element_id}
- Name: {updated_element.name}
- Type: {updated_element.type}"""

        # List updated fields
        updated_fields = []
        for key in updates.keys():
            old_val = original_values.get(key)
            new_val = getattr(updated_element, key, None)

            # Format values for display
            if isinstance(old_val, float):
                old_str = f"{old_val:.2f}"
            else:
                old_str = str(old_val)

            if isinstance(new_val, float):
                new_str = f"{new_val:.2f}"
            else:
                new_str = str(new_val)

            # Truncate long strings
            if len(old_str) > 50:
                old_str = old_str[:47] + "..."
            if len(new_str) > 50:
                new_str = new_str[:47] + "..."

            updated_fields.append(f"  • {key}: {old_str} → {new_str}")

        if updated_fields:
            result += f"\n\nUpdated Fields ({len(updated_fields)}):\n" + "\n".join(updated_fields)

        result += f"\n\nChanges saved to: {params.project_path}/magic.project.js"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not arguments or "element_id" not in arguments:
            return i18n.translate("update_canvas_element.exception", category="tool.messages")

        element_id = arguments["element_id"]

        # 优先使用元素名称，如果没有则使用元素ID
        element_display = element_id
        if result.extra_info and "element_name" in result.extra_info:
            element_name = result.extra_info["element_name"]
            if element_name and element_name.strip():
                element_display = element_name

        return i18n.translate("update_canvas_element.success", category="tool.messages", element_display=element_display)

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
        # 使用基类的通用错误处理方法
        return self._handle_design_tool_error(
            result,
            default_action_code="update_canvas_element",
            default_success_message_code="update_canvas_element.success"
        ) if not result.ok else {
            "action": i18n.translate("update_canvas_element", category="tool.actions"),
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
