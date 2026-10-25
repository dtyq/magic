"""按 Element 类型创建 Content Fields 的工厂。"""

from __future__ import annotations

from copy import deepcopy
from typing import cast

from app.tools.canvas.domain.content_fields.audio import AudioContentFields
from app.tools.canvas.domain.content_fields.base import CanvasContentFields
from app.tools.canvas.domain.content_fields.ellipse import EllipseContentFields
from app.tools.canvas.domain.content_fields.generated_media import GenerationStatus
from app.tools.canvas.domain.content_fields.generated_media_protocol import generation_request_field
from app.tools.canvas.domain.content_fields.image import ImageContentFields
from app.tools.canvas.domain.content_fields.rectangle import RectangleContentFields
from app.tools.canvas.domain.content_fields.star import StarContentFields
from app.tools.canvas.domain.content_fields.storyboard import StoryboardContentFields
from app.tools.canvas.domain.content_fields.structural import StructuralContentFields
from app.tools.canvas.domain.content_fields.text import TextContentFields
from app.tools.canvas.domain.content_fields.triangle import TriangleContentFields
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.content_fields.video_edit import VideoEditContentFields
from app.tools.canvas.domain.errors import CanvasDomainError, CanvasProtocolError
from app.tools.canvas.domain.types import JsonObject, JsonValue


class ContentFieldsFactory:
    """负责协议对象与确定 Content Fields 类型之间的转换。"""

    @classmethod
    def from_protocol(cls, element_type: str, data: dict[str, JsonValue]) -> CanvasContentFields:
        """按 Element 类型解码并校验 Content Fields。"""
        if element_type in {"frame", "group"}:
            return StructuralContentFields()
        if element_type == "image":
            request_field = generation_request_field("image")
            return ImageContentFields(
                src=cls._optional_string(data, "src"),
                status=cls._optional_status(data, "status"),
                stored_error_message=cls._optional_string(data, "errorMessage"),
                visual_understanding=cls._optional_object(data, "visualUnderstanding"),
                generate_image_request=cls._optional_object(data, request_field or ""),
                image_generation_task_meta=cls._optional_object(data, "imageGenerationTaskMeta"),
                crop=cls._optional_object(data, "crop"),
                discarded=cls._boolean(data, "discarded"),
            )
        if element_type == "video":
            request_field = generation_request_field("video")
            return VideoContentFields(
                src=cls._optional_string(data, "src"),
                status=cls._optional_status(data, "status"),
                stored_error_message=cls._optional_string(data, "errorMessage"),
                visual_understanding=cls._optional_object(data, "visualUnderstanding"),
                generate_video_request=cls._optional_object(data, request_field or ""),
                video_editor_draft=cls._optional_object(data, "videoEditorDraft"),
                video_generation_result_meta=cls._optional_object(data, "videoGenerationResultMeta"),
            )
        if element_type == "audio":
            return AudioContentFields(
                src=cls._optional_string(data, "src"),
            )
        if element_type == "text":
            return TextContentFields(
                content=cls._object_list(data, "content"),
                default_style=cls._optional_object(data, "defaultStyle"),
            )
        if element_type == "rectangle":
            return RectangleContentFields(
                fill=cls._optional_string(data, "fill"),
                stroke=cls._optional_string(data, "stroke"),
                stroke_width=cls._optional_number(data, "strokeWidth"),
                corner_radius=cls._optional_number(data, "cornerRadius"),
            )
        if element_type == "ellipse":
            return EllipseContentFields(
                fill=cls._optional_string(data, "fill"),
                stroke=cls._optional_string(data, "stroke"),
                stroke_width=cls._optional_number(data, "strokeWidth"),
            )
        if element_type == "triangle":
            return TriangleContentFields(
                fill=cls._optional_string(data, "fill"),
                stroke=cls._optional_string(data, "stroke"),
                stroke_width=cls._optional_number(data, "strokeWidth"),
            )
        if element_type == "star":
            return StarContentFields(
                fill=cls._optional_string(data, "fill"),
                stroke=cls._optional_string(data, "stroke"),
                stroke_width=cls._optional_number(data, "strokeWidth"),
                corner_radius=cls._optional_number(data, "cornerRadius"),
                sides=cls._optional_integer(data, "sides"),
                inner_radius_ratio=cls._optional_number(data, "innerRadiusRatio"),
            )
        if element_type == "storyboard":
            return StoryboardContentFields(
                generation_config=cls._optional_object(data, "generationConfig"),
                shots=cls._object_list(data, "shots"),
            )
        if element_type == "video-edit":
            try:
                return VideoEditContentFields(
                    video_sequence=cls._string_list(data, "videoSequence"),
                    audio_sequence=cls._string_list(data, "audioSequence"),
                )
            except CanvasDomainError as error:
                raise CanvasProtocolError(error.code, error.message) from error
        raise CanvasProtocolError("INVALID_CONTENT", f"Unsupported Content type: {element_type}.")

    @staticmethod
    def empty(element_type: str) -> CanvasContentFields:
        """为新增 Element 创建对应类型的空 Fields。"""
        return ContentFieldsFactory.from_protocol(element_type, {})

    @staticmethod
    def _boolean(data: dict[str, JsonValue], key: str) -> bool:
        """读取缺省为 false 的布尔字段，避免字符串被当成真值。"""
        value = data.get(key, False)
        if not isinstance(value, bool):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be a boolean.")
        return value

    @staticmethod
    def _optional_string(data: dict[str, JsonValue], key: str) -> str | None:
        """读取可选字符串字段。"""
        value = data.get(key)
        if value is None:
            return None
        if not isinstance(value, str):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be a string.")
        return value

    @staticmethod
    def _optional_number(data: dict[str, JsonValue], key: str) -> float | None:
        """读取可选数字字段。"""
        value = data.get(key)
        if value is None:
            return None
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be a number.")
        return float(value)

    @staticmethod
    def _optional_integer(data: dict[str, JsonValue], key: str) -> int | None:
        """读取可选整数字段。"""
        value = data.get(key)
        if value is None:
            return None
        if not isinstance(value, int) or isinstance(value, bool):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be an integer.")
        return value

    @staticmethod
    def _optional_status(data: dict[str, JsonValue], key: str) -> GenerationStatus | None:
        """读取可选生成状态字段。"""
        value = data.get(key)
        if value is None:
            return None
        if value not in {"pending", "processing", "completed", "failed", "terminated"}:
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} contains an unsupported generation status.")
        return cast(GenerationStatus, value)

    @staticmethod
    def _optional_object(data: dict[str, JsonValue], key: str) -> JsonObject | None:
        """读取确实允许扩展的 JSON 对象字段。"""
        value = data.get(key)
        if value is None:
            return None
        if not isinstance(value, dict):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be an object.")
        return deepcopy(value)

    @staticmethod
    def _object_list(data: dict[str, JsonValue], key: str) -> list[JsonObject]:
        """读取对象数组字段。"""
        value = data.get(key)
        if value is None:
            return []
        if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be an array of objects.")
        return [deepcopy(item) for item in value if isinstance(item, dict)]

    @staticmethod
    def _string_list(data: dict[str, JsonValue], key: str) -> list[str]:
        """读取字符串数组字段。"""
        value = data.get(key)
        if value is None:
            return []
        if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
            raise CanvasProtocolError("INVALID_CONTENT", f"{key} must be an array of non-empty strings.")
        return [item for item in value if isinstance(item, str)]
