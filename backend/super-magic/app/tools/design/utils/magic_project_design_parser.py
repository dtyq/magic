"""
Magic Project 设计模式解析器

解析和操作设计模式的 magic.project.js 文件。
处理 JSONP 格式的读取、写入和验证。
"""

import asyncio
import fcntl
import json
import os
import re
from dataclasses import dataclass, field, asdict, fields
from pathlib import Path
from typing import List, Optional, Union, Literal, Dict, Any

import aiofiles
import aiofiles.os

from agentlang.path_manager import PathManager
from agentlang.logger import get_logger
from app.tools.design.constants import DEFAULT_ELEMENT_WIDTH, DEFAULT_ELEMENT_HEIGHT
from app.utils.async_file_utils import async_exists, async_mkdir

logger = get_logger(__name__)


# 元素类型定义
ElementType = Literal["image", "text", "rectangle", "ellipse", "triangle", "star", "frame", "group"]

# 允许的元素类型
ALLOWED_ELEMENT_TYPES = {
    "image", "text", "rectangle", "ellipse", "triangle", "star", "frame", "group"
}

# 项目配置必需字段
REQUIRED_PROJECT_FIELDS = {"version", "type", "name"}

# 画布元素必需字段
# 注意：name 字段是可选的，如果缺失会在解析时自动生成默认名称
REQUIRED_ELEMENT_FIELDS = {"id", "type"}


@dataclass
class InteractionConfig:
    """元素交互配置"""
    fillTransparent: Optional[bool] = None
    fillColorMode: Optional[str] = None
    strokeTransparent: Optional[bool] = None
    strokeColorMode: Optional[str] = None
    strokePosition: Optional[str] = None
    aspectRatioLocked: Optional[bool] = None


@dataclass
class TextStyle:
    """富文本样式配置"""
    fontSize: Optional[int] = None
    fontWeight: Optional[Union[int, str]] = None
    color: Optional[str] = None
    fontFamily: Optional[str] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    strikethrough: Optional[bool] = None
    backgroundColor: Optional[str] = None
    letterSpacing: Optional[float] = None


@dataclass
class RichTextNode:
    """富文本内容节点"""
    type: str  # "text"
    text: str
    style: Optional[TextStyle] = None


@dataclass
class ParagraphStyle:
    """段落样式配置"""
    textAlign: Optional[str] = None
    lineHeight: Optional[float] = None
    paragraphSpacing: Optional[float] = None


@dataclass
class RichTextParagraph:
    """富文本段落"""
    children: List[RichTextNode] = field(default_factory=list)
    style: Optional[ParagraphStyle] = None


@dataclass
class VisualUnderstanding:
    """
    图片元素的视觉理解信息。

    属性：
        summary: 简洁描述（1句话，最多80字符），概括图片内容
        detailed: 详细分析字典，结构如下：
            {
                "theme": str,              # 图片的主题和主体内容
                "visual_elements": str,    # 视觉特征：颜色、构图、光线、纹理
                "style": str,              # 艺术风格或设计风格
                "mood": str,               # 传达的情感和氛围
                "use_cases": str,          # 适合使用的场景
                "image_source": str,       # 图片文件路径（自动添加）
                "full_analysis": str       # 完整分析文本（可选，使用 markdown 解析时）
            }
        analyzedAt: 执行分析的时间戳（ISO 格式）
    """
    summary: str                         # 简短描述（1句话，最多80字符）
    detailed: Optional[dict] = None      # 详细分析字典（见上方结构说明）
    analyzedAt: Optional[str] = None     # 分析时间戳（ISO格式）


@dataclass
class GenerateImageRequest:
    """图片生成请求信息"""
    model_id: str
    prompt: str
    size: str
    resolution: str
    image_id: str


