"""文件媒体探测适配器。"""

import asyncio
import json
from io import BytesIO
from pathlib import Path

from app.tools.canvas.production.ports.media_probe_port import ImageMediaInfo, MediaProbePort, VideoMediaInfo
from app.utils.async_file_utils import async_exists, async_read_bytes, async_stat, async_which

_FFPROBE_TIMEOUT_SECONDS = 10


class FileMediaProbePort(MediaProbePort):
    """使用 Pillow 和 FFprobe 读取媒体事实。"""

    async def inspect_image(self, path: Path) -> ImageMediaInfo:
        """在同步线程中读取格式和尺寸。"""
        if not await async_exists(path) or (await async_stat(path)).st_size <= 0:
            raise ValueError("Image file does not exist or is empty.")

        try:
            image_bytes = await async_read_bytes(path)
            width, height = await asyncio.to_thread(self._read_size, image_bytes)
        except Exception as error:
            raise ValueError("Downloaded file is not a supported image.") from error
        if width <= 0 or height <= 0:
            raise ValueError("Image dimensions are invalid.")
        return ImageMediaInfo(width, height)

    @staticmethod
    def _read_size(image_bytes: bytes) -> tuple[int, int]:
        """在线程中从内存字节读取 Pillow 图片尺寸。"""
        from PIL import Image

        with Image.open(BytesIO(image_bytes)) as image:
            return image.size

    async def inspect_video(self, path: Path) -> VideoMediaInfo:
        """使用 FFprobe 读取视频尺寸、时长和音频轨道。"""
        if not await async_exists(path) or (await async_stat(path)).st_size <= 0:
            raise ValueError("Video file does not exist or is empty.")
        if await async_which("ffprobe") is None:
            raise ValueError("FFprobe is not available.")

        process = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=_FFPROBE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as error:
            process.kill()
            await process.communicate()
            raise ValueError("FFprobe timed out.") from error
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="replace").strip()
            raise ValueError(f"FFprobe failed: {message[:300]}")
        try:
            payload = json.loads(stdout.decode("utf-8", errors="replace"))
            return self._read_video_info(payload)
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise ValueError("FFprobe returned invalid video metadata.") from error

    @staticmethod
    def _read_video_info(payload: object) -> VideoMediaInfo:
        """从 FFprobe JSON 中提取有效的视频媒体信息。"""
        if not isinstance(payload, dict):
            raise ValueError("FFprobe metadata must be an object.")
        streams = payload.get("streams")
        if not isinstance(streams, list):
            raise ValueError("FFprobe metadata has no streams.")
        video = next((item for item in streams if isinstance(item, dict) and item.get("codec_type") == "video"), None)
        if not isinstance(video, dict):
            raise ValueError("Video stream is missing.")
        try:
            width = int(video.get("width") or 0)
            height = int(video.get("height") or 0)
            duration = float((payload.get("format") or {}).get("duration") or 0)
        except (TypeError, ValueError, AttributeError) as error:
            raise ValueError("Video dimensions or duration are invalid.") from error
        if width <= 0 or height <= 0:
            raise ValueError("Video dimensions are invalid.")
        return VideoMediaInfo(
            width=width,
            height=height,
            duration_seconds=max(duration, 0.0),
            has_audio=any(isinstance(item, dict) and item.get("codec_type") == "audio" for item in streams),
        )
