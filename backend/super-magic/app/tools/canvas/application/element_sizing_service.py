"""Canvas Element 初始和生成后尺寸服务。"""

from __future__ import annotations

import re
from fractions import Fraction
from pathlib import Path

from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.generated_media_protocol import find_generation_request
from app.tools.canvas.domain.models import CanvasElement
from app.tools.canvas.domain.video_resolution import parse_resolution_short_side
from app.tools.canvas.infrastructure.assets import ProjectAssetPathResolver
from app.tools.canvas.production.ports import MediaProbePort
from app.tools.canvas.strategies.layout.geometry import (
    DEFAULT_ELEMENT_HEIGHT,
    DEFAULT_ELEMENT_WIDTH,
    DEFAULT_VIDEO_EDIT_HEIGHT,
    DEFAULT_VIDEO_EDIT_WIDTH,
)

_SIZABLE_ELEMENT_TYPES = {"image", "video", "audio"}
_SIZE_PATTERN = re.compile(r"^(\d+)x(\d+)$", re.IGNORECASE)
_VIDEO_DEFAULT_SIZE = (1280.0, 720.0)
_AUDIO_DEFAULT_SIZE = (480.0, 120.0)

class CanvasElementSizingService:
    """为 Canvas Element 提供稳定的初始尺寸和媒体实测尺寸。"""

    def __init__(self, workspace: Path, media_probe: MediaProbePort):
        """保存工作区路径解析和媒体探测端口。"""
        self.path_resolver = ProjectAssetPathResolver(workspace)
        self.media_probe = media_probe

    async def initialize(self, project_path: str, element: CanvasElement) -> None:
        """为媒体类 Element 补齐尺寸；文本、形状等交由前端测量。"""
        if element.element_type == "video-edit":
            if element.properties.width is None or element.properties.width <= 0:
                element.properties.width = DEFAULT_VIDEO_EDIT_WIDTH
            if element.properties.height is None or element.properties.height <= 0:
                element.properties.height = DEFAULT_VIDEO_EDIT_HEIGHT
            return
        if element.element_type not in _SIZABLE_ELEMENT_TYPES:
            return
        width, height = self._initial_size(element)
        element.properties.width = width
        element.properties.height = height

        content = element.get_content(element.active_content_id)
        if content is None:
            return
        fields = content.fields
        if not isinstance(fields, GeneratedMediaContentFields) or not fields.asset_path:
            return
        try:
            media_path = self.path_resolver.resolve_workspace_path_for_project(project_path, fields.asset_path)
            if element.element_type == "image":
                media = await self.media_probe.inspect_image(media_path)
            elif element.element_type == "video":
                media = await self.media_probe.inspect_video(media_path)
            else:
                return
        except (OSError, ValueError):
            return
        element.properties.width = media.width
        element.properties.height = media.height

    async def inspect_generated_image(self, project_path: str, output_uri: str | None):
        """探测已生成图片尺寸，探测失败时返回空值让初始尺寸兜底。"""
        if not output_uri:
            return None
        try:
            media = await self.media_probe.inspect_image(
                self.path_resolver.resolve_workspace_path_for_project(project_path, output_uri)
            )
        except (OSError, ValueError):
            return None
        return media.width, media.height

    async def inspect_generated_video(self, project_path: str, output_uri: str | None):
        """探测已生成视频尺寸，探测失败时返回空值让初始尺寸兜底。"""
        if not output_uri:
            return None
        try:
            media = await self.media_probe.inspect_video(
                self.path_resolver.resolve_workspace_path_for_project(project_path, output_uri)
            )
        except (OSError, ValueError):
            return None
        return media.width, media.height

    async def inspect_generated_media(
        self,
        project_path: str,
        element_type: str,
        output_uri: str | None,
    ) -> tuple[int, int] | None:
        """按 Element 类型探测已生成媒体尺寸，未知类型返回空值。"""
        if element_type == "image":
            return await self.inspect_generated_image(project_path, output_uri)
        if element_type == "video":
            return await self.inspect_generated_video(project_path, output_uri)
        return None

    @staticmethod
    def apply(element: CanvasElement, dimensions: tuple[int, int] | None) -> None:
        """把可信的媒体尺寸写入 Element，保持其他布局字段不变。"""
        if dimensions is None:
            return
        element.properties.width, element.properties.height = dimensions

    @classmethod
    def _initial_size(cls, element: CanvasElement) -> tuple[float, float]:
        """根据生成请求尺寸或元素类型默认值计算初始布局尺寸。"""
        content = element.get_content(element.active_content_id)
        if content is not None:
            fields = content.fields.to_dict()
            generation_request = find_generation_request(fields)
            request = generation_request[1] if generation_request is not None else None
            if request is not None:
                parsed = cls._parse_size(request.get("size"))
                if parsed is not None:
                    return parsed
                if element.element_type == "video":
                    parsed = cls._parse_video_aspect_ratio_size(
                        request.get("aspect_ratio"),
                        request.get("resolution"),
                    )
                    if parsed is not None:
                        return parsed
        return cls._default_size(element.element_type)

    @staticmethod
    def _default_size(element_type: str) -> tuple[float, float]:
        """按元素类型返回未指定尺寸时的默认宽高。"""
        if element_type == "video":
            return _VIDEO_DEFAULT_SIZE
        if element_type == "audio":
            return _AUDIO_DEFAULT_SIZE
        return DEFAULT_ELEMENT_WIDTH, DEFAULT_ELEMENT_HEIGHT

    @staticmethod
    def _parse_size(value: object) -> tuple[float, float] | None:
        """解析生成协议中的宽高字符串。"""
        if not isinstance(value, str):
            return None
        match = _SIZE_PATTERN.fullmatch(value.strip())
        if match is None:
            return None
        width, height = (float(item) for item in match.groups())
        if width <= 0 or height <= 0:
            return None
        return width, height

    @classmethod
    def _parse_video_aspect_ratio_size(
        cls,
        aspect_ratio: object,
        resolution: object,
    ) -> tuple[float, float] | None:
        """根据视频画面比例和短边分辨率计算初始布局宽高。"""
        ratio = cls._parse_aspect_ratio(aspect_ratio)
        if ratio is None:
            return None

        short_side = cls._parse_resolution_short_side(resolution)
        if short_side is None:
            short_side = min(_VIDEO_DEFAULT_SIZE)
        if ratio >= 1:
            return float(round(short_side * float(ratio))), short_side
        return short_side, float(round(short_side / float(ratio)))

    @staticmethod
    def _parse_aspect_ratio(value: object) -> Fraction | None:
        """解析正数形式的宽高比，例如 16:9 或 9:16。"""
        if not isinstance(value, str) or ":" not in value:
            return None
        left, right = (part.strip() for part in value.split(":", 1))
        try:
            ratio = Fraction(int(left), int(right))
        except (TypeError, ValueError, ZeroDivisionError):
            return None
        return ratio if ratio > 0 else None

    @staticmethod
    def _parse_resolution_short_side(value: object) -> float | None:
        """解析视频分辨率对应的短边长度。"""
        if not isinstance(value, str):
            return None
        short_side = parse_resolution_short_side(value)
        return float(short_side) if short_side is not None else None
