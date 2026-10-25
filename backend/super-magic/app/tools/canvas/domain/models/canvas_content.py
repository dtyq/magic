"""Canvas Content 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.content_fields import CanvasContentFields
from app.tools.canvas.domain.types import JsonObject


@dataclass
class CanvasContent:
    """表示一个 Element 下的 Content 版本。"""

    content_id: str
    fields: CanvasContentFields
    extra_data: JsonObject = field(default_factory=dict)

    def clone(self) -> "CanvasContent":
        """返回当前 Content 的深拷贝。"""
        return CanvasContent(self.content_id, self.fields.clone(), deepcopy(self.extra_data))

    def to_dict(self) -> dict[str, object]:
        """转换为主协议 Content 字典。"""
        return {
            **deepcopy(self.extra_data),
            "contentId": self.content_id,
            **self.fields.to_dict(),
        }
