"""媒体探测端口。"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ImageMediaInfo:
    """描述图片宽高。"""

    width: int
    height: int


@dataclass(frozen=True)
class VideoMediaInfo:
    """描述视频宽高、时长和音频轨道信息。"""

    width: int
    height: int
    duration_seconds: float
    has_audio: bool


class MediaProbePort(ABC):
    """定义落盘媒体的格式和尺寸探测能力。"""

    @abstractmethod
    async def inspect_image(self, path: Path) -> ImageMediaInfo:
        """读取图片尺寸并拒绝无效文件。"""

    @abstractmethod
    async def inspect_video(self, path: Path) -> VideoMediaInfo:
        """读取视频尺寸、时长和音频轨道并拒绝无效文件。"""
