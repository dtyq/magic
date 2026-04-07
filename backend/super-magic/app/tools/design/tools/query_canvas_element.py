"""查询画布元素详情工具

此工具用于查询设计项目画布上指定元素的详细信息。
"""

from app.i18n import i18n
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail, DisplayType, FileContent
from app.tools.core import BaseToolParams, tool
from app.tools.design.manager.canvas_manager import CanvasManager
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.utils.magic_project_design_parser import (
    ImageElement,
    VideoElement,
    TextElement,
    RectangleElement,
    EllipseElement,
    TriangleElement,
    StarElement,
    FrameElement,
    GroupElement,
    MagicProjectConfig,
    flatten_all_elements,
)

logger = get_logger(__name__)


class QueryCanvasElementParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹，即画布项目标识）-->
Relative path to the design project (folder containing magic.project.js, the canvas project identifier)"""
    )

    element_id: Optional[str] = Field(
        default=None,
        description="""<!--zh: 要查询的元素 ID（与 src 参数二选一，优先使用 element_id）-->
Element ID to query (choose one between element_id and src, element_id takes priority)"""
    )

    src: Optional[str] = Field(
        default=None,
        description="""<!--zh: 要查询的图片元素的 src 路径（与 element_id 参数二选一，element_id 优先）。用于通过图片路径查找对应的画布元素-->
Image element src path to query (choose one between element_id and src, element_id takes priority). Used to find canvas element by image path"""
    )

    include_surrounding: bool = Field(
        default=True,
        description="""<!--zh: 是否包含周围元素分析-->
Whether to include surrounding elements analysis"""
    )

    include_layer_context: bool = Field(
        default=True,
        description="""<!--zh: 是否包含图层关系分析-->
