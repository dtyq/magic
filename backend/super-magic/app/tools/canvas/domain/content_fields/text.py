"""Text Content Fields 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.content_fields.base import CanvasContentFields
from app.tools.canvas.domain.types import JsonObject


@dataclass
class TextContentFields(CanvasContentFields):
    """保存富文本段落和默认文本样式。"""

    content: list[JsonObject] = field(default_factory=list)
    default_style: JsonObject | None = None

    def to_dict(self) -> dict[str, object]:
        """转换为 Text Content 协议字段。"""
        values: dict[str, object] = {"content": deepcopy(self.content)}
        if self.default_style is not None:
            values["defaultStyle"] = deepcopy(self.default_style)
        return values
