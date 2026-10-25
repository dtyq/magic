"""Canvas Element 固定属性领域模型。"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.tools.canvas.domain.models.interaction_config import InteractionConfig


@dataclass
class ElementProperties:
    """保存协议中明确允许的 Element 基础属性。"""

    name: str | None = None
    visible: bool | None = None
    locked: bool | None = None
    opacity: float | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    scale_x: float | None = None
    scale_y: float | None = None
    z_index: float | None = None
    interaction_config: InteractionConfig | None = None

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "ElementProperties":
        """从协议字段创建强类型 Element 属性。"""
        interaction = data.get("interactionConfig")
        return cls(
            name=data.get("name") if isinstance(data.get("name"), str) else None,
            visible=data.get("visible") if isinstance(data.get("visible"), bool) else None,
            locked=data.get("locked") if isinstance(data.get("locked"), bool) else None,
            opacity=_number(data.get("opacity")),
            x=_number(data.get("x")),
            y=_number(data.get("y")),
            width=_number(data.get("width")),
            height=_number(data.get("height")),
            scale_x=_number(data.get("scaleX")),
            scale_y=_number(data.get("scaleY")),
            z_index=_finite_number(data.get("zIndex")),
            interaction_config=InteractionConfig.from_dict(interaction) if isinstance(interaction, dict) else None,
        )

    def to_dict(self) -> dict[str, object]:
        """转换为前端协议字段。"""
        values: dict[str, object | None] = {
            "name": self.name,
            "visible": self.visible,
            "locked": self.locked,
            "opacity": self.opacity,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "scaleX": self.scale_x,
            "scaleY": self.scale_y,
            "zIndex": self.z_index,
            "interactionConfig": self.interaction_config.to_dict() if self.interaction_config else None,
        }
        return {key: value for key, value in values.items() if value is not None}


def _number(value: object) -> float | None:
    """把 JSON 数字收窄为浮点值，并排除布尔值。"""
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _finite_number(value: object) -> float | None:
    """保留有限 JSON 数值的小数语义，并排除布尔值。"""
    number = _number(value)
    return number if number is not None and math.isfinite(number) else None
