"""Frame 和 Group 的结构 Content Fields。"""

from dataclasses import dataclass

from app.tools.canvas.domain.content_fields.base import CanvasContentFields


@dataclass
class StructuralContentFields(CanvasContentFields):
    """表示不包含普通业务字段的结构 Content。"""

    def to_dict(self) -> dict[str, object]:
        """转换为结构 Content 协议字段。"""
        return {}
