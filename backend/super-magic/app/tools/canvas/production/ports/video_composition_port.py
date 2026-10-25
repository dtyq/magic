"""视频合成外部端口。"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class VideoCompositionRequest:
    """描述一次与 Canvas 领域解耦的视频合成请求。"""

    video_paths: tuple[Path, ...]
    audio_path: Path | None
    output_path: Path
    width: int
    height: int
    audio_policy: str = "preserve"


@dataclass(frozen=True)
class VideoCompositionResult:
    """描述已完成视频文件的媒体事实。"""

    output_path: Path
    width: int
    height: int
    duration_seconds: float
    has_audio: bool


class VideoCompositionPort(ABC):
    """定义视频合成和媒体探测能力。"""

    @abstractmethod
    async def compose(
        self,
        request: VideoCompositionRequest,
        interruption_event: asyncio.Event | None = None,
    ) -> VideoCompositionResult:
        """合成并校验目标视频。"""

    @abstractmethod
    async def inspect_video(
        self,
        video_path: Path,
        interruption_event: asyncio.Event | None = None,
    ) -> tuple[int, int, float, bool]:
        """返回视频尺寸、时长和音频状态。"""
