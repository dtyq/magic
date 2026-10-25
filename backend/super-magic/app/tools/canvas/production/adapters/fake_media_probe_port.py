"""Fake 媒体探测端口。"""

from pathlib import Path

from app.tools.canvas.production.ports.media_probe_port import ImageMediaInfo, MediaProbePort, VideoMediaInfo
from app.utils.async_file_utils import async_exists, async_stat


class FakeMediaProbePort(MediaProbePort):
    """返回固定 mock 媒体信息。"""

    async def inspect_image(self, path: Path) -> ImageMediaInfo:
        """校验 mock 文件存在并返回尺寸。"""
        if not await async_exists(path) or (await async_stat(path)).st_size <= 0:
            raise ValueError("Image file does not exist or is empty.")
        return ImageMediaInfo(800, 600)

    async def inspect_video(self, path: Path) -> VideoMediaInfo:
        """校验 mock 文件存在并返回固定视频信息。"""
        if not await async_exists(path) or (await async_stat(path)).st_size <= 0:
            raise ValueError("Video file does not exist or is empty.")
        return VideoMediaInfo(1920, 1080, 5.0, False)
