"""Canvas Project 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.models.canvas_document import CanvasDocument
from app.tools.canvas.domain.types import JsonObject


@dataclass
class CanvasProject:
    """表示版本和类型已校验的 Canvas 项目。"""

    version: str
    project_type: str
    name: str
    canvas: CanvasDocument
    extra_data: JsonObject = field(default_factory=dict)

    def clone(self) -> "CanvasProject":
        """返回当前项目的深拷贝。"""
        return CanvasProject(
            version=self.version,
            project_type=self.project_type,
            name=self.name,
            canvas=self.canvas.clone(),
            extra_data=deepcopy(self.extra_data),
        )
