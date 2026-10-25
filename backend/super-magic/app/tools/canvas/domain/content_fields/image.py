"""Image Content Fields 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass

from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.generated_media_protocol import generation_request_field
from app.tools.canvas.domain.types import JsonObject


@dataclass
class ImageContentFields(GeneratedMediaContentFields):
    """保存 Image Content 的确定字段和半结构化扩展对象。"""

    generate_image_request: JsonObject | None = None
    image_generation_task_meta: JsonObject | None = None
    crop: JsonObject | None = None
    # 人工不采用与生成完成是两件事；不改变主版本和下游引用。
    discarded: bool = False

    @property
    def generated_request_field(self) -> str:
        """返回图片生成请求的协议字段名。"""
        return generation_request_field("image") or "generateImageRequest"

    def set_generation_request(self, request: JsonObject) -> None:
        """保存图片生成请求。"""
        self.generate_image_request = request

    def clear_generation_request(self) -> None:
        """清除图片生成请求。"""
        self.generate_image_request = None

    def to_dict(self) -> dict[str, object]:
        """转换为 Image Content 协议字段。"""
        values: dict[str, object | None] = {
            **self._media_dict(),
            self.generated_request_field: deepcopy(self.generate_image_request),
            "imageGenerationTaskMeta": deepcopy(self.image_generation_task_meta),
            "crop": deepcopy(self.crop),
            "discarded": True if self.discarded else None,
        }
        return {key: value for key, value in values.items() if value is not None}
