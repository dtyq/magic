"""媒体接收的有限重试、体积限制和工作区保存。"""
from __future__ import annotations

import asyncio
import mimetypes
import random
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.models import ChannelMediaContext, ChannelMediaType
from app.i18n import i18n
from app.path_manager import PathManager
from app.utils.async_file_utils import async_stat, async_unlink, async_write_bytes

logger = get_logger(__name__)
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_ATTACHMENTS = 10
ATTEMPT_TIMEOUT = 30.0
MESSAGE_TIMEOUT = 120.0
RETRY_DELAYS = (1.0, 2.0)


class MediaDownloadError(Exception):
    """平台适配层提供状态码，错误正文不包含临时 URL 或凭证。"""

    def __init__(self, message: str, status: int = 0, retry_after: float = 0):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


@dataclass
class MediaSource:
    media_type: ChannelMediaType
    file_name: str
    mime_type: str
    fetch: Callable[[], Awaitable[bytes]]
    from_quote: bool = False


@dataclass
class PreparedMediaMessage:
    text: str
    media: list[ChannelMediaContext] = field(default_factory=list)


def _retry_after(value: str) -> float:
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            return max(0.0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return 0.0


async def read_response_bytes(response: aiohttp.ClientResponse, max_bytes: int | None = None) -> bytes:
    """逐块计数，缺少或伪造 Content-Length 也不会无限读入内存。"""
    limit = MAX_FILE_BYTES if max_bytes is None else max_bytes
    if response.status != 200:
        raise MediaDownloadError(
            "Media request failed", status=response.status,
            retry_after=_retry_after(response.headers.get("Retry-After", "")),
        )
    if response.content_length is not None and response.content_length > limit:
        raise MediaDownloadError("Attachment exceeds the size limit")
    data = bytearray()
    async for chunk in response.content.iter_chunked(64 * 1024):
        if len(data) + len(chunk) > limit:
            raise MediaDownloadError("Attachment exceeds the size limit")
        data.extend(chunk)
    return bytes(data)


def _is_retryable(error: Exception) -> bool:
    if isinstance(error, MediaDownloadError):
        return error.status in (408, 429) or 500 <= error.status < 600
    if isinstance(error, aiohttp.ClientResponseError):
        return error.status in (408, 429) or 500 <= error.status < 600
    return isinstance(error, (aiohttp.ClientConnectionError, aiohttp.ClientPayloadError, TimeoutError, OSError)) and not isinstance(error, PermissionError)


@dataclass(frozen=True)
class MediaFormat:
    mime_type: str
    suffix: str


def _media_format(source: MediaSource, data: bytes) -> MediaFormat:
    # 图片/语音事件常常没有文件名；用实际文件头确定工具可识别的扩展名。
    signatures = (
        (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
        (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
        (b"GIF8", "image/gif", ".gif"),
        (b"%PDF-", "application/pdf", ".pdf"),
        (b"OggS", "audio/ogg", ".ogg"),
        (b"fLaC", "audio/flac", ".flac"),
        (b"#!AMR", "audio/amr", ".amr"),
        (b"#!SILK", "audio/silk", ".silk"),
        (b"\x02#!SILK", "audio/silk", ".silk"),
        (b"ID3", "audio/mpeg", ".mp3"),
    )
    for prefix, mime, suffix in signatures:
        if data.startswith(prefix):
            return MediaFormat(mime, suffix)
    if data.startswith(b"RIFF"):
        if data[8:12] == b"WEBP":
            return MediaFormat("image/webp", ".webp")
        if data[8:12] == b"WAVE":
            return MediaFormat("audio/wav", ".wav")
    if data[4:8] == b"ftyp":
        if source.media_type == ChannelMediaType.VOICE:
            return MediaFormat("audio/mp4", ".m4a")
        return MediaFormat("video/mp4", ".mp4")
    mime = source.mime_type or mimetypes.guess_type(source.file_name)[0] or "application/octet-stream"
    suffix = Path(source.file_name).suffix.lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,12}", suffix):
        suffix = mimetypes.guess_extension(mime) or ".bin"
    return MediaFormat(mime, suffix)


async def download_media_source(channel: str, source: MediaSource) -> ChannelMediaContext:
    # 每个附件分配一次路径，写入重试直接覆盖同一路径；AGFS 禁止临时文件 rename。
    directory = PathManager.get_im_uploads_dir(channel)
    path: Path | None = None
    media_format: MediaFormat | None = None
    written = False
    ready = False
    data: bytes | None = None
    try:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                async def download_and_save() -> None:
                    nonlocal data, written, path, media_format
                    if data is None:
                        data = await source.fetch()
                    if len(data) > MAX_FILE_BYTES:
                        raise MediaDownloadError("Attachment exceeds the size limit")
                    if path is None:
                        media_format = _media_format(source, data)
                        path = directory / f"{uuid.uuid4().hex}{media_format.suffix}"
                    # 完整内容已在内存生成并校验，只将最终文件写入工作区。
                    written = True
                    await async_write_bytes(path, data)
                    if (await async_stat(path)).st_size != len(data):
                        raise OSError("Workspace file size does not match the download")

                await asyncio.wait_for(download_and_save(), timeout=ATTEMPT_TIMEOUT)
                assert path is not None and media_format is not None and data is not None
                ready = True
                return ChannelMediaContext(
                    relative_path=str(path.relative_to(PathManager.get_workspace_dir())),
                    media_type=source.media_type,
                    mime_type=media_format.mime_type,
                    file_name=source.file_name,
                    size_bytes=len(data),
                    from_quote=source.from_quote,
                )
            except Exception as error:
                if attempt >= len(RETRY_DELAYS) or not _is_retryable(error):
                    raise
                delay = RETRY_DELAYS[attempt]
                if isinstance(error, MediaDownloadError):
                    delay = max(delay, error.retry_after)
                logger.warning(
                    f"[IM media] retry channel={channel} attempt={attempt + 1} "
                    f"error_type={type(error).__name__}"
                )
                await asyncio.sleep(delay + random.uniform(0, delay * 0.1))
        raise AssertionError("Unreachable media retry state")
    finally:
        if written and not ready and path is not None:
            # UUID 路径仅属于本次下载；不删除其他消息或用户文件。
            try:
                await async_unlink(path)
            except OSError:
                logger.warning(f"[IM media] cleanup failed channel={channel} file={path.name}")


async def prepare_media_message(channel: str, text: str, sources: list[MediaSource]) -> PreparedMediaMessage:
    """等附件成功或明确失败后一次性派发，保留文本与已成功附件。"""
    result = PreparedMediaMessage(text=text)
    deadline = time.monotonic() + MESSAGE_TIMEOUT
    notes: list[str] = []
    for index, source in enumerate(sources):
        label = source.file_name or source.media_type.value
        if index >= MAX_ATTACHMENTS:
            notes.append(i18n.translate("im.media.additional_attachments_skipped"))
            break
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            notes.append(i18n.translate("im.media.download_timeout", filename=label))
            continue
        try:
            item = await asyncio.wait_for(download_media_source(channel, source), timeout=remaining)
            result.media.append(item)
        except Exception as error:
            # 不吞掉 CancelledError，不把平台响应或签名 URL 注入提示词和日志。
            logger.warning(f"[IM media] failed channel={channel} error_type={type(error).__name__}")
            notes.append(i18n.translate("im.media.download_failed", filename=label))
    if not text.strip() and result.media:
        notes.insert(0, i18n.translate("im.media.received_attachments"))
    result.text = "\n".join(part for part in [text, *notes] if part)
    return result
