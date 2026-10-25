"""Canvas 坐标空间换算服务。"""

from __future__ import annotations

import math
from typing import Any

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasDocument, CanvasElement


class CoordinateSpaceResolver:
    """负责直接父级坐标空间的边界计算和坐标转换。"""

    @staticmethod
    def bounds(elements: list[CanvasElement]) -> tuple[float, float, float, float]:
        """计算同一坐标空间内多个 Element 的包围盒。"""
        if not elements:
            raise CanvasDomainError("FRAME_SELECTION_INVALID", "Frame selection cannot be empty.")
        bounds = [CoordinateSpaceResolver.element_bounds(element) for element in elements]
        return (
            min(item[0] for item in bounds),
            min(item[1] for item in bounds),
            max(item[2] for item in bounds),
            max(item[3] for item in bounds),
        )

    @staticmethod
    def element_bounds(element: CanvasElement) -> tuple[float, float, float, float]:
        """读取单个 Element 在直接父级坐标空间内的包围盒。"""
        x = CoordinateSpaceResolver.number(element.properties.x)
        y = CoordinateSpaceResolver.number(element.properties.y)
        if x is None or y is None:
            raise CanvasDomainError("FRAME_SELECTION_INVALID", "Selected Elements must have numeric positions.")
        width = CoordinateSpaceResolver.size(element.properties.width, 1024.0)
        height = CoordinateSpaceResolver.size(element.properties.height, 1024.0)
        return x, y, x + width, y + height

    @staticmethod
    def to_local(element: CanvasElement, origin_x: float, origin_y: float) -> CanvasElement:
        """复制 Element 并把位置转换为指定父级的局部坐标。"""
        child = element.clone()
        child.properties.x = float(element.properties.x or 0) - origin_x
        child.properties.y = float(element.properties.y or 0) - origin_y
        return child

    @staticmethod
    def next_root_z_index(canvas: CanvasDocument) -> int:
        """返回当前根级最大 zIndex 之后的值。"""
        values = [
            CoordinateSpaceResolver.number(element.properties.z_index)
            for element in canvas.iter_elements()
        ]
        return int(max((value for value in values if value is not None), default=0)) + 1

    @staticmethod
    def number(value: Any) -> float | None:
        """读取排除布尔值且有限的数值。"""
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return None
        number = float(value)
        return number if math.isfinite(number) else None

    @staticmethod
    def size(value: Any, default: float) -> float:
        """读取正尺寸，缺失时使用指定默认值。"""
        number = CoordinateSpaceResolver.number(value)
        return number if number is not None and number > 0 else default
