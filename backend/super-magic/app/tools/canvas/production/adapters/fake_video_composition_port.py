"""Fake 视频合成端口。"""

from pathlib import Path

from app.tools.canvas.production.ports.video_composition_port import (
    VideoCompositionPort,
    VideoCompositionRequest,
    VideoCompositionResult,
)
from app.utils.async_file_utils import async_exists, async_stat, async_write_bytes


class FakeVideoCompositionPort(VideoCompositionPort):
    """使用 mock 文件完成本地调试，不启动 FFmpeg。"""

    def __init__(self, duration_seconds: float = 1.0) -> None:
        """保存 mock 输出时长。"""
        self._duration_seconds = duration_seconds

    async def compose(self, request: VideoCompositionRequest, interruption_event=None) -> VideoCompositionResult:
        """写入最小非空 mock 文件并返回请求尺寸。"""
        await async_write_bytes(request.output_path, b"mock-canvas-video")
        return VideoCompositionResult(
            request.output_path,
            request.width,
            request.height,
            self._duration_seconds,
            request.audio_policy == "preserve" and request.audio_path is not None,
        )

    async def inspect_video(self, video_path: Path, interruption_event=None) -> tuple[int, int, float, bool]:
        """返回固定 mock 媒体信息。"""
        if not await async_exists(video_path) or (await async_stat(video_path)).st_size <= 0:
            raise ValueError(f"Video file does not exist or is empty: {video_path}")
        return 1280, 720, self._duration_seconds, False
