"""Ellipse Content Fields 领域模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.content_fields.base import CanvasContentFields


@dataclass
class EllipseContentFields(CanvasContentFields):
    """保存椭圆的填充与描边字段。"""

    fill: str | None = None
    stroke: str | None = None
    stroke_width: float | None = None

    def to_dict(self) -> dict[str, object]:
        """转换为 Ellipse Content 协议字段。"""
        values = {"fill": self.fill, "stroke": self.stroke, "strokeWidth": self.stroke_width}
        return {key: value for key, value in values.items() if value is not None}