@dataclass
class BaseElement:
    """画布元素基类，包含通用属性"""
    # 必需字段
    id: str                                             # 元素唯一标识符
    type: ElementType                                   # 元素类型
    name: Optional[str] = None                          # 元素名称（可选，缺失时自动生成）

    # 位置和尺寸
    # 注意：对于容器（frame/group）内的子元素，x/y 是相对于父容器的坐标
    # 对于顶层元素，x/y 是相对于画布的绝对坐标
    x: Optional[float] = None                          # X 坐标位置（相对于父容器或画布）
    y: Optional[float] = None                          # Y 坐标位置（相对于父容器或画布）
    width: Optional[float] = None                      # 元素宽度
    height: Optional[float] = None                     # 元素高度

    # 图层和显示
    zIndex: Optional[int] = None                       # 图层层级，数值越大越靠上
    visible: Optional[bool] = None                     # 是否可见
    opacity: Optional[float] = None                    # 透明度 (0-1)
    rotation: Optional[float] = None                   # 旋转角度（度数）
    scaleX: Optional[float] = None                     # X 轴缩放比例
    scaleY: Optional[float] = None                     # Y 轴缩放比例

    # 交互控制
    locked: Optional[bool] = None                      # 是否锁定（锁定后不可编辑）
    draggable: Optional[bool] = None                   # 是否可拖拽
    listening: Optional[bool] = None                   # 是否监听事件

    # 渲染优化
    perfectDrawEnabled: Optional[bool] = None          # 是否启用完美绘制

    # 交互配置
    interactionConfig: Optional[InteractionConfig] = None  # 交互配置信息

    # 层级关系（运行时字段，不序列化到 JSON）
    # 这些字段在解析配置时动态计算，用于坐标转换和元素查询
    _parent_id: Optional[str] = field(default=None, repr=False, compare=False)  # 父元素 ID（运行时）
    _absolute_x: Optional[float] = field(default=None, repr=False, compare=False)  # 绝对 X 坐标（运行时缓存）
    _absolute_y: Optional[float] = field(default=None, repr=False, compare=False)  # 绝对 Y 坐标（运行时缓存）

    @property
    def absolute_x(self) -> Optional[float]:
        """获取元素的绝对 X 坐标（公共访问接口）"""
        return self._absolute_x

    @property
    def absolute_y(self) -> Optional[float]:
        """获取元素的绝对 Y 坐标（公共访问接口）"""
        return self._absolute_y

    @property
    def parent_id(self) -> Optional[str]:
        """获取父元素 ID（公共访问接口）"""
        return self._parent_id


@dataclass
class ImageElement(BaseElement):
    """图片元素"""
    src: Optional[str] = None
    loading: Optional[bool] = None
    status: Optional[Literal["pending", "processing", "completed", "failed"]] = None  # 图片生成状态
    generateImageRequest: Optional[GenerateImageRequest] = None
    visualUnderstanding: Optional[VisualUnderstanding] = None


@dataclass
class TextElement(BaseElement):
    """文本元素，支持富文本"""
    content: List[RichTextParagraph] = field(default_factory=list)
    defaultStyle: Optional[TextStyle] = None


@dataclass
class ShapeElement(BaseElement):
    """形状元素基类（矩形、椭圆、三角形）"""
    fill: Optional[str] = None
    stroke: Optional[str] = None
    strokeWidth: Optional[float] = None


@dataclass
class RectangleElement(ShapeElement):
    """矩形元素"""
    cornerRadius: Optional[float] = None


@dataclass
class EllipseElement(ShapeElement):
    """椭圆元素"""
    pass


@dataclass
class TriangleElement(ShapeElement):
    """三角形元素"""
    pass


@dataclass
class StarElement(ShapeElement):
    """星形元素"""
    cornerRadius: Optional[float] = None
    sides: Optional[int] = None
    innerRadiusRatio: Optional[float] = None


@dataclass
class GroupElement(BaseElement):
    """组元素（容器）"""
    children: List['CanvasElement'] = field(default_factory=list)


@dataclass
class FrameElement(BaseElement):
    """画框元素（容器，类似 Figma 的 Frame）"""
    type: Literal["frame"] = "frame"
    children: List['CanvasElement'] = field(default_factory=list)


