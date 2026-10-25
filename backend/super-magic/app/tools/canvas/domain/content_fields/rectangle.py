"""Rectangle Content Fields 领域模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.content_fields.base import CanvasContentFields


@dataclass
class RectangleContentFields(CanvasContentFields):
    """保存矩形的填充、描边与圆角字段。"""

    fill: str | None = None
    stroke: str | None = None
    stroke_width: float | None = None
    corner_radius: float | None = None

    def to_dict(self) -> dict[str, object]:
        """转换为 Rectangle Content 协议字段。"""
        values = {"fill": self.fill, "stroke": self.stroke, "strokeWidth": self.stroke_width, "cornerRadius": self.corner_radius}
        return {key: value for key, value in values.items() if value is not None}
