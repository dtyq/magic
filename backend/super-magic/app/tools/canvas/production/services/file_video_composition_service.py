"""基于工作区文件列表构造 Canvas 视频合成请求。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any

from app.tools.canvas.domain.video_resolution import parse_resolution_short_side
from app.tools.canvas.production.ports import VideoCompositionPort, VideoCompositionRequest
from app.utils.async_file_utils import async_is_file


@dataclass(frozen=True)
class FileVideoCompositionPlan:
    """描述一次文件列表合成的输入、输出和最终画布尺寸。"""

    request: VideoCompositionRequest
    output_relative_path: str


class FileVideoCompositionService:
    """把沙箱 workspace-relative 文件列表转换为 Canvas 合成请求。"""

    def __init__(self, adapter: VideoCompositionPort) -> None:
        """初始化媒体探测端口。"""
        self._adapter = adapter

    async def build_plan(
        self,
        *,
        workspace_dir: Path,
        file_dir: str,
        composition: dict[str, Any],
        generation: dict[str, Any],
        output_file_name: str,
        task_id: str,
    ) -> FileVideoCompositionPlan:
        """解析文件列表、分析媒体并构造 Canvas 合成请求。"""
        video_paths = [
            await self._resolve_workspace_path(workspace_dir, item.get("path"))
            for item in self._media_items(composition, "videos")
        ]
        if not video_paths:
            raise ValueError("composition.videos must contain at least one video")

        audio_items = self._media_items(composition, "audios")
        if len(audio_items) > 1:
            raise ValueError("composition supports at most one audio")
        audio_path = (
            await self._resolve_workspace_path(workspace_dir, audio_items[0].get("path"))
            if audio_items
            else None
        )
        source_infos = [
            await self._adapter.inspect_video(path)
            for path in video_paths
        ]
        width, height = self._resolve_dimensions(source_infos, generation)
        audio_policy = str(
            generation.get("audio_policy")
            or generation.get("audioPolicy")
            or "preserve"
        ).strip().casefold()
        if audio_policy not in {"preserve", "mute"}:
            raise ValueError("generation audio_policy must be preserve or mute")

        normalized_file_dir = self._normalize_workspace_relative_path(
            file_dir,
            "file_dir",
            allow_root=True,
        )
        normalized_file_name = self._normalize_output_file_name(
            output_file_name or f"composition-{task_id}.mp4"
        )
        output_relative_path = self._join_relative_path(
            normalized_file_dir,
            normalized_file_name,
        )
        output_path = self._resolve_workspace_output_path(
            workspace_dir,
            output_relative_path,
        )
        return FileVideoCompositionPlan(
            request=VideoCompositionRequest(
                video_paths=tuple(video_paths),
                audio_path=audio_path,
                output_path=output_path,
                width=width,
                height=height,
                audio_policy=audio_policy,
            ),
            output_relative_path=f"./{output_relative_path}",
        )

    @classmethod
    def _resolve_dimensions(
        cls,
        source_infos: list[tuple[int, int, float, bool]],
        generation: dict[str, Any],
    ) -> tuple[int, int]:
        """按显式规格或首个视频规格确定输出尺寸。"""
        first_width, first_height, _, _ = source_infos[0]
        explicit_width = generation.get("width")
        explicit_height = generation.get("height")
        if explicit_width is not None or explicit_height is not None:
            if (
                isinstance(explicit_width, bool)
                or not isinstance(explicit_width, int)
                or explicit_width < 2
                or isinstance(explicit_height, bool)
                or not isinstance(explicit_height, int)
                or explicit_height < 2
            ):
                raise ValueError("generation width and height must be positive pixel integers")
            return cls._even(explicit_width), cls._even(explicit_height)
        aspect_ratio = str(generation.get("aspect_ratio") or "").strip()
        resolution = str(generation.get("resolution") or "").strip().casefold()
        if aspect_ratio == "" and resolution == "":
            return cls._even(first_width), cls._even(first_height)
        ratio = (
            cls._parse_aspect_ratio(aspect_ratio)
            if aspect_ratio
            else Fraction(first_width, first_height)
        )
        short_side = (
            parse_resolution_short_side(resolution)
            if resolution
            else min(first_width, first_height)
        )
        if short_side is None:
            raise ValueError(f"Unsupported output resolution: {generation.get('resolution')}")
        if ratio >= 1:
            width, height = round(short_side * float(ratio)), short_side
        else:
            width, height = short_side, round(short_side / float(ratio))
        return cls._even(width), cls._even(height)

    @staticmethod
    def _parse_aspect_ratio(value: str) -> Fraction:
        """解析宽高比并拒绝无效比例。"""
        try:
            width, height = value.split(":", 1)
            ratio = Fraction(int(width), int(height))
        except (ValueError, ZeroDivisionError) as error:
            raise ValueError(f"Invalid output aspect ratio: {value}") from error
        if ratio <= 0:
            raise ValueError(f"Invalid output aspect ratio: {value}")
        return ratio

    @staticmethod
    def _even(value: int) -> int:
        """将尺寸调整为 FFmpeg 友好的偶数。"""
        value = max(2, value)
        return value if value % 2 == 0 else value + 1

    @staticmethod
    def _media_items(composition: dict[str, Any], media_type: str) -> list[dict[str, Any]]:
        """读取并校验指定类型的媒体对象列表。"""
        items = composition.get(media_type, [])
        if not isinstance(items, list):
            raise ValueError(f"composition.{media_type} must be an array")
        result: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict) or not str(item.get("path") or "").strip():
                raise ValueError(f"composition.{media_type} item must contain path")
            result.append(item)
        return result

    @classmethod
    async def _resolve_workspace_path(cls, workspace_dir: Path, value: Any) -> Path:
        """解析 workspace-relative 文件路径并拒绝目录穿越。"""
        relative = cls._normalize_workspace_relative_path(
            str(value or ""),
            "media.path",
            allow_root=False,
        )
        workspace_root = workspace_dir.resolve()
        path = (workspace_root / relative).resolve()
        try:
            path.relative_to(workspace_root)
        except ValueError as error:
            raise ValueError("media.path is outside workspace") from error
        if not await async_is_file(path):
            raise ValueError(f"Media file does not exist: /{relative}")
        return path

    @classmethod
    def _normalize_workspace_relative_path(
        cls,
        value: str,
        label: str,
        *,
        allow_root: bool,
    ) -> Path:
        """规范化带可选前导斜杠的 workspace-relative 路径。"""
        normalized = value.strip().replace("\\", "/")
        if (
            normalized == ""
            or "://" in normalized
            or "\x00" in normalized
            or re.match(r"^[A-Za-z]:/", normalized) is not None
        ):
            raise ValueError(f"{label} is invalid")
        normalized = normalized.lstrip("/")
        parts = tuple(part for part in normalized.split("/") if part)
        if not parts:
            if allow_root:
                return Path(".")
            raise ValueError(f"{label} is invalid")
        if any(part in {".", ".."} for part in parts):
            raise ValueError(f"{label} is invalid")
        return Path(*parts)

    @classmethod
    def _normalize_output_file_name(cls, value: str) -> str:
        """校验输出文件名只能位于目标目录并使用 MP4 格式。"""
        normalized = value.strip().replace("\\", "/")
        path = Path(normalized)
        if (
            not normalized
            or path.is_absolute()
            or len(path.parts) != 1
            or ".." in path.parts
            or path.suffix.casefold() != ".mp4"
        ):
            raise ValueError("output_file_name must be a safe .mp4 file name")
        return normalized

    @staticmethod
    def _resolve_workspace_output_path(workspace_dir: Path, relative_path: str) -> Path:
        """解析输出路径并确保最终位置仍位于 workspace。"""
        workspace_root = workspace_dir.resolve()
        output_path = (workspace_root / relative_path).resolve()
        try:
            output_path.relative_to(workspace_root)
        except ValueError as error:
            raise ValueError("Output path is outside workspace") from error
        return output_path

    @staticmethod
    def _join_relative_path(directory: Path, file_name: str) -> str:
        """拼接 workspace-relative 目录和文件名。"""
        directory_text = "" if directory == Path(".") else directory.as_posix().strip("/")
        return f"{directory_text}/{file_name}" if directory_text else file_name