Whether to include layer context analysis"""
    )

    @model_validator(mode='after')
    def validate_query_params(self):
        """验证查询参数：element_id 和 src 至少要提供一个"""
        if not self.element_id and not self.src:
            raise ValueError("必须提供 element_id 或 src 参数中的至少一个")
        return self


@tool()
class QueryCanvasElement(BaseDesignTool[QueryCanvasElementParams]):
    """<!--zh
    查询画布元素详情工具

    此工具用于查询设计项目画布上指定元素的详细信息，返回完整的元素属性和上下文信息。

    查询方式（二选一）：
    - 通过 element_id 查询：适用于已知元素 ID 的情况
    - 通过 src 查询：适用于通过图片路径查找元素的情况（仅图片元素）

    返回信息根据元素类型不同而不同：

    通用信息（所有元素）：
    - 基本属性：ID、名称、类型、位置、尺寸、图层等
    - 状态信息：可见性、锁定状态、透明度等
    - 上下文信息：周围元素、图层关系

    图片元素特有信息：
    - 图片源路径
    - 文件信息（是否存在、大小、格式等）
    - AI 生成信息（如果是 AI 生成的图片）
    - 视觉理解缓存

    文本元素特有信息：
    - 富文本内容
    - 默认样式
    - 文本统计（字符数、段落数等）

    形状元素特有信息：
    - 填充颜色
    - 描边属性
    - 特殊属性（圆角、边数等）

    容器元素特有信息：
    - 子元素列表
    - 容器类型（frame/group）

    使用场景：
    - 查看元素的完整配置
    - 分析元素与其他元素的关系
    - 获取元素的上下文信息
    - 为编辑操作提供详细信息
    - 通过图片路径查找对应的画布元素

    注意：
    - element_id 和 src 至少要提供一个，element_id 优先
    - 使用 src 查询时只能查找图片类型的元素
    - 返回的信息根据元素类型自动调整
    - 周围元素分析可能需要一定的计算时间
    -->
    Query canvas element details tool

    This tool queries detailed information of a specified element on the design project canvas, returning complete element properties and context information.

    Query methods (choose one):
    - By element_id: Suitable when element ID is known
    - By src: Suitable for finding element by image path (image elements only)

    Returned information varies by element type:

    Common information (all elements):
    - Basic properties: ID, name, type, position, size, layer, etc.
    - Status information: visibility, lock status, opacity, etc.
    - Context information: surrounding elements, layer relationships

    Image element specific information:
    - Image source path
    - File information (existence, size, format, etc.)
    - AI generation info (if AI-generated)
    - Visual understanding cache

    Text element specific information:
    - Rich text content
    - Default style
    - Text statistics (character count, paragraph count, etc.)

    Shape element specific information:
    - Fill color
    - Stroke properties
    - Special properties (corner radius, sides count, etc.)

    Container element specific information:
    - Children elements list
    - Container type (frame/group)

    Use cases:
    - View complete element configuration
    - Analyze element relationships with others
    - Get element context information
    - Provide detailed info for editing operations
    - Find canvas element by image path

    Notes:
    - Must provide at least one of element_id or src, element_id takes priority
    - When querying by src, only image elements can be found
    - Returned information automatically adjusts based on element type
    - Surrounding elements analysis may require some computation time
    """

    async def execute(self, tool_context: ToolContext, params: QueryCanvasElementParams) -> ToolResult:
        """Execute canvas element query operation

        Args:
            tool_context: Tool context
            params: Parameter object containing query information

        Returns:
            ToolResult: Contains element detail data
        """
        try:
            # 验证参数
            if not params.element_id and not params.src:
                return ToolResult.error(
                    "必须提供 element_id 或 src 参数中的至少一个",
                    extra_info={"error_type": "design.error_invalid_property"}
                )

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
            current_config = await manager.read_current_canvas()

            # Get element by ID or src
            element = None
            query_info = ""

            if params.element_id:
                # 优先使用 element_id 查询
                element = await manager.get_element_by_id(params.element_id, config=current_config)
                query_info = f"element_id: {params.element_id}"
                if element is None:
                    return self._error_element_not_found(params.element_id)
            elif params.src:
                # 使用 src 查询
                element = await self._find_element_by_src(current_config, params.src)
                query_info = f"src: {params.src}"
                if element is None:
                    return ToolResult.error(
                        f"未找到 src 为 '{params.src}' 的图片元素",
                        extra_info={"error_type": "design.error_element_not_found"}
                    )

            logger.info(f"查询元素: {query_info}, 找到: {element.name} (id: {element.id})")

            # Build element detail data (可能会执行视觉理解)
            element_data = await self._build_element_detail(element, project_path, manager)

            # 如果执行了视觉理解，需要保存更改
            # 检查元素是否为图片类型且有新的视觉理解信息
            if isinstance(element, ImageElement) and hasattr(element, 'visualUnderstanding') and element.visualUnderstanding:
                # 检查是否是新生成的（通过 analyzedAt 判断）
                vu = element.visualUnderstanding
                if (isinstance(vu, dict) and vu.get('analyzedAt')) or (hasattr(vu, 'analyzedAt') and vu.analyzedAt):
                    target_element_id = element.id
                    logger.info(f"保存新生成的视觉理解信息到元素 {target_element_id}")
                    updates = {'visualUnderstanding': element.visualUnderstanding}
                    # 获取配置文件路径
                    config_file = self._get_magic_project_js_path(project_path)

                    try:
                        await manager.run_write_transaction(
                            lambda config: manager.update_element(
                                target_element_id,
                                updates,
                                config=config,
                            ),
                            verify_content=lambda verified_config, _: any(
                                candidate.id == target_element_id
                                and getattr(candidate, "visualUnderstanding", None)
                                for candidate in flatten_all_elements(verified_config)
                            ),
                            before_write=lambda: self._dispatch_file_event(
                                tool_context,
                                str(config_file),
                                EventType.BEFORE_FILE_UPDATED,
                            ),
                            after_write=lambda _: self._dispatch_file_event(
                                tool_context,
                                str(config_file),
                                EventType.FILE_UPDATED,
                            ),
                        )
                    except Exception as save_error:  # noqa: BLE001
                        # 视觉理解保存失败不影响查询结果，仅记录警告
                        logger.warning(f"保存视觉理解结果失败: {save_error}")

            # Add surrounding elements analysis if requested
            if params.include_surrounding:
                surrounding = await self._analyze_surrounding_elements(element, current_config)
                element_data["surrounding_elements"] = surrounding

            # Add layer context if requested
            if params.include_layer_context:
                layer_context = await self._analyze_layer_context(element, current_config)
                element_data["layer_context"] = layer_context

            # Generate result content
            result_content = self._generate_result_content(element_data, params)

            return ToolResult(
                content=result_content,
                data=element_data,
                extra_info={
                    "element_name": element.name,
                    "element_id": element.id
                }
            )

        except Exception as e:
            logger.exception(f"Failed to query canvas element: {e!s}")
            return ToolResult.error(
                f"Failed to query canvas element: {e!s}",
                extra_info={"error_type": "design.error_unexpected"}
            )

    async def _find_element_by_src(self, config: MagicProjectConfig, src: str) -> Optional[Any]:
        """通过 src 查找图片元素

        Args:
            config: 当前画布配置
            src: 图片的 src 路径（可能带或不带开头的 /）

        Returns:
            找到的元素对象，如果没找到返回 None
        """
        if not config.canvas or not config.canvas.elements:
            return None

        # 标准化查询路径：去除开头的 /
        normalized_src = src.lstrip('/')

        # 遍历所有元素，查找匹配的媒体元素。
        # 设计生视频会把 src 写到 video 元素里，因此这里同时支持 image/video。
        for element in config.canvas.elements:
            if isinstance(element, (ImageElement, VideoElement)):
                if hasattr(element, 'src') and element.src:
                    # 标准化元素的 src：去除开头的 /
                    element_src_normalized = element.src.lstrip('/')

                    # 比较标准化后的路径
                    if element_src_normalized == normalized_src:
                        logger.info(f"通过 src 找到元素: {element.name} (id: {element.id}), src: {element.src}")
                        return element

        logger.warning(f"未找到 src 为 '{src}' 的媒体元素")
        return None

    async def _build_element_detail(
        self,
        element: Any,
        project_path: Path,
        manager: CanvasManager
    ) -> Dict[str, Any]:
        """Build detailed element data

        Args:
            element: Element object
            project_path: Project path
            manager: Canvas manager

        Returns:
            Element detail data dictionary
        """
        # Common properties
        detail = {
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

        # Add type-specific properties
        if isinstance(element, ImageElement):
            detail["image_properties"] = await self._get_image_properties(element, project_path)
        elif isinstance(element, VideoElement):
            detail["video_properties"] = await self._get_video_properties(element)
        elif isinstance(element, TextElement):
            detail["text_properties"] = self._get_text_properties(element)
        elif isinstance(element, (RectangleElement, EllipseElement, TriangleElement, StarElement)):
            detail["shape_properties"] = self._get_shape_properties(element)
        elif isinstance(element, (FrameElement, GroupElement)):
            detail["container_properties"] = self._get_container_properties(element)

        return detail

    async def _get_image_properties(self, element: ImageElement, project_path: Path) -> Dict[str, Any]:
        """Get image element specific properties

        Args:
            element: Image element
            project_path: Project path

        Returns:
            Image properties dictionary
        """
        # 去掉 src 开头的 / 前缀，图像生成服务返回的 file_dir 带 /，
        # 前端拼接后写入 magic.project.js，这里统一规范化为相对路径供模型使用
        src = element.src.lstrip("/") if element.src else element.src
        properties: Dict[str, Any] = {
            "src": src
        }

        # Check file existence and get file info
        if element.src:
            # element.src 是相对于工作区根目录的路径，需要使用 workspace_dir
            import asyncio
            from agentlang.path_manager import PathManager
            workspace_dir = PathManager.get_workspace_dir()

            # 标准化路径：去除开头的 /，兼容两种格式（/path 和 path）
            normalized_src = element.src.lstrip('/')
            file_path = workspace_dir / normalized_src

            if await asyncio.to_thread(file_path.exists):
                file_size = await asyncio.to_thread(lambda: file_path.stat().st_size)
                properties["file_info"] = {
                    "exists": True,
                    "size": self._format_file_size(file_size),
                    "absolute_path": str(file_path)
                }
            else:
                properties["file_info"] = {
                    "exists": False,
                    "expected_path": str(file_path)
                }

        # Add generation info if available
        if hasattr(element, 'generateImageRequest') and element.generateImageRequest:
            gen_req = element.generateImageRequest
            if isinstance(gen_req, dict):
                properties["generation_info"] = {
                    "is_generated": True,
                    "model": gen_req.get('model_id'),
                    "prompt": gen_req.get('prompt'),
                }
            else:
                properties["generation_info"] = {
                    "is_generated": True,
                    "model": getattr(gen_req, 'model_id', None),
                    "prompt": getattr(gen_req, 'prompt', None),
                }

        # 如果没有视觉理解信息，自动执行视觉理解
        if not (hasattr(element, 'visualUnderstanding') and element.visualUnderstanding):
            logger.info(f"图片元素 {element.id} 没有视觉理解缓存，开始执行视觉理解")
            await self._perform_visual_understanding(element, project_path)

        # Add visual understanding if available
        if hasattr(element, 'visualUnderstanding') and element.visualUnderstanding:
            vu = element.visualUnderstanding
            if isinstance(vu, dict):
                properties["visual_understanding"] = {
                    "has_cache": True,
                    "summary": vu.get('summary'),
                    "detailed": vu.get('detailed')
                }
            else:
                properties["visual_understanding"] = {
                    "has_cache": True,
                    "summary": getattr(vu, 'summary', None),
                    "detailed": getattr(vu, 'detailed', None)
                }

        return properties

    async def _get_video_properties(self, element: VideoElement) -> Dict[str, Any]:
        """Get video element specific properties."""
        # 图像生成服务返回的 file_dir 带 / 前缀，前端拼接写入 magic.project.js，
        # 这里统一规范化为相对路径，确保模型看到的路径格式一致
        properties: Dict[str, Any] = {
            "src": element.src.lstrip("/") if element.src else element.src,
            "poster": element.poster.lstrip("/") if element.poster else element.poster,
            "status": element.status,
            "error_message": element.errorMessage,
        }

        if hasattr(element, 'generateVideoRequest') and element.generateVideoRequest:
            gen_req = element.generateVideoRequest
            if isinstance(gen_req, dict):
                properties["generation_info"] = {
                    "is_generated": True,
                    "model": gen_req.get('model_id'),
                    "prompt": gen_req.get('prompt'),
                    "operation_id": gen_req.get('operation_id'),
                }
            else:
                properties["generation_info"] = {
                    "is_generated": True,
                    "model": getattr(gen_req, 'model_id', None),
                    "prompt": getattr(gen_req, 'prompt', None),
                    "operation_id": getattr(gen_req, 'operation_id', None),
                }

        return properties

    # noinspection PyMethodMayBeStatic
    def _get_text_properties(self, element: TextElement) -> Dict[str, Any]:
        """Get text element specific properties

        Args:
            element: Text element

        Returns:
            Text properties dictionary
        """
        properties = {}

        # Extract text content
        if hasattr(element, 'content') and element.content:
            # Calculate text statistics
            text_parts = []
            for paragraph in element.content:
                # Handle both dict and object formats
                if isinstance(paragraph, dict):
                    children = paragraph.get('children', [])
                    for child in children:
                        if isinstance(child, dict):
                            text = child.get('text', '')
                            if text:
                                text_parts.append(text)
                        elif hasattr(child, 'text'):
                            text_parts.append(child.text)
                elif hasattr(paragraph, 'children'):
                    for child in paragraph.children:
                        if isinstance(child, dict):
                            text = child.get('text', '')
                            if text:
                                text_parts.append(text)
                        elif hasattr(child, 'text'):
                            text_parts.append(child.text)

            full_text = ''.join(text_parts)
            properties["text_content"] = {
                "full_text": full_text[:200] + "..." if len(full_text) > 200 else full_text,
                "character_count": len(full_text),
                "paragraph_count": len(element.content)
            }

        # Add default style
        if hasattr(element, 'defaultStyle') and element.defaultStyle:
            style = element.defaultStyle
            # Handle both dict and object formats
            if isinstance(style, dict):
                properties["default_style"] = {
                    "font_size": style.get('fontSize'),
                    "font_family": style.get('fontFamily'),
                    "color": style.get('color'),
                    "bold": style.get('bold', False),
                    "italic": style.get('italic', False),
                }
            else:
                properties["default_style"] = {
                    "font_size": getattr(style, 'fontSize', None),
                    "font_family": getattr(style, 'fontFamily', None),
                    "color": getattr(style, 'color', None),
                    "bold": getattr(style, 'bold', False),
                    "italic": getattr(style, 'italic', False),
                }

        return properties

    # noinspection PyMethodMayBeStatic
    def _get_shape_properties(
        self,
        element: Any
    ) -> Dict[str, Any]:
        """Get shape element specific properties

        Args:
            element: Shape element

        Returns:
            Shape properties dictionary
        """
        properties = {}

        # Common shape properties
        if hasattr(element, 'fill') and element.fill:
            properties["fill"] = element.fill
        if hasattr(element, 'stroke') and element.stroke:
            properties["stroke"] = element.stroke
        if hasattr(element, 'strokeWidth') and element.strokeWidth:
            properties["stroke_width"] = element.strokeWidth

        # Rectangle specific
        if isinstance(element, RectangleElement):
            if hasattr(element, 'cornerRadius') and element.cornerRadius:
                properties["corner_radius"] = element.cornerRadius

        # Star specific
        if isinstance(element, StarElement):
            if hasattr(element, 'sides') and element.sides:
                properties["sides"] = element.sides
            if hasattr(element, 'innerRadiusRatio') and element.innerRadiusRatio:
                properties["inner_radius_ratio"] = element.innerRadiusRatio

        return properties

    # noinspection PyMethodMayBeStatic
    def _get_container_properties(
        self,
        element: Any
    ) -> Dict[str, Any]:
        """Get container element specific properties

        Args:
            element: Container element (frame/group)

        Returns:
            Container properties dictionary
        """
        properties = {
            "container_type": element.type
        }

        # Get children info
        if hasattr(element, 'children') and element.children:
            properties["children_count"] = len(element.children)
            # Handle both dict and object formats
            children_ids = []
            for child in element.children:
                if isinstance(child, dict):
                    children_ids.append(child.get('id', 'unknown'))
                else:
                    children_ids.append(child.id)
            properties["children_ids"] = children_ids
        else:
            properties["children_count"] = 0
            properties["children_ids"] = []

        return properties

    async def _analyze_surrounding_elements(
        self,
        element: Any,
        config: MagicProjectConfig
    ) -> List[Dict[str, Any]]:
        """Analyze surrounding elements

        Args:
            element: Target element
            config: 当前画布配置

        Returns:
            List of surrounding elements with distance info
        """
        if not config.canvas or not config.canvas.elements:
            return []

        surrounding = []
        element_center_x = element.x + (element.width or 0) / 2
        element_center_y = element.y + (element.height or 0) / 2

        for other in config.canvas.elements:
            if other.id == element.id:
                continue

            # Calculate distance
            other_center_x = other.x + (other.width or 0) / 2
            other_center_y = other.y + (other.height or 0) / 2
            distance = ((element_center_x - other_center_x) ** 2 + (element_center_y - other_center_y) ** 2) ** 0.5

            # Determine relative position
            dx = other_center_x - element_center_x
            dy = other_center_y - element_center_y

            if abs(dx) > abs(dy):
                direction = "right" if dx > 0 else "left"
            else:
                direction = "below" if dy > 0 else "above"

            surrounding.append({
                "id": other.id,
                "name": other.name,
                "type": other.type,
                "distance": round(distance, 2),
                "direction": direction
            })

        # Sort by distance and return top 5
        surrounding.sort(key=lambda x: x["distance"])
        return surrounding[:5]

    async def _analyze_layer_context(
        self,
        element: Any,
        config: MagicProjectConfig
    ) -> Dict[str, Any]:
        """Analyze layer context

        Args:
            element: Target element
            config: 当前画布配置

        Returns:
            Layer context information
        """
        if not config.canvas or not config.canvas.elements:
            return {"below": [], "above": []}

        element_z_index = element.zIndex or 0
        below = []
        above = []

        for other in config.canvas.elements:
            if other.id == element.id:
                continue

            other_z_index = other.zIndex or 0

            if other_z_index < element_z_index:
                below.append({
                    "id": other.id,
                    "name": other.name,
                    "type": other.type,
                    "z_index": other_z_index
                })
            elif other_z_index > element_z_index:
                above.append({
                    "id": other.id,
                    "name": other.name,
                    "type": other.type,
                    "z_index": other_z_index
                })

        # Sort by z-index
        below.sort(key=lambda x: x["z_index"], reverse=True)
        above.sort(key=lambda x: x["z_index"])

        return {
            "below": below[:3],  # Top 3 layers below
            "above": above[:3]   # Top 3 layers above
        }

    # noinspection PyMethodMayBeStatic
    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format

        Args:
            size_bytes: File size in bytes

        Returns:
            Formatted file size string
        """
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"

    # noinspection PyMethodMayBeStatic
    def _generate_result_content(self, element_data: Dict[str, Any], params: QueryCanvasElementParams) -> str:
        """Generate structured result content

        Args:
            element_data: Element data dictionary
            params: Tool parameters

        Returns:
            Formatted result content
        """
        result = f"""Element Information:
- ID: {element_data['id']}
- Name: {element_data['name']}
- Type: {element_data['type']}
- Position: ({element_data['position']['x']}, {element_data['position']['y']})
- Size: {element_data['size']['width']} × {element_data['size']['height']}
- Layer (z-index): {element_data['layer']}"""

        # Status
        status = element_data['status']
        status_flags = []
        if not status['visible']:
            status_flags.append("Hidden")
        if status['locked']:
            status_flags.append("Locked")
        if status['opacity'] < 1.0:
            status_flags.append(f"Opacity: {status['opacity']:.2f}")

        if status_flags:
            result += f"\n- Status: {', '.join(status_flags)}"
        else:
            result += "\n- Status: Normal"

        # Type-specific properties
        if 'image_properties' in element_data:
            result += self._format_image_properties(element_data['image_properties'])
        elif 'text_properties' in element_data:
            result += self._format_text_properties(element_data['text_properties'])
        elif 'shape_properties' in element_data:
            result += self._format_shape_properties(element_data['shape_properties'])
        elif 'container_properties' in element_data:
            result += self._format_container_properties(element_data['container_properties'])

        # Surrounding elements
        if 'surrounding_elements' in element_data and element_data['surrounding_elements']:
            result += "\n\nSurrounding Elements (Top 5 by distance):"
            for i, elem in enumerate(element_data['surrounding_elements'], 1):
                result += f"\n  {i}. [{elem['type']}] {elem['name']}"
                result += f" - {elem['distance']:.1f}px {elem['direction']}"

        # Layer context
        if 'layer_context' in element_data:
            layer_ctx = element_data['layer_context']
            if layer_ctx['below']:
                result += "\n\nLayers Below (closest 3):"
                for elem in layer_ctx['below']:
                    result += f"\n  • [{elem['type']}] {elem['name']} (z-index: {elem['z_index']})"

            if layer_ctx['above']:
                result += "\n\nLayers Above (closest 3):"
                for elem in layer_ctx['above']:
                    result += f"\n  • [{elem['type']}] {elem['name']} (z-index: {elem['z_index']})"

        return result

    # noinspection PyMethodMayBeStatic
    def _format_image_properties(self, props: Dict[str, Any]) -> str:
        """Format image properties for display"""
        result = "\n\nImage Properties:"
        result += f"\n  • Source: {props.get('src', 'N/A')}"

        if 'file_info' in props:
            file_info = props['file_info']
            if file_info['exists']:
                result += f"\n  • File Size: {file_info['size']}"
            else:
                result += "\n  • File Status: Not found"

        if 'generation_info' in props and props['generation_info']['is_generated']:
            gen_info = props['generation_info']
            result += "\n  • AI Generated: Yes"
            if gen_info.get('model'):
                result += f"\n    - Model: {gen_info['model']}"
            if gen_info.get('prompt'):
                prompt = gen_info['prompt']
                result += f"\n    - Prompt: {prompt[:50]}..." if len(prompt) > 50 else f"\n    - Prompt: {prompt}"

        if 'visual_understanding' in props and props['visual_understanding']['has_cache']:
            vu = props['visual_understanding']
            result += "\n  • Visual Understanding: Cached"
            if vu.get('summary'):
                summary = vu['summary']
                result += f"\n    - Summary: {summary[:100]}..." if len(summary) > 100 else f"\n    - Summary: {summary}"
            if vu.get('detailed'):
                detailed = vu['detailed']
                # detailed 是一个字典，包含结构化信息
                if isinstance(detailed, dict):
                    if detailed.get('theme'):
                        result += f"\n    - Theme: {detailed['theme']}"
                    if detailed.get('visual_elements'):
                        result += f"\n    - Visual Elements: {detailed['visual_elements']}"
                    if detailed.get('style'):
                        result += f"\n    - Style: {detailed['style']}"
                    if detailed.get('mood'):
                        result += f"\n    - Mood: {detailed['mood']}"
                    if detailed.get('use_cases'):
                        result += f"\n    - Use Cases: {detailed['use_cases']}"
                else:
                    # 兼容旧格式（如果 detailed 是字符串）
                    result += f"\n    - Detailed: {detailed[:200]}..." if len(str(detailed)) > 200 else f"\n    - Detailed: {detailed}"

        return result

    # noinspection PyMethodMayBeStatic
    def _format_text_properties(self, props: Dict[str, Any]) -> str:
        """Format text properties for display"""
        result = "\n\nText Properties:"

        if 'text_content' in props:
            content = props['text_content']
            result += f"\n  • Text Content: {content['full_text']}"
            result += f"\n  • Characters: {content['character_count']}"
            result += f"\n  • Paragraphs: {content['paragraph_count']}"

        if 'default_style' in props:
            style = props['default_style']
            style_parts = []
            if style.get('font_size'):
                style_parts.append(f"{style['font_size']}px")
            if style.get('font_family'):
                style_parts.append(style['font_family'])
            if style.get('bold'):
                style_parts.append("Bold")
            if style.get('italic'):
                style_parts.append("Italic")
            if style.get('color'):
                style_parts.append(style['color'])

            if style_parts:
                result += f"\n  • Style: {', '.join(style_parts)}"

        return result

    # noinspection PyMethodMayBeStatic
    def _format_shape_properties(self, props: Dict[str, Any]) -> str:
        """Format shape properties for display"""
        result = "\n\nShape Properties:"

        if 'fill' in props:
            result += f"\n  • Fill: {props['fill']}"
        if 'stroke' in props:
            result += f"\n  • Stroke: {props['stroke']}"
        if 'stroke_width' in props:
            result += f"\n  • Stroke Width: {props['stroke_width']}px"
        if 'corner_radius' in props:
            result += f"\n  • Corner Radius: {props['corner_radius']}px"
        if 'sides' in props:
            result += f"\n  • Sides: {props['sides']}"
        if 'inner_radius_ratio' in props:
            result += f"\n  • Inner Radius Ratio: {props['inner_radius_ratio']}"

        return result

    # noinspection PyMethodMayBeStatic
    def _format_container_properties(self, props: Dict[str, Any]) -> str:
        """Format container properties for display"""
        result = f"\n\nContainer Properties:"
        result += f"\n  • Type: {props['container_type'].capitalize()}"
        result += f"\n  • Children Count: {props['children_count']}"

        if props['children_ids']:
            result += f"\n  • Children IDs: {', '.join(props['children_ids'][:5])}"
            if len(props['children_ids']) > 5:
                result += f" ... and {len(props['children_ids']) - 5} more"

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not result.ok:
            return i18n.translate("query_canvas_element.exception", category="tool.messages")

        # 优先从 extra_info 中获取元素名称
        if result.extra_info and "element_name" in result.extra_info:
            element_name = result.extra_info["element_name"]
            # 使用元素名称作为显示值
            return i18n.translate("query_canvas_element.success", category="tool.messages", element_id=element_name)

        # 兜底：如果没有 extra_info，从 arguments 中获取
        if not arguments:
            return i18n.translate("query_canvas_element.success", category="tool.messages")

        # 优先使用 element_id
        if "element_id" in arguments and arguments["element_id"]:
            element_id = arguments["element_id"]
            return i18n.translate("query_canvas_element.success", category="tool.messages", element_id=element_id)

        # 如果是通过 src 查询，使用 src 作为标识
        if "src" in arguments and arguments["src"]:
            src = arguments["src"]
            # 使用 src 作为 element_id 占位符的值
            return i18n.translate("query_canvas_element.success", category="tool.messages", element_id=src)

        # 兜底：返回通用成功消息
        return i18n.translate("query_canvas_element.success", category="tool.messages")

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
            default_action_code="query_canvas_element",
            default_success_message_code="query_canvas_element.success"
        ) if not result.ok else {
            "action": i18n.translate("query_canvas_element", category="tool.actions"),
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
            element_id = arguments.get("element_id", "")
            src = arguments.get("src", "")
            include_surrounding = arguments.get("include_surrounding", True)
            include_layer_context = arguments.get("include_layer_context", True)

            # 生成 Markdown 内容
            content = f"""## 🔍 画布元素详情查询完成

### 查询配置
"""
            if element_id:
                content += f"- **查询方式**: 通过元素 ID\n"
                content += f"- **元素 ID**: `{element_id}`\n"
            elif src:
                content += f"- **查询方式**: 通过图片路径\n"
                content += f"- **图片路径**: `{src}`\n"

            content += f"""- **包含周围元素**: {'是' if include_surrounding else '否'}
- **包含图层关系**: {'是' if include_layer_context else '否'}

---

"""
            # 添加原始结果内容（已经是格式化的）
            if result.content:
                content += result.content

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name="canvas_element_details.md",
                    content=content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情失败: {e!s}")
            return None
