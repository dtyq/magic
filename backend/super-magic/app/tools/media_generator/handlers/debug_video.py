"""本地视频生成 Handler。"""

import asyncio
from pathlib import Path

from app.tools.media_generator.video_base import (
    BaseVideoGeneratorHandler,
    VideoGenerationRequest,
    VideoGenerationResponse,
)
from app.utils.async_file_utils import async_exists, async_mkdir


class DebugVideoGeneratorHandler(BaseVideoGeneratorHandler):
    """使用固定本地短片模拟视频生成。"""

    _ASSET_PATH = Path(__file__).resolve().parents[1] / "assets" / "mock_media" / "mock-video.mp4"

    @property
    def name(self) -> str:
        """返回 Handler 名称。"""
        return "debug"

    def is_available(self) -> bool:
        """判断本地模拟素材是否存在。"""
        return self._ASSET_PATH.is_file()

    async def generate(self, request: VideoGenerationRequest) -> VideoGenerationResponse:
        """生成指定尺寸和时长的本地 MP4。"""
        if not await async_exists(self._ASSET_PATH):
            raise FileNotFoundError(f"Mock video asset is missing: {self._ASSET_PATH.name}")
        await async_mkdir(request.output_path.parent, parents=True, exist_ok=True)
        scale_filter = (
            f"scale={request.width}:{request.height}:force_original_aspect_ratio=decrease,"
            f"pad={request.width}:{request.height}:(ow-iw)/2:(oh-ih)/2:color=black"
        )
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-stream_loop",
            "-1",
            "-i",
            str(self._ASSET_PATH),
            "-t",
            str(request.duration_seconds),
            "-vf",
            scale_filter,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(request.output_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        communicate_task = asyncio.create_task(process.communicate())
        interrupt_task = (
            asyncio.create_task(request.interruption_event.wait())
            if request.interruption_event is not None
            else None
        )
        try:
            if interrupt_task is not None:
                completed, _ = await asyncio.wait(
                    {communicate_task, interrupt_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if interrupt_task in completed:
                    process.terminate()
                    await process.wait()
                    communicate_task.cancel()
                    raise asyncio.CancelledError
            _, stderr = await communicate_task
        finally:
            if interrupt_task is not None:
                interrupt_task.cancel()
        if process.returncode != 0:
            error_text = stderr.decode("utf-8", errors="replace")[-800:]
            raise RuntimeError(f"Mock video generation failed: {error_text}")
        return VideoGenerationResponse(
            status="completed",
            completed=True,
            src=request.relative_output_path,
            width=request.width,
            height=request.height,
            metadata={"mock_generation": True, "handler": self.name},
        )
