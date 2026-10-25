"""Canvas Element 交互配置领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Literal

from app.tools.canvas.domain.types import JsonObject


@dataclass
class InteractionConfig:
    """保存 Element 可持久化的交互配置。"""

    fill_transparent: bool | None = None
    fill_color_mode: Literal["hex", "rgb", "hsl"] | None = None
    stroke_transparent: bool | None = None
    stroke_color_mode: Literal["hex", "rgb", "hsl"] | None = None
    stroke_position: Literal["inside", "center", "outside"] | None = None
    aspect_ratio_locked: bool | None = None
    connectable: bool | None = None
    extra_data: JsonObject = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "InteractionConfig":
        """从已经过 JSON 对象校验的协议字段创建配置。"""
        known_fields = {
            "fillTransparent",
            "fillColorMode",
            "strokeTransparent",
            "strokeColorMode",
            "strokePosition",
            "aspectRatioLocked",
            "connectable",
        }
        return cls(
            fill_transparent=data.get("fillTransparent") if isinstance(data.get("fillTransparent"), bool) else None,
            fill_color_mode=data.get("fillColorMode") if data.get("fillColorMode") in {"hex", "rgb", "hsl"} else None,
            stroke_transparent=data.get("strokeTransparent") if isinstance(data.get("strokeTransparent"), bool) else None,
            stroke_color_mode=data.get("strokeColorMode") if data.get("strokeColorMode") in {"hex", "rgb", "hsl"} else None,
            stroke_position=data.get("strokePosition") if data.get("strokePosition") in {"inside", "center", "outside"} else None,
            aspect_ratio_locked=data.get("aspectRatioLocked") if isinstance(data.get("aspectRatioLocked"), bool) else None,
            connectable=data.get("connectable") if isinstance(data.get("connectable"), bool) else None,
            extra_data={key: deepcopy(value) for key, value in data.items() if key not in known_fields},
        )

    def to_dict(self) -> dict[str, object]:
        """转换为前端协议字段。"""
        values = {
            **deepcopy(self.extra_data),
            "fillTransparent": self.fill_transparent,
            "fillColorMode": self.fill_color_mode,
            "strokeTransparent": self.stroke_transparent,
            "strokeColorMode": self.stroke_color_mode,
            "strokePosition": self.stroke_position,
            "aspectRatioLocked": self.aspect_ratio_locked,
            "connectable": self.connectable,
        }
        return {key: value for key, value in values.items() if value is not None}
