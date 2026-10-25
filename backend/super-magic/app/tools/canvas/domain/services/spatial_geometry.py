"""查询和整理共用的画布几何；不从图片像素推断显示尺寸。"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasDocument, CanvasElement


@dataclass(frozen=True)
class CanvasRect:
    x: float
    y: float
    width: float
    height: float

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def bottom(self) -> float:
        return self.y + self.height

    def intersects(self, other: CanvasRect) -> bool:
        return self.x < other.right and self.right > other.x and self.y < other.bottom and self.bottom > other.y

    def intersection(self, other: CanvasRect) -> CanvasRect | None:
        if not self.intersects(other):
            return None
        left, top = max(self.x, other.x), max(self.y, other.y)
        return CanvasRect(left, top, min(self.right, other.right) - left, min(self.bottom, other.bottom) - top)

    def to_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y, "width": self.width, "height": self.height}

    @classmethod
    def enclosing(cls, rectangles: list[CanvasRect]) -> CanvasRect:
        if not rectangles:
            raise CanvasDomainError("EMPTY_SELECTION", "No Elements have usable geometry.")
        left, top = min(r.x for r in rectangles), min(r.y for r in rectangles)
        return cls(left, top, max(r.right for r in rectangles) - left, max(r.bottom for r in rectangles) - top)


@dataclass(frozen=True)
class CanvasTransform:
    a: float = 1
    b: float = 0
    c: float = 0
    d: float = 1
    x: float = 0
    y: float = 0

    def compose(self, child: CanvasTransform) -> CanvasTransform:
        return CanvasTransform(
            self.a * child.a + self.c * child.b,
            self.b * child.a + self.d * child.b,
            self.a * child.c + self.c * child.d,
            self.b * child.c + self.d * child.d,
            self.a * child.x + self.c * child.y + self.x,
            self.b * child.x + self.d * child.y + self.y,
        )

    def rectangle(self, width: float, height: float) -> CanvasRect:
        points = [
            (self.a * x + self.c * y + self.x, self.b * x + self.d * y + self.y)
            for x, y in ((0, 0), (width, 0), (0, height), (width, height))
        ]
        left, top = min(p[0] for p in points), min(p[1] for p in points)
        return CanvasRect(left, top, max(p[0] for p in points) - left, max(p[1] for p in points) - top)


class CanvasSpatialGeometry:
    """一次快照建立索引；父级缩放／翻转和局部位置不能混入世界坐标。"""

    def __init__(self, canvas: CanvasDocument):
        self.elements = {e.element_id: e for e in canvas.iter_elements()}
        self.parents = canvas.parent_map()
        self._transforms: dict[str, CanvasTransform] = {}

    def require(self, element_id: str) -> CanvasElement:
        element = self.elements.get(element_id)
        if element is None:
            raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {element_id} does not exist.")
        return element

    def ancestors(self, element_id: str) -> list[CanvasElement]:
        result: list[CanvasElement] = []
        parent = self.parents[element_id]
        while parent is not None:
            result.append(self.require(parent))
            parent = self.parents[parent]
        return result

    def visible(self, element_id: str) -> bool:
        return all(
            e.properties.visible is not False and e.properties.opacity != 0
            for e in [self.require(element_id), *self.ancestors(element_id)]
        )

    def visible_bounds(self, element_id: str) -> CanvasRect | None:
        rectangle = self.bounds(element_id)
        for parent in self.ancestors(element_id):
            if parent.element_type == "frame":
                rectangle = rectangle.intersection(self.bounds(parent.element_id))
                if rectangle is None:
                    return None
        return rectangle

    def assert_mutable(self, element_id: str) -> CanvasElement:
        element = self.require(element_id)
        if any(e.properties.locked is True for e in [element, *self.ancestors(element_id)]):
            raise CanvasDomainError(
                "ELEMENT_LOCKED", f"Element {element_id} or its parent is locked; unlock it manually first."
            )
        return element

    @staticmethod
    def _number(value: object, field: str, default: float | None = None) -> float:
        if value is None and default is not None:
            return default
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise CanvasDomainError("GEOMETRY_UNAVAILABLE", f"Element {field} must be a finite number.")
        return float(value)

    def local_transform(self, element_id: str) -> CanvasTransform:
        element = self.require(element_id)
        p = element.properties
        x, y = self._number(p.x, "x"), self._number(p.y, "y")
        sx, sy = self._number(p.scale_x, "scaleX", 1), self._number(p.scale_y, "scaleY", 1)
        angle = math.radians(self._number(element.extra_data.get("rotation"), "rotation", 0))
        return CanvasTransform(
            math.cos(angle) * sx, math.sin(angle) * sx, -math.sin(angle) * sy, math.cos(angle) * sy, x, y
        )

    def world_transform(self, element_id: str) -> CanvasTransform:
        if element_id not in self._transforms:
            transform = self.local_transform(element_id)
            parent = self.parents[element_id]
            self._transforms[element_id] = self.world_transform(parent).compose(transform) if parent else transform
        return self._transforms[element_id]

    def bounds(self, element_id: str, *, world: bool = True) -> CanvasRect:
        p = self.require(element_id).properties
        width, height = self._number(p.width, "width"), self._number(p.height, "height")
        if width <= 0 or height <= 0:
            raise CanvasDomainError("GEOMETRY_UNAVAILABLE", "Element display dimensions must be positive.")
        transform = self.world_transform(element_id) if world else self.local_transform(element_id)
        if transform.a * transform.d - transform.b * transform.c == 0:
            raise CanvasDomainError("GEOMETRY_UNAVAILABLE", "Element transform has zero display area.")
        result = transform.rectangle(width, height)
        if result.width <= 0 or result.height <= 0:
            raise CanvasDomainError("GEOMETRY_UNAVAILABLE", "Element transform has zero display area.")
        return result
