"""Canvas 视频合成导出规格。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class CompositionOutput:
    """描述一次视频导出的目标规格，不属于 Video Edit 剪辑方案。"""

    aspect_ratio: str | None = None
    width: int | None = None
    height: int | None = None
    resolution: str | None = None
    format: str = "mp4"
    audio_policy: str = "preserve"

    @classmethod
    def from_dict(cls, value: JsonObject | None) -> "CompositionOutput":
        """从工具请求或 sidecar 对象构造并校验导出规格。"""
        raw = dict(value or {})
        width = raw.get("width")
        height = raw.get("height")
        if (width is None) != (height is None):
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_OUTPUT_INVALID",
                "Composition output width and height must be provided together.",
            )
        if width is not None and (
            isinstance(width, bool)
            or not isinstance(width, int)
            or width < 2
            or isinstance(height, bool)
            or not isinstance(height, int)
            or height < 2
        ):
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_OUTPUT_INVALID",
                "Composition output width and height must be positive pixel integers.",
            )
        for field_name in ("aspectRatio", "resolution"):
            field_value = raw.get(field_name)
            if field_value is not None and not isinstance(field_value, str):
                raise CanvasDomainError(
                    "VIDEO_COMPOSITION_OUTPUT_INVALID",
                    f"Composition output {field_name} must be a string.",
                )
        output_format = raw.get("format", "mp4")
        if output_format != "mp4":
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_OUTPUT_INVALID",
                "Only MP4 output is supported.",
            )
        audio_policy = raw.get("audioPolicy", "preserve")
        if audio_policy not in {"preserve", "mute"}:
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_OUTPUT_INVALID",
                "Composition output audioPolicy must be preserve or mute.",
            )
        return cls(
            aspect_ratio=raw.get("aspectRatio"),
            width=width,
            height=height,
            resolution=raw.get("resolution"),
            format=output_format,
            audio_policy=audio_policy,
        )

    def to_dict(self) -> JsonObject:
        """转换为稳定的外部 composition.output 协议对象。"""
        values: JsonObject = {
            "format": self.format,
            "audioPolicy": self.audio_policy,
        }
        if self.aspect_ratio:
            values["aspectRatio"] = self.aspect_ratio
        if self.width is not None:
            values["width"] = self.width
            values["height"] = self.height
        if self.resolution:
            values["resolution"] = self.resolution
        return values
