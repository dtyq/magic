"""Canvas Connection 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from app.tools.canvas.domain.types import JsonObject


@dataclass
class CanvasConnection:
    """表示两个 Element 之间的关系。"""

    connection_id: str
    source_element_id: str
    target_element_id: str
    extra_data: JsonObject = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """转换为主协议 Connection 字典。"""
        return {
            **deepcopy(self.extra_data),
            "id": self.connection_id,
            "sourceElementId": self.source_element_id,
            "targetElementId": self.target_element_id,
        }
