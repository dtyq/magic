"""Audio Content Fields 领域模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.content_fields.base import CanvasContentFields


@dataclass
class AudioContentFields(CanvasContentFields):
    """保存 Audio Content 的媒体路径。"""

    src: str | None = None

    @property
    def asset_path(self) -> str | None:
        """返回音频媒体路径。"""
        return self.src

    def to_dict(self) -> dict[str, object]:
        """转换为 Audio Content 协议字段。"""
        return {"src": self.src} if self.src is not None else {}
