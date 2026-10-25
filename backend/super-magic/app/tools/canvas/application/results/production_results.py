"""Canvas 内容产出结果。"""

from dataclasses import dataclass

from app.tools.canvas.application.results.base import CanvasResult
from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class CanvasVideoCompositionResult(CanvasResult):
    """描述一次 Video Edit 到最终 Video Content 的合成结果。"""

    result_element_id: str
    result_content_id: str
    status: str
    src: str
    width: int
    height: int
    duration_seconds: float
    has_audio: bool

    def to_dict(self) -> JsonObject:
        """转换为视频合成工具需要的 JSON 对象。"""
        return {
            "result_element_id": self.result_element_id,
            "result_content_id": self.result_content_id,
            "status": self.status,
            "src": self.src,
            "width": self.width,
            "height": self.height,
            "duration_seconds": self.duration_seconds,
            "has_audio": self.has_audio,
        }


@dataclass(frozen=True)
class ImportedImageResult:
    """描述一个成功物化的图片候选。"""

    element_id: str
    content_id: str
    src: str
    name: str
    source_url: str

    def to_dict(self) -> JsonObject:
        """转换为导入图片结果项。"""
        return {
            "element_id": self.element_id,
            "content_id": self.content_id,
            "src": self.src,
            "name": self.name,
            "source_url": self.source_url,
        }


@dataclass(frozen=True)
class ImageSearchItemResult:
    """描述一个图片搜索任务的结果。"""

    item_ref: str
    status: str
    imported_count: int
    failed_count: int
    items: tuple[ImportedImageResult, ...] = ()
    error: str | None = None

    def to_dict(self) -> JsonObject:
        """转换为图片搜索任务结果项。"""
        values: JsonObject = {
            "item_ref": self.item_ref,
            "status": self.status,
            "imported_count": self.imported_count,
            "failed_count": self.failed_count,
            "items": [item.to_dict() for item in self.items],
            "error": self.error,
        }
        return {key: value for key, value in values.items() if value is not None}


@dataclass(frozen=True)
class CanvasImageSearchResult(CanvasResult):
    """描述一次图片搜索和导入批次。"""

    topic_id: str
    items: tuple[ImageSearchItemResult, ...]

    def to_dict(self) -> JsonObject:
        """转换为图片搜索工具需要的 JSON 对象。"""
        return {
            "topic_id": self.topic_id,
            "items": [item.to_dict() for item in self.items],
        }
