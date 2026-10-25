"""Canvas 生成重试的部分参数覆盖命令。"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class GenerationParametersOverride:
    """只保存用户本次明确提供的可覆盖生成字段。"""

    prompt: str | None = None
    model_id: str | None = None
    name: str | None = None
    size: str | None = None
    reference_images: tuple[str, ...] | None = None
    reference_image_paths: tuple[str, ...] | None = None
    reference_video_paths: tuple[str, ...] | None = None
    reference_audio_paths: tuple[str, ...] | None = None
    frame_start_path: str | None = None
    frame_end_path: str | None = None
    input_mode: str | None = None
    task: str | None = None
    duration_seconds: int | None = None
    aspect_ratio: str | None = None
    resolution: str | None = None
    fps: int | None = None
    seed: int | None = None
    watermark: bool | None = None
    draft: bool | None = None
    audio_policy: str | None = None
    extensions: JsonObject | None = None
    _provided_fields: frozenset[str] = field(default_factory=frozenset, repr=False)

    def to_dict(self) -> JsonObject:
        """只输出用户明确填写的字段，避免默认值误覆盖原请求。"""
        values = {
            "prompt": self.prompt,
            "model_id": self.model_id,
            "name": self.name,
            "size": self.size,
            "reference_images": list(self.reference_images) if self.reference_images is not None else None,
            "reference_image_paths": list(self.reference_image_paths) if self.reference_image_paths is not None else None,
            "reference_video_paths": list(self.reference_video_paths) if self.reference_video_paths is not None else None,
            "reference_audio_paths": list(self.reference_audio_paths) if self.reference_audio_paths is not None else None,
            "frame_start_path": self.frame_start_path,
            "frame_end_path": self.frame_end_path,
            "input_mode": self.input_mode,
            "task": self.task,
            "duration_seconds": self.duration_seconds,
            "aspect_ratio": self.aspect_ratio,
            "resolution": self.resolution,
            "fps": self.fps,
            "seed": self.seed,
            "watermark": self.watermark,
            "draft": self.draft,
            "audio_policy": self.audio_policy,
            "extensions": dict(self.extensions) if self.extensions is not None else None,
        }
        return {key: value for key, value in values.items() if key in self._provided_fields and value is not None}
