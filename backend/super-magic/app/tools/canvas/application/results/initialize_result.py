"""Canvas 初始化结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class InitializeCanvasResult(CanvasResult):
    """描述 Canvas 项目的初始化事实。"""

    project_path: str
    project_name: str
    created: bool

    def to_dict(self) -> JsonObject:
        """转换为初始化工具需要的 JSON 对象。"""
        return {
            "project_path": self.project_path,
            "project_name": self.project_name,
            "created": self.created,
        }
