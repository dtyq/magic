"""布局策略共享的几何计算函数。"""

from math import floor

from app.tools.canvas.domain.models import CanvasDocument, CanvasElement

DEFAULT_ELEMENT_SPACING = 200.0
DEFAULT_ELEMENT_WIDTH = 1024.0
DEFAULT_ELEMENT_HEIGHT = 1024.0
DEFAULT_VIDEO_EDIT_WIDTH = 520.0
DEFAULT_VIDEO_EDIT_HEIGHT = 360.0


def number(value: object) -> float | None:
    """读取排除布尔值的数值。"""
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def width(element: CanvasElement) -> float:
    """读取布局宽度，缺失时使用统一占位宽度。"""
    value = number(element.properties.width)
    if value is not None and value > 0:
        return value
    if element.element_type == "video-edit":
        return DEFAULT_VIDEO_EDIT_WIDTH
    return DEFAULT_ELEMENT_WIDTH


def height(element: CanvasElement) -> float:
    """读取布局高度，缺失时使用统一占位高度。"""
    value = number(element.properties.height)
    if value is not None and value > 0:
        return value
    if element.element_type == "video-edit":
        return DEFAULT_VIDEO_EDIT_HEIGHT
    return DEFAULT_ELEMENT_HEIGHT


def next_z_index(canvas: CanvasDocument, element: CanvasElement) -> int:
    """计算目标 Element 所在父级的下一个图层值。"""
    maximum = max(
        (
            value
            for item in canvas.siblings(element.element_id)
            if item.element_id != element.element_id
            and (value := number(item.properties.z_index)) is not None
        ),
        default=0.0,
    )
    return floor(maximum) + 1


def overlaps(target: CanvasElement, target_x: float, target_y: float, occupied: CanvasElement) -> bool:
    """判断目标候选矩形是否与已布局节点相交。"""
    occupied_x = float(occupied.properties.x or 0.0)
    occupied_y = float(occupied.properties.y or 0.0)
    return not (
        target_x + width(target) <= occupied_x
        or target_x >= occupied_x + width(occupied)
        or target_y + height(target) <= occupied_y
        or target_y >= occupied_y + height(occupied)
    )
