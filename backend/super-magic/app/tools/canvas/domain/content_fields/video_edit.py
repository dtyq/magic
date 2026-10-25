"""Video Edit Content Fields 领域模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar

from app.tools.canvas.domain.content_fields.base import CanvasContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.types import JsonObject


@dataclass
class VideoEditContentFields(CanvasContentFields):
    """保存可复用的视频和音频剪辑顺序。"""

    MAX_VIDEO_SEQUENCE_LENGTH: ClassVar[int] = 100
    video_sequence: list[str] = field(default_factory=list)
    audio_sequence: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """创建 Fields 时立即校验 Video Edit 的结构不变量。"""
        self.validate()

    def validate(self) -> None:
        """校验媒体序列的结构约束。"""
        if not self.video_sequence:
            raise CanvasDomainError(
                "VIDEO_EDIT_SEQUENCE_INVALID",
                "videoSequence must contain at least one Video Element.",
            )
        if len(self.video_sequence) > self.MAX_VIDEO_SEQUENCE_LENGTH:
            raise CanvasDomainError(
                "VIDEO_EDIT_SEQUENCE_INVALID",
                f"videoSequence supports at most {self.MAX_VIDEO_SEQUENCE_LENGTH} Video Elements.",
            )
        self._validate_unique_ids("videoSequence", self.video_sequence)
        if len(self.audio_sequence) > 1:
            raise CanvasDomainError(
                "VIDEO_EDIT_SEQUENCE_INVALID",
                "audioSequence supports at most one Audio Element.",
            )
        self._validate_unique_ids("audioSequence", self.audio_sequence)

    @staticmethod
    def _validate_unique_ids(field_name: str, values: list[str]) -> None:
        """拒绝空白 ID 和同一序列中的重复引用。"""
        if any(not isinstance(value, str) or not value.strip() for value in values):
            raise CanvasDomainError(
                "VIDEO_EDIT_SEQUENCE_INVALID",
                f"{field_name} IDs must be non-empty strings.",
            )
        if len(values) != len(set(values)):
            raise CanvasDomainError(
                "VIDEO_EDIT_SEQUENCE_INVALID",
                f"{field_name} IDs must be unique.",
            )

    def to_dict(self) -> dict[str, object]:
        """转换为 Video Edit Content 协议字段。"""
        values: dict[str, object] = {
            "videoSequence": list(self.video_sequence),
            "audioSequence": list(self.audio_sequence),
        }
        return values