# 所有画布元素的联合类型
CanvasElement = Union[
    ImageElement,
    TextElement,
    RectangleElement,
    EllipseElement,
    TriangleElement,
    StarElement,
    GroupElement,
    FrameElement,
]


@dataclass
class ViewportState:
    """画布视口状态"""
    scale: float = 1.0
    x: float = 0.0
    y: float = 0.0


@dataclass
class CanvasConfig:
    """画布配置"""
    elements: List[CanvasElement] = field(default_factory=list)
    viewport: Optional[ViewportState] = None


@dataclass
class MagicProjectConfig:
    """顶层 magic project 配置"""
    version: str
    type: str  # "design"
    name: str
    canvas: Optional[CanvasConfig] = None


@dataclass
class ValidationResult:
    """配置验证结果"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)


def flatten_all_elements(config: MagicProjectConfig) -> List[CanvasElement]:
    """
    展平配置中的所有元素（包括容器内的子元素）

    返回一个包含所有元素的扁平列表，元素的 _absolute_x 和 _absolute_y
    字段已经被计算并缓存。

    Args:
        config: 项目配置对象

    Returns:
        所有元素的扁平列表（包括嵌套在容器内的子元素）

    """
    if config.canvas is None or not config.canvas.elements:
        return []

    result: List[CanvasElement] = []

    def _collect_element(element: CanvasElement) -> None:
        """递归收集元素"""
        result.append(element)

        # 如果是容器，递归收集子元素
        if isinstance(element, (FrameElement, GroupElement)):
            if hasattr(element, 'children') and element.children:
                for child in element.children:
                    _collect_element(child)

    # 收集所有顶层元素及其子元素
    for element in config.canvas.elements:
        _collect_element(element)

    return result


def get_project_file_path(project_path: str) -> str:
    """
    获取 magic.project.js 文件的绝对路径

    Args:
        project_path: 相对于工作区的项目目录路径

    Returns:
        magic.project.js 的绝对路径
    """
    workspace_dir = PathManager.get_workspace_dir()
    base_path = workspace_dir / project_path
    return str(base_path / "magic.project.js")


def _generate_default_element_name(element_type: str, element_id: str) -> str:
    """
    为缺少名称的元素生成默认名称

    Args:
        element_type: 元素类型
        element_id: 元素ID

    Returns:
        生成的默认名称
    """
    # 类型名称映射（中文）
    type_names = {
        "image": "图片",
        "text": "文本",
        "rectangle": "矩形",
        "ellipse": "椭圆",
        "triangle": "三角形",
        "star": "星形",
        "group": "组",
        "frame": "画框",
    }

    type_name = type_names.get(element_type, element_type.capitalize())
    # 使用ID的后6位作为后缀，确保唯一性
    suffix = element_id[-6:] if len(element_id) > 6 else element_id
    return f"{type_name} {suffix}"


def _filter_dataclass_fields(data: Dict[str, Any], dataclass_type: type) -> Dict[str, Any]:
    """
    过滤字典，只保留 dataclass 中定义的字段

    这样可以容错处理前端添加的新字段，避免解析失败

    Args:
        data: 原始数据字典
        dataclass_type: 目标 dataclass 类型

    Returns:
        只包含 dataclass 定义字段的字典
    """
    from dataclasses import fields

    # 获取 dataclass 的所有字段名
    valid_fields = {f.name for f in fields(dataclass_type)}

    # 只保留有效字段
    filtered = {k: v for k, v in data.items() if k in valid_fields}

    return filtered


def _parse_container_children(data: Dict[str, Any]) -> List[CanvasElement]:
    """
    解析容器元素的子元素

    Args:
        data: 元素数据字典

    Returns:
        解析后的子元素列表
    """
    children_data = data.get("children", [])
    parsed_children = []
    for child_data in children_data:
        if isinstance(child_data, dict):
            parsed_child = _dict_to_element(child_data)
            if parsed_child is not None:
                parsed_children.append(parsed_child)
    return parsed_children


def _dict_to_element(data: Dict[str, Any]) -> Optional[CanvasElement]:
    """
    将字典转换为对应的元素类型

    Args:
        data: 元素数据字典

    Returns:
        类型化的元素实例，如果类型不支持或解析失败则返回 None
    """
    element_type = data.get("type")

    # 不支持的元素类型，返回 None
    if element_type not in ALLOWED_ELEMENT_TYPES:
        return None

    # 如果缺少 name 字段，自动生成默认名称
    if "name" not in data or not data.get("name"):
        element_id = data.get("id", "unknown")
        data["name"] = _generate_default_element_name(element_type, element_id)

    # 填充缺失的位置和尺寸字段（容错处理）
    # 这样即使元素数据不完整，也能被解析并参与位置计算，避免空间冲突
    if "x" not in data or data.get("x") is None:
        data["x"] = 0.0
        logger.debug(f"元素 {data.get('id', 'unknown')} 缺少 x 坐标，使用默认值 0.0")

    if "y" not in data or data.get("y") is None:
        data["y"] = 0.0
        logger.debug(f"元素 {data.get('id', 'unknown')} 缺少 y 坐标，使用默认值 0.0")

    # 为缺少尺寸的元素提供默认尺寸
    if "width" not in data or data.get("width") is None:
        data["width"] = DEFAULT_ELEMENT_WIDTH
        logger.debug(f"元素 {data.get('id', 'unknown')} 缺少宽度，使用默认值 {DEFAULT_ELEMENT_WIDTH}")

    if "height" not in data or data.get("height") is None:
        data["height"] = DEFAULT_ELEMENT_HEIGHT
        logger.debug(f"元素 {data.get('id', 'unknown')} 缺少高度，使用默认值 {DEFAULT_ELEMENT_HEIGHT}")

    try:
        if element_type == "image":
            filtered_data = _filter_dataclass_fields(data, ImageElement)
            return ImageElement(**filtered_data)
        elif element_type == "text":
            filtered_data = _filter_dataclass_fields(data, TextElement)
            return TextElement(**filtered_data)
        elif element_type == "rectangle":
            filtered_data = _filter_dataclass_fields(data, RectangleElement)
            return RectangleElement(**filtered_data)
        elif element_type == "ellipse":
            filtered_data = _filter_dataclass_fields(data, EllipseElement)
            return EllipseElement(**filtered_data)
        elif element_type == "triangle":
            filtered_data = _filter_dataclass_fields(data, TriangleElement)
            return TriangleElement(**filtered_data)
        elif element_type == "star":
            filtered_data = _filter_dataclass_fields(data, StarElement)
            return StarElement(**filtered_data)
        elif element_type == "group":
            # 递归解析子元素
            parsed_children = _parse_container_children(data)
            data_copy = data.copy()
            data_copy["children"] = parsed_children
            filtered_data = _filter_dataclass_fields(data_copy, GroupElement)
            return GroupElement(**filtered_data)
        elif element_type == "frame":
            # 递归解析子元素
            parsed_children = _parse_container_children(data)
            data_copy = data.copy()
            data_copy["children"] = parsed_children
            filtered_data = _filter_dataclass_fields(data_copy, FrameElement)
            return FrameElement(**filtered_data)
        else:
            # 不支持的元素类型（虽然前面已检查，但保持代码完整性）
            return None
    except (TypeError, ValueError, KeyError) as e:
        # 即使填充了默认值仍然失败，记录详细错误
        logger.warning(
            f"元素解析失败: id={data.get('id', 'unknown')}, "
            f"type={element_type}, error={str(e)}"
        )
        return None


def _parse_config_dict(data: Dict[str, Any]) -> MagicProjectConfig:
    """
    将字典解析为 MagicProjectConfig

    Args:
        data: 配置字典

    Returns:
        类型化的配置实例
    """
    # 获取 canvas 数据
    canvas_data = data.get("canvas")

    # 如果 canvas 不存在或为 None/null，表示空画布
    if not canvas_data:
        canvas = None
    else:
        # 解析画布元素
        elements_data = canvas_data.get("elements", [])
        parsed_elements = []
        skipped_count = 0

        for idx, elem in enumerate(elements_data):
            parsed_elem = _dict_to_element(elem)
            if parsed_elem is not None:
                parsed_elements.append(parsed_elem)
            else:
                skipped_count += 1
                elem_id = elem.get("id", f"index-{idx}")
                elem_type = elem.get("type", "unknown")
                logger.warning(
                    f"跳过不支持的元素 [{idx}]: id={elem_id}, type={elem_type}。"
                    f"元素类型不在支持列表中或存在无法修复的数据错误。"
                )

        if skipped_count > 0:
            logger.info(
                f"解析画布配置完成：成功 {len(parsed_elements)} 个元素，跳过 {skipped_count} 个不支持的元素"
            )

        # 解析视口（如果存在）
        viewport_data = canvas_data.get("viewport")
        viewport = ViewportState(**viewport_data) if viewport_data else None

        # 创建画布配置
        canvas = CanvasConfig(elements=parsed_elements, viewport=viewport)

    # 创建项目配置
    return MagicProjectConfig(
        version=data.get("version", "1.0.0"),
        type=data.get("type", "design"),
        name=data.get("name", ""),
        canvas=canvas
    )


def _compute_element_hierarchy_and_absolute_coords(config: MagicProjectConfig) -> None:
    """
    计算并缓存所有元素的父子关系和绝对坐标

    这个函数会递归遍历所有元素（包括容器内的子元素），
    为每个元素设置 _parent_id、_absolute_x 和 _absolute_y。

    Args:
        config: 项目配置对象（会被原地修改）
    """
    if config.canvas is None or not config.canvas.elements:
        return

    def _process_element(
        element: CanvasElement,
        parent_id: Optional[str] = None,
        parent_x: float = 0.0,
        parent_y: float = 0.0
    ) -> None:
        """递归处理单个元素及其子元素"""
        # 设置父元素 ID
        element._parent_id = parent_id

        # 计算绝对坐标
        element_x = element.x if element.x is not None else 0.0
        element_y = element.y if element.y is not None else 0.0
        element._absolute_x = parent_x + element_x
        element._absolute_y = parent_y + element_y

        logger.debug(
            f"元素 {element.id} ({element.type}): "
            f"相对坐标=({element_x:.1f}, {element_y:.1f}), "
            f"绝对坐标=({element._absolute_x:.1f}, {element._absolute_y:.1f}), "
            f"父元素={'None' if parent_id is None else parent_id}"
        )

        # 如果是容器元素，递归处理子元素
        if isinstance(element, (FrameElement, GroupElement)):
            if hasattr(element, 'children') and element.children:
                for child in element.children:
                    _process_element(
                        child,
                        parent_id=element.id,
                        parent_x=element._absolute_x,
                        parent_y=element._absolute_y
                    )

    # 处理所有顶层元素
    for element in config.canvas.elements:
        _process_element(element)

    logger.info(f"已计算 {len(config.canvas.elements)} 个顶层元素的坐标层级关系")


def _config_to_dict(config: MagicProjectConfig) -> Dict[str, Any]:
    """
    将 MagicProjectConfig 转换为字典

    Args:
        config: 配置实例

    Returns:
        配置字典
    """
    # 使用 asdict 转换为字典，但需要正确处理嵌套对象
    result: Dict[str, Any] = {
        "version": config.version,
        "type": config.type,
        "name": config.name,
    }

    # 如果 canvas 为 None，表示空画布
    if config.canvas is None:
        result["canvas"] = None
    else:
        result["canvas"] = {
            "elements": []
        }

        # 添加视口（如果存在）
        if config.canvas.viewport:
            result["canvas"]["viewport"] = asdict(config.canvas.viewport)

        # 转换元素
        for element in config.canvas.elements:
            elem_dict = asdict(element)
            # 移除运行时字段（以 _ 开头的字段不序列化）
            elem_dict = {k: v for k, v in elem_dict.items() if not k.startswith('_')}
            # 移除 None 值以保持 JSON 简洁
            elem_dict = {k: v for k, v in elem_dict.items() if v is not None}
            result["canvas"]["elements"].append(elem_dict)

    return result


async def read_magic_project_js(project_path: str) -> MagicProjectConfig:
    """
    读取并解析 magic.project.js 文件（异步）

    使用共享锁等待写入完成，避免读到部分内容

    Args:
        project_path: 相对于工作区的项目目录路径

    Returns:
        解析后的配置对象

    Raises:
        FileNotFoundError: 如果 magic.project.js 不存在
        ValueError: 如果 JSONP 格式无效或文件为空
        json.JSONDecodeError: 如果 JSON 解析失败
    """
    file_path = get_project_file_path(project_path)

    # 异步检查文件是否存在
    if not await async_exists(file_path):
        raise FileNotFoundError(
            f"magic.project.js not found at: {file_path}\n"
            f"Please create the project first using create_design_project tool."
        )

    file_handle = None
    try:
        # 打开文件
        file_handle = await aiofiles.open(file_path, "r", encoding="utf-8")
        file_fd = file_handle.fileno()

        # 获取共享锁（允许多个读者，但会等待写入完成）
        await asyncio.get_event_loop().run_in_executor(
            None, fcntl.flock, file_fd, fcntl.LOCK_SH
        )

        logger.debug(f"Acquired shared read lock for: {file_path}")

        # 读取文件内容
        content = await file_handle.read()

        # 验证文件不为空
        if not content or len(content.strip()) == 0:
            raise ValueError(
                f"magic.project.js is empty at: {file_path}\n"
                f"File may be corrupted or still being written."
            )

    except Exception as e:
        if isinstance(e, (ValueError, FileNotFoundError)):
            raise
        raise IOError(f"Failed to read magic.project.js: {str(e)}")
    finally:
        # 释放共享锁并关闭文件
        if file_handle:
            try:
                file_fd = file_handle.fileno()
                await asyncio.get_event_loop().run_in_executor(
                    None, fcntl.flock, file_fd, fcntl.LOCK_UN
                )
                await file_handle.close()
                logger.debug(f"Released read lock and closed file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to release read lock or close file: {e}")

    # 从 JSONP 格式提取 JSON: window.magicProjectConfig = {...}
    # 支持两种模式以提高兼容性
    # 分号是可选的，以兼容不同的代码风格
    # 注意：优先匹配不带分号的（与 magic.project.template.js 模板一致）
    patterns = [
        # 优先匹配不带分号的（匹配到文件末尾或下一个语句）
        r"window\.magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
        r"magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
        # 兼容旧格式：严格带分号的
        r"window\.magicProjectConfig\s*=\s*({[\s\S]*?});",
        r"magicProjectConfig\s*=\s*({[\s\S]*?});"
    ]

    json_str = None
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            json_str = match.group(1)
            break

    if not json_str:
        # 打印文件原始内容以便排查问题
        logger.error(
            f"Invalid JSONP format in magic.project.js at: {file_path}\n"
            f"File content (length: {len(content)} chars):\n{content}"
        )
        raise ValueError(
            f"Invalid JSONP format in magic.project.js.\n"
            f"Expected: window.magicProjectConfig = {{...}} or window.magicProjectConfig = {{...}};\n"
            f"File may be corrupted."
        )

    # 解析 JSON
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        # 打印提取的 JSON 内容以便排查问题
        logger.error(
            f"Failed to parse JSON in magic.project.js at: {file_path}\n"
            f"JSON parsing error: {str(e)}\n"
            f"Extracted JSON content (length: {len(json_str)} chars):\n{json_str}"
        )
        raise json.JSONDecodeError(
            f"Failed to parse JSON in magic.project.js: {str(e)}",
            e.doc,
            e.pos
        )

    # 仅验证项目级配置（不验证元素级，让解析阶段的容错机制处理）
    validation = validate_project_config(data, validate_elements=False)
    if not validation.is_valid:
        raise ValueError(
            f"Invalid project configuration:\n" + "\n".join(f"  - {err}" for err in validation.errors)
        )

    # 解析为类型化配置（会自动跳过格式错误的元素）
    config = _parse_config_dict(data)

    # 计算所有元素的父子关系和绝对坐标
    _compute_element_hierarchy_and_absolute_coords(config)

    return config


async def write_magic_project_js(
    project_path: str,
    config: MagicProjectConfig
) -> bool:
    """
    将配置写入 magic.project.js 文件（JSONP 格式，异步）

    使用文件锁保证写入的原子性，并强制同步到磁盘

    Args:
        project_path: 相对于工作区的项目目录路径
        config: 要写入的配置对象

    Returns:
        写入成功返回 True

    Raises:
        ValueError: 如果配置验证失败
        IOError: 如果写入操作失败
    """
    # 将配置转换为字典
    config_dict = _config_to_dict(config)

    # 写入前验证配置
    validation = validate_project_config(config_dict)
    if not validation.is_valid:
        raise ValueError(
            f"Cannot write invalid configuration:\n" + "\n".join(f"  - {err}" for err in validation.errors)
        )

    file_path = get_project_file_path(project_path)

    # 序列化为格式化的 JSON
    try:
        json_str = json.dumps(config_dict, ensure_ascii=False, indent=2)
    except Exception as e:
        raise ValueError(f"Failed to serialize configuration to JSON: {str(e)}")

    # 包装为 JSONP 格式（不加分号，匹配模板格式）
    content = f"window.magicProjectConfig = {json_str}\n"

    file_handle = None
    try:
        # 确保父目录存在
        parent_dir = os.path.dirname(file_path)
        await async_mkdir(parent_dir, parents=True, exist_ok=True)

        # 打开文件（如果不存在则创建，'w' 模式会自动截断文件）
        file_handle = await aiofiles.open(file_path, "w", encoding="utf-8")
        file_fd = file_handle.fileno()

        # 获取排他锁（阻止其他进程读写）
        await asyncio.get_event_loop().run_in_executor(
            None, fcntl.flock, file_fd, fcntl.LOCK_EX
        )

        logger.info(f"Acquired exclusive write lock for: {file_path}")

        # 写入内容（'w' 模式会自动截断文件）
        await file_handle.write(content)

        # 强制刷新到磁盘（确保写入 TOS）
        await file_handle.flush()
        os.fsync(file_fd)

        logger.info(f"Content written and synced to disk: {file_path}")

        # 对目录执行 fsync（确保目录元数据也同步）
        dir_fd = os.open(parent_dir, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)

        # 等待并验证文件写入（带重试机制，适应 TOS 同步延迟）
        max_retries = 5
        retry_delay = 0.2
        expected_size = len(content.encode('utf-8'))

        for attempt in range(max_retries):
            await asyncio.sleep(retry_delay)

            # 验证文件大小
            stat_info = await aiofiles.os.stat(file_path)
            if stat_info.st_size == expected_size:
                logger.info(f"Write verified, file size: {stat_info.st_size} bytes (attempt: {attempt + 1})")
                break
            elif stat_info.st_size == 0:
                # 文件为空，严重问题
                if attempt < max_retries - 1:
                    logger.warning(
                        f"File is empty after write, retrying... "
                        f"(attempt {attempt + 1}/{max_retries})"
                    )
                    continue
                raise IOError(
                    f"File is empty after write and retries: {file_path}"
                )
            else:
                # 大小不匹配
                if attempt < max_retries - 1:
                    logger.warning(
                        f"File size mismatch: expected {expected_size}, got {stat_info.st_size}, "
                        f"retrying... (attempt {attempt + 1}/{max_retries})"
                    )
                    continue
                # 最后一次也不匹配，但至少不是空的，记录警告后继续
                logger.warning(
                    f"File size mismatch after retries: expected {expected_size}, "
                    f"got {stat_info.st_size}. Continuing anyway."
                )
                break

        return True

    except Exception as e:
        logger.error(f"Failed to write magic.project.js: {str(e)}")
        raise IOError(f"Failed to write magic.project.js: {str(e)}")

    finally:
        # 释放文件锁并关闭文件
        if file_handle:
            try:
                file_fd = file_handle.fileno()
                # 释放锁
                await asyncio.get_event_loop().run_in_executor(
                    None, fcntl.flock, file_fd, fcntl.LOCK_UN
                )
                # 关闭文件
                await file_handle.close()
                logger.info(f"Released write lock and closed file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to release lock or close file: {e}")


def validate_project_config(config: Dict[str, Any], validate_elements: bool = True) -> ValidationResult:
    """
    验证项目配置结构

    Args:
        config: 要验证的配置字典
        validate_elements: 是否验证画布元素（默认 True）。
                          设为 False 时只验证项目级配置，跳过元素验证。

    Returns:
        包含验证状态和错误信息的 ValidationResult 对象
    """
    errors = []

    # 检查配置是否为字典
    if not isinstance(config, dict):
        return ValidationResult(is_valid=False, errors=["Configuration must be a dictionary"])

    # 检查必需的顶层字段
    missing_fields = REQUIRED_PROJECT_FIELDS - set(config.keys())
    if missing_fields:
        errors.append(f"Missing required fields: {', '.join(missing_fields)}")

    # 验证 'type' 字段
    if "type" in config and config["type"] != "design":
        errors.append(f"Invalid type: '{config['type']}' (expected 'design')")

    # 验证 'canvas' 结构
    if "canvas" in config:
        canvas = config["canvas"]
        # canvas 可以为 None/null，表示空画布
        if canvas is None:
            pass  # 空画布是合法的
        elif not isinstance(canvas, dict):
            errors.append("'canvas' must be a dictionary or null")
        elif "elements" not in canvas:
            errors.append("'canvas.elements' is required")
        elif not isinstance(canvas["elements"], list):
            errors.append("'canvas.elements' must be an array")
        elif validate_elements:
            # 只有在 validate_elements=True 时才验证每个元素
            for idx, element in enumerate(canvas["elements"]):
                element_errors = _validate_element(element, idx)
                errors.extend(element_errors)

    return ValidationResult(is_valid=len(errors) == 0, errors=errors)


def _validate_element(element: Dict[str, Any], index: int) -> List[str]:
    """
    验证单个画布元素

    Args:
        element: 要验证的元素字典
        index: 元素在数组中的索引（用于错误消息）

    Returns:
        验证错误消息列表
    """
    errors = []
    prefix = f"Element [{index}]"

    # 检查元素是否为字典
    if not isinstance(element, dict):
        return [f"{prefix}: Must be a dictionary"]

    # 检查必需字段
    missing_fields = REQUIRED_ELEMENT_FIELDS - set(element.keys())
    if missing_fields:
        errors.append(f"{prefix}: Missing required fields: {', '.join(missing_fields)}")

    # 验证元素类型
    if "type" in element:
        elem_type = element["type"]
        if elem_type not in ALLOWED_ELEMENT_TYPES:
            errors.append(
                f"{prefix}: Invalid type '{elem_type}'. "
                f"Allowed types: {', '.join(sorted(ALLOWED_ELEMENT_TYPES))}"
            )

    # 验证数值字段
    numeric_fields = {
        "x": (float, int),
        "y": (float, int),
        "width": (float, int),
        "height": (float, int),
        "zIndex": int,
        "opacity": (float, int),
        "rotation": (float, int),
    }

    for field, expected_types in numeric_fields.items():
        if field in element:
            value = element[field]
            if not isinstance(value, expected_types):
                errors.append(
                    f"{prefix}: Field '{field}' must be numeric, got {type(value).__name__}"
                )

    # 验证透明度范围
    if "opacity" in element:
        opacity = element["opacity"]
        if isinstance(opacity, (int, float)) and not (0 <= opacity <= 1):
            errors.append(f"{prefix}: opacity must be between 0 and 1, got {opacity}")

    # 验证布尔字段
    boolean_fields = ["visible", "locked", "draggable", "listening"]
    for field in boolean_fields:
        if field in element and not isinstance(element[field], bool):
            errors.append(f"{prefix}: Field '{field}' must be boolean")

    return errors
