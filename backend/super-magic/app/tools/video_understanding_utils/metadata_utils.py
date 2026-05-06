"""视频元信息提取工具：通过 ffprobe 异步获取分辨率、时长、文件大小等。"""

import asyncio
import json
from dataclasses import dataclass
from typing import List, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)

# ffprobe 探测配置
PROBE_TIMEOUT_LOCAL = 10        # 本地文件探测超时（秒）
PROBE_TIMEOUT_URL = 20          # URL 探测超时（秒）
PROBE_ANALYZE_DURATION = 2000000  # URL 分析时长上限（微秒），2 秒足以获取时长信息
PROBE_SIZE = 1000000              # URL 探测数据量上限（字节），1MB 头部数据
PROBE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


@dataclass
class VideoMetadataInfo:
    """单个视频的元信息。"""
    source: str
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None
    file_size_bytes: Optional[int] = None
    fps: Optional[float] = None
    has_audio: Optional[bool] = None

    @property
    def resolution(self) -> Optional[str]:
        if self.width and self.height:
            return f"{self.width}×{self.height}"
        return None

    @property
    def aspect_ratio(self) -> Optional[str]:
        if not self.width or not self.height:
            return None
        from math import gcd
        g = gcd(self.width, self.height)
        w, h = self.width // g, self.height // g
        common = {(16, 9): "16:9", (4, 3): "4:3", (1, 1): "1:1",
                  (21, 9): "21:9", (9, 16): "9:16", (3, 4): "3:4"}
        ratio_val = self.width / self.height
        for (rw, rh), label in common.items():
            if abs(ratio_val - rw / rh) < 0.05:
                return label
        return f"{w}:{h}"

    @property
    def duration_str(self) -> Optional[str]:
        if self.duration_seconds is None:
            return None
        secs = self.duration_seconds
        if secs < 60:
            return f"{secs:.1f}秒"
        mins = int(secs // 60)
        remaining = secs % 60
        return f"{mins}分{remaining:.0f}秒"

    @property
    def file_size_str(self) -> Optional[str]:
        if self.file_size_bytes is None:
            return None
        size = self.file_size_bytes
        if size < 1024 * 1024:
            return f"{size / 1024:.1f}KB"
        return f"{size / (1024 * 1024):.1f}MB"

    @property
    def fps_str(self) -> Optional[str]:
        if self.fps is None:
            return None
        return f"{self.fps:.0f}fps" if self.fps == int(self.fps) else f"{self.fps:.2f}fps"

    @property
    def audio_str(self) -> Optional[str]:
        if self.has_audio is None:
            return None
        return "有音频" if self.has_audio else "无音频"


async def probe_video_metadata(source: str) -> VideoMetadataInfo:
    """使用 ffprobe 获取单个视频的元信息（本地路径或 HTTP URL 均支持）。

    失败时返回只含 source 字段的空对象，不抛出异常。
    """
    info = VideoMetadataInfo(source=source)

    # base64 data URL 不走 ffprobe
    if source.startswith("data:"):
        return info

    is_url = source.startswith("http://") or source.startswith("https://")

    # 构建 ffprobe 参数
    args = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format"]
    if is_url:
        # URL 探测：设 user-agent 避免被 CDN 拒绝，限制探测数据量加速读取
        args += [
            "-user_agent", PROBE_USER_AGENT,
            "-analyzeduration", str(PROBE_ANALYZE_DURATION),
            "-probesize", str(PROBE_SIZE),
        ]
    args.append(source)

    # URL 探测需要更长超时（建立连接 + 下载头部数据）
    timeout = PROBE_TIMEOUT_URL if is_url else PROBE_TIMEOUT_LOCAL

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        data = json.loads(stdout.decode("utf-8", errors="replace"))
    except FileNotFoundError:
        logger.debug("ffprobe 未安装，跳过视频元信息提取")
        return info
    except asyncio.TimeoutError:
        logger.warning(f"ffprobe 超时 ({timeout}s): {source}")
        return info
    except Exception as e:
        logger.warning(f"ffprobe 解析失败: {source}: {e}")
        return info

    # 从 streams 中提取视频流和音频流信息
    has_audio = False
    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type")
        if codec_type == "video" and info.width is None:
            info.width = stream.get("width") or None
            info.height = stream.get("height") or None
            # 帧率：优先取 avg_frame_rate（更准确），格式为 "24/1" 或 "30000/1001"
            raw_fps = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
            if raw_fps and raw_fps != "0/0":
                try:
                    num, den = raw_fps.split("/")
                    fps_val = int(num) / int(den)
                    if fps_val > 0:
                        info.fps = fps_val
                except (ValueError, ZeroDivisionError):
                    pass
        elif codec_type == "audio":
            has_audio = True

    info.has_audio = has_audio

    # 从 format 中取时长和文件大小
    fmt = data.get("format", {})
    try:
        info.duration_seconds = float(fmt["duration"])
    except (KeyError, ValueError, TypeError):
        pass
    try:
        info.file_size_bytes = int(fmt["size"])
    except (KeyError, ValueError, TypeError):
        pass

    return info


async def probe_all_videos(sources: List[str]) -> List[VideoMetadataInfo]:
    """并发获取所有视频的元信息。"""
    tasks = [probe_video_metadata(s) for s in sources]
    return await asyncio.gather(*tasks)


def format_video_source_info(metadata_list: List[VideoMetadataInfo], videos: List[str]) -> str:
    """将视频元信息格式化为类似图片尺寸信息的文本段落。"""
    if not metadata_list:
        return ""

    parts = ["## 视频来源信息"]
    for i, (meta, source) in enumerate(zip(metadata_list, videos)):
        from app.tools.media_utils import extract_media_source_name
        name = extract_media_source_name(source)

        details = []
        if meta.resolution:
            details.append(meta.resolution)
        if meta.aspect_ratio:
            details.append(meta.aspect_ratio)
        if meta.fps_str:
            details.append(meta.fps_str)
        if meta.duration_str:
            details.append(meta.duration_str)
        if meta.file_size_str:
            details.append(meta.file_size_str)
        if meta.audio_str:
            details.append(meta.audio_str)

        detail_str = "，".join(details) if details else "元信息不可用"
        parts.append(f"[视频{i + 1}] {name}: {detail_str}")

    return "\n".join(parts)
