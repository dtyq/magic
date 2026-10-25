"""Storyboard Content Fields 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.content_fields.base import CanvasContentFields
from app.tools.canvas.domain.types import JsonObject


@dataclass
class StoryboardContentFields(CanvasContentFields):
    """保存 Storyboard 生成配置和有序镜头。"""

    generation_config: JsonObject | None = None
    shots: list[JsonObject] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        """转换为 Storyboard Content 协议字段。"""
        values: dict[str, object] = {"shots": deepcopy(self.shots)}
        if self.generation_config is not None:
            values["generationConfig"] = deepcopy(self.generation_config)
        return values
