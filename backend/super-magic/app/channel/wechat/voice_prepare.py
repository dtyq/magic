"""
微信语音条发送的预处理层。

职责：
- 探测音频时长和元数据
- 把普通音频转成微信语音发送所需的格式
- 返回标准化后的 PreparedVoice 供 send_media.py 使用

转码策略（按优先级）：
  1. 输入已是 .silk 文件 → encode_type=6 (SILK) 直接发送
  2. ffmpeg 可用 → PCM → SILK 容器封装 → encode_type=6
  3. ffmpeg 不可用 → encode_type=7 (MP3) 直接发送

当前状态说明：
  - 这条链路是为未来的 outbound voice_item 保留的
  - 当前微信 bot API 不支持主动发送语音条，所以 send_media.py 不会实际调用这里
  - 如果未来微信开放语音条发送，只需恢复 _send_voice_item() 的调用路径即可启用

注意：
  SILK 封装使用 PCM + SILK 文件头，不依赖额外 Python 包。
"""
from __future__ import annotations

import asyncio
import shutil
import struct
from dataclasses import dataclass
from pathlib import Path

from agentlang.logger import get_logger
from app.channel.wechat.api import VOICE_ENCODE_TYPE_MP3, VOICE_ENCODE_TYPE_SILK

logger = get_logger(__name__)

_TARGET_SAMPLE_RATE = 16000
_PCM_SUFFIX = ".pcm_s16le.raw"
_SILK_MAGIC = b"#!SILK_V3"


@dataclass(slots=True)
class PreparedVoice:
    file_path: Path
    encode_type: int       # VOICE_ENCODE_TYPE_SILK 或 VOICE_ENCODE_TYPE_MP3
    sample_rate: int       # 采样率，单位 Hz
    playtime: int          # 时长，单位毫秒；无法探测时为 0
    cleanup_after_send: bool = False


def _is_silk(file_path: Path) -> bool:
    try:
        with open(file_path, "rb") as f:
            return f.read(9) == _SILK_MAGIC
    except OSError:
        return False


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


async def _probe_duration_ms(file_path: Path) -> int:
    """用 ffprobe 探测音频时长（毫秒），失败返回 0。"""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return 0
    try:
        proc = await asyncio.create_subprocess_exec(
            ffprobe,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        text = stdout.decode().strip()
        if text:
            return int(float(text) * 1000)
    except Exception as e:
        logger.debug(f"[VoicePrepare] ffprobe duration failed: {e}")
    return 0


def _build_silk_from_pcm(pcm_path: Path, silk_path: Path) -> bool:
    """
    把原始 PCM（s16le, mono, 16kHz）封装成 SILK 容器格式：
      SILK 文件头（#!SILK_V3）+ 帧长度前缀（int16 LE）+ PCM 帧数据
    """
    try:
        pcm_data = pcm_path.read_bytes()
        frame_size = 640  # 16kHz mono s16le：每帧 20ms = 320 samples = 640 bytes
        with open(silk_path, "wb") as f:
            f.write(_SILK_MAGIC)
            pos = 0
            while pos < len(pcm_data):
                chunk = pcm_data[pos:pos + frame_size]
                pos += frame_size
                f.write(struct.pack("<h", len(chunk)))
                f.write(chunk)
            f.write(struct.pack("<h", -1))  # 结束标记帧
        return True
    except Exception as e:
        logger.warning(f"[VoicePrepare] SILK packaging failed: {e}")
        return False


async def _convert_to_silk(src: Path, out_dir: Path) -> Path | None:
    """用 ffmpeg 把 src 转成 16kHz mono PCM，再封装成 SILK 容器。"""
    stem = src.stem
    pcm_path = out_dir / f"{stem}{_PCM_SUFFIX}"
    silk_path = out_dir / f"{stem}.silk"

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-i", str(src),
            "-ar", str(_TARGET_SAMPLE_RATE),
            "-ac", "1",
            "-f", "s16le",
            str(pcm_path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=60)
        if proc.returncode != 0 or not pcm_path.exists():
            logger.warning(f"[VoicePrepare] ffmpeg PCM conversion failed for {src}")
            return None

        if not _build_silk_from_pcm(pcm_path, silk_path):
            return None

        return silk_path
    except Exception as e:
        logger.warning(f"[VoicePrepare] convert_to_silk error: {e}")
        return None
    finally:
        if pcm_path.exists():
            pcm_path.unlink(missing_ok=True)


async def prepare_voice(src_path: Path) -> PreparedVoice:
    """
    规范化语音文件，返回 PreparedVoice。

    优先级：
    1. 已是 SILK 文件 → 直接使用
    2. ffmpeg 可用 → 转为 SILK 容器
    3. 其他 → mp3 降级
    """
    if not src_path.exists():
        raise FileNotFoundError(f"Voice source file not found: {src_path}")

    # --- 1. 已是 SILK ---
    if src_path.suffix.lower() == ".silk" or _is_silk(src_path):
        duration_ms = await _probe_duration_ms(src_path)
        logger.debug(f"[VoicePrepare] using existing SILK: {src_path} duration={duration_ms}ms")
        return PreparedVoice(
            file_path=src_path,
            encode_type=VOICE_ENCODE_TYPE_SILK,
            sample_rate=_TARGET_SAMPLE_RATE,
            playtime=duration_ms,
        )

    # --- 2. ffmpeg 可用：PCM → SILK 容器 ---
    if _ffmpeg_available():
        silk_path = await _convert_to_silk(src_path, src_path.parent)
        if silk_path and silk_path.exists():
            duration_ms = await _probe_duration_ms(src_path)
            logger.info(
                f"[VoicePrepare] converted to SILK: {silk_path} duration={duration_ms}ms"
            )
            return PreparedVoice(
                file_path=silk_path,
                encode_type=VOICE_ENCODE_TYPE_SILK,
                sample_rate=_TARGET_SAMPLE_RATE,
                playtime=duration_ms,
                cleanup_after_send=True,
            )
        logger.warning("[VoicePrepare] SILK conversion failed, falling back to mp3")

    # --- 3. 降级：直接以 mp3 encode_type 发送 ---
    duration_ms = await _probe_duration_ms(src_path)
    logger.info(f"[VoicePrepare] fallback to mp3: {src_path} duration={duration_ms}ms")
    return PreparedVoice(
        file_path=src_path,
        encode_type=VOICE_ENCODE_TYPE_MP3,
        sample_rate=_TARGET_SAMPLE_RATE,
        playtime=duration_ms,
    )
