"""Video Content Fields 领域模型。"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.generated_media_protocol import generation_request_field
from app.tools.canvas.domain.types import JsonObject


@dataclass
class VideoContentFields(GeneratedMediaContentFields):
    """保存 Video Content 的确定字段和半结构化扩展对象。"""

    generate_video_request: JsonObject | None = None
    video_editor_draft: JsonObject | None = field(default=None, kw_only=True)
    video_generation_result_meta: JsonObject | None = None

    def replace_generation_result_metadata(self, metadata: JsonObject | None) -> None:
        """替换当前视频版本的生成结果元数据。"""
        self.video_generation_result_meta = deepcopy(metadata) if metadata is not None else None

    @property
    def generated_request_field(self) -> str:
        """返回视频生成请求的协议字段名。"""
        return generation_request_field("video") or "generateVideoRequest"

    def set_generation_request(self, request: JsonObject) -> None:
        """保存视频生成请求。"""
        self.generate_video_request = request

    def clear_generation_request(self) -> None:
        """清除视频生成请求。"""
        self.generate_video_request = None

    def to_dict(self) -> dict[str, object]:
        """转换为 Video Content 协议字段。"""
        values: dict[str, object | None] = {
            **self._media_dict(),
            self.generated_request_field: deepcopy(self.generate_video_request),
            "videoEditorDraft": deepcopy(self.video_editor_draft),
            "videoGenerationResultMeta": deepcopy(self.video_generation_result_meta),
        }
        return {key: value for key, value in values.items() if value is not None}
