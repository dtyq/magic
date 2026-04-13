"""
微信媒体上传与发送。

负责：
- 解析本地路径 / file:// / 远程 URL
- AES-128-ECB 加密
- 调 getuploadurl
- 上传到微信 CDN
- 按媒体意图（kind）构造 image / video / file / voice 消息并发送

当前状态说明：
- image / video / audio / file 已支持出站发送
- voice 发送链路（_send_voice_item）已保留，便于未来直接启用
- 但当前微信 bot API 不支持主动发送 voice_item，所以 <voice> 会自动降级成音频附件

调用入口：
  send_media_item()  — 接受结构化 MediaItem，按 kind 分发（推荐）
  send_media_file()  — 接受裸 media_target 字符串，按 MIME 兜底分发（向后兼容）
"""
from __future__ import annotations

import base64
import hashlib
import mimetypes
import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import aiohttp
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from agentlang.logger import get_logger
from app.channel.wechat import api
from app.channel.wechat.reply_media_parser import MediaItem, MediaKind
from app.channel.wechat.voice_prepare import PreparedVoice, prepare_voice
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_exists,
    async_mkdir,
    async_read_bytes,
    async_unlink,
    async_write_bytes,
)

logger = get_logger(__name__)

CDN_UPLOAD_MAX_RETRIES = 3
_ENCODE_URI_COMPONENT_SAFE_CHARS = "-_.!~*'()"


@dataclass(slots=True)
class PreparedWechatMedia:
    file_path: Path
    file_name: str
    mime_type: str
    cleanup_after_send: bool = False


@dataclass(slots=True)
class UploadedWechatMedia:
    filekey: str
    download_encrypted_query_param: str
    aeskey_hex: str
    file_size: int
    file_size_ciphertext: int


# ---------------------------------------------------------------------------
# 公开入口
# ---------------------------------------------------------------------------

async def send_media_item(
    http_session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    media_item: MediaItem,
    cdn_base_url: str,
    caption_text: str = "",
) -> None:
    """
    按 MediaItem.kind 分发到对应的发送逻辑。
    caption_text 先于媒体作为独立文本消息发送（仅一次，在第一条媒体前）。

    注意：voice 语法当前不会真的发 voice_item，而是降级为音频附件。
    未来如果微信开放 outbound voice_item，只需恢复到 _send_voice_item() 分支。
    """
    kind = media_item.kind

    if kind == "voice":
        # 微信 bot ilink API 不支持主动发送 voice_item（服务端静默丢弃）
        # 降级为文件附件，保证音频内容能送达用户
        logger.info(
            f"[WechatSendMedia] voice tag detected, sending as file attachment "
            f"(WeChat bot API does not support outbound voice_item): src={media_item.src}"
        )
        degraded = MediaItem(kind="audio", src=media_item.src, filename=media_item.filename)
        await _send_file_based_item(
            http_session,
            base_url=base_url,
            token=token,
            to_user_id=to_user_id,
            context_token=context_token,
            media_item=degraded,
            cdn_base_url=cdn_base_url,
            caption_text=caption_text,
        )
    else:
        await _send_file_based_item(
            http_session,
            base_url=base_url,
            token=token,
            to_user_id=to_user_id,
            context_token=context_token,
            media_item=media_item,
            cdn_base_url=cdn_base_url,
            caption_text=caption_text,
        )


async def send_media_file(
    http_session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    media_target: str,
    cdn_base_url: str,
    caption_text: str = "",
) -> None:
    """
    向后兼容入口：接受裸 URL/路径字符串，按 MIME 猜类型后分发。
    新代码应优先使用 send_media_item()。
    """
    # 推断 kind：按 MIME 猜，不能区分 audio/file 与 voice，统一降级成 audio（附件）
    mime_type = _guess_mime(media_target)
    if mime_type.startswith("image/"):
        kind: MediaKind = "image"
    elif mime_type.startswith("video/"):
        kind = "video"
    elif mime_type.startswith("audio/"):
        kind = "audio"
    else:
        kind = "file"

    item = MediaItem(kind=kind, src=media_target)
    await send_media_item(
        http_session,
        base_url=base_url,
        token=token,
        to_user_id=to_user_id,
        context_token=context_token,
        media_item=item,
        cdn_base_url=cdn_base_url,
        caption_text=caption_text,
    )


# ---------------------------------------------------------------------------
# 内部：文件类媒体（image / video / audio / file）
# ---------------------------------------------------------------------------

async def _send_file_based_item(
    http_session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    media_item: MediaItem,
    cdn_base_url: str,
    caption_text: str,
) -> None:
    prepared = await _prepare_media_file(http_session, media_item)
    try:
        uploaded = await _upload_media_file(
            http_session,
            file_path=prepared.file_path,
            to_user_id=to_user_id,
            base_url=base_url,
            token=token,
            cdn_base_url=cdn_base_url,
            mime_type=prepared.mime_type,
            kind=media_item.kind,
        )

        if caption_text.strip():
            await api.send_message(
                http_session,
                base_url=base_url,
                token=token,
                to_user_id=to_user_id,
                context_token=context_token,
                text=api.markdown_to_plain_text(caption_text),
            )

        await api.send_message_items(
            http_session,
            base_url=base_url,
            token=token,
            to_user_id=to_user_id,
            context_token=context_token,
            item_list=[
                _build_media_item(
                    kind=media_item.kind,
                    mime_type=prepared.mime_type,
                    file_name=_resolve_filename(media_item, prepared),
                    uploaded=uploaded,
                )
            ],
        )
    finally:
        if prepared.cleanup_after_send:
            await async_unlink(prepared.file_path)


async def _send_voice_item(
    http_session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    media_item: MediaItem,
    cdn_base_url: str,
    caption_text: str,
) -> None:
    """发送微信语音条（voice_item）。先规范化音频，再上传，再构造 voice_item 发送。"""
    src_path = await _resolve_src_path(http_session, media_item.src)
    cleanup_src = src_path[1]
    src_path = src_path[0]

    prepared_voice: PreparedVoice | None = None
    try:
        prepared_voice = await prepare_voice(src_path)

        uploaded = await _upload_raw_file(
            http_session,
            file_path=prepared_voice.file_path,
            to_user_id=to_user_id,
            base_url=base_url,
            token=token,
            cdn_base_url=cdn_base_url,
            media_type=api.UPLOAD_MEDIA_TYPE_VOICE,
        )

        if caption_text.strip():
            await api.send_message(
                http_session,
                base_url=base_url,
                token=token,
                to_user_id=to_user_id,
                context_token=context_token,
                text=api.markdown_to_plain_text(caption_text),
            )

        aes_key_base64 = base64.b64encode(uploaded.aeskey_hex.encode("ascii")).decode()
        voice_msg_item = api.build_voice_message_item(
            encrypt_query_param=uploaded.download_encrypted_query_param,
            aes_key_base64=aes_key_base64,
            voice_size=uploaded.file_size_ciphertext,
            encode_type=prepared_voice.encode_type,
            sample_rate=prepared_voice.sample_rate,
            playtime=prepared_voice.playtime,
        )

        await api.send_message_items(
            http_session,
            base_url=base_url,
            token=token,
            to_user_id=to_user_id,
            context_token=context_token,
            item_list=[voice_msg_item],
        )
        logger.info(
            f"[WechatSendMedia] voice sent to={to_user_id} "
            f"encode={prepared_voice.encode_type} playtime={prepared_voice.playtime}ms"
        )
    finally:
        if prepared_voice and prepared_voice.cleanup_after_send:
            await async_unlink(prepared_voice.file_path)
        if cleanup_src:
            await async_unlink(src_path)


# ---------------------------------------------------------------------------
# 文件准备
# ---------------------------------------------------------------------------

async def _prepare_media_file(
    http_session: aiohttp.ClientSession,
    media_item: MediaItem,
) -> PreparedWechatMedia:
    src = media_item.src
    path, cleanup = await _resolve_src_path(http_session, src)
    mime_type, _ = mimetypes.guess_type(str(path))
    return PreparedWechatMedia(
        file_path=path,
        file_name=path.name,
        mime_type=mime_type or "application/octet-stream",
        cleanup_after_send=cleanup,
    )


async def _resolve_src_path(
    http_session: aiohttp.ClientSession,
    src: str,
) -> tuple[Path, bool]:
    """
    把 src（绝对路径 / 相对路径 / file:// / http(s)://）解析成本地 Path。
    返回 (path, cleanup_needed)；cleanup_needed=True 表示临时下载文件，用完需删除。
    """
    if src.startswith("file://"):
        return Path(unquote(urlparse(src).path)), False

    if src.startswith(("https://", "http://")):
        return await _download_remote(http_session, src), True

    file_path = Path(src)
    if not file_path.is_absolute():
        file_path = PathManager.get_workspace_dir() / file_path
    if not await async_exists(file_path):
        raise FileNotFoundError(f"Media file does not exist: {file_path}")
    return file_path, False


async def _download_remote(
    http_session: aiohttp.ClientSession,
    url: str,
) -> Path:
    async with http_session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
        if resp.status >= 400:
            body = await resp.text()
            raise RuntimeError(f"Remote media download failed: {resp.status} {body[:200]}")
        data = await resp.read()
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip()

    temp_dir = PathManager.get_wechat_im_uploads_dir() / "_outbound_remote"
    await async_mkdir(temp_dir, parents=True, exist_ok=True)
    ext = _guess_extension(content_type, url)
    file_name = f"remote_{time.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}{ext}"
    file_path = temp_dir / file_name
    await async_write_bytes(file_path, data)
    return file_path


def _guess_mime(src: str) -> str:
    mime, _ = mimetypes.guess_type(urlparse(src).path)
    return mime or "application/octet-stream"


def _guess_extension(content_type: str, url: str) -> str:
    ext = mimetypes.guess_extension(content_type) if content_type else None
    if ext:
        return ext
    url_path = Path(urlparse(url).path)
    if url_path.suffix:
        return url_path.suffix
    return ".bin"


def _resolve_filename(media_item: MediaItem, prepared: PreparedWechatMedia) -> str:
    """优先使用 MediaItem.filename，回退到文件路径推断。"""
    return media_item.filename or prepared.file_name


# ---------------------------------------------------------------------------
# 上传（通用 AES + CDN 链路）
# ---------------------------------------------------------------------------

async def _upload_media_file(
    http_session: aiohttp.ClientSession,
    *,
    file_path: Path,
    to_user_id: str,
    base_url: str,
    token: str,
    cdn_base_url: str,
    mime_type: str,
    kind: MediaKind,
) -> UploadedWechatMedia:
    media_type = _resolve_upload_media_type(kind, mime_type)
    return await _upload_raw_file(
        http_session,
        file_path=file_path,
        to_user_id=to_user_id,
        base_url=base_url,
        token=token,
        cdn_base_url=cdn_base_url,
        media_type=media_type,
    )


async def _upload_raw_file(
    http_session: aiohttp.ClientSession,
    *,
    file_path: Path,
    to_user_id: str,
    base_url: str,
    token: str,
    cdn_base_url: str,
    media_type: int,
) -> UploadedWechatMedia:
    plaintext = await async_read_bytes(file_path)
    filekey = secrets.token_hex(16)
    aeskey = secrets.token_bytes(16)
    ciphertext = _encrypt_aes_ecb(plaintext, aeskey)

    upload_resp = await api.get_upload_url(
        http_session,
        base_url=base_url,
        token=token,
        filekey=filekey,
        media_type=media_type,
        to_user_id=to_user_id,
        rawsize=len(plaintext),
        rawfilemd5=hashlib.md5(plaintext).hexdigest(),
        filesize=len(ciphertext),
        no_need_thumb=True,
        aeskey=aeskey.hex(),
    )
    upload_param = str(upload_resp.get("upload_param") or "")
    if not upload_param:
        raise RuntimeError(f"get_upload_url returned no upload_param: {upload_resp}")

    download_encrypted_query_param = await _upload_ciphertext_to_cdn(
        http_session,
        ciphertext=ciphertext,
        upload_param=upload_param,
        filekey=filekey,
        cdn_base_url=cdn_base_url,
    )
    return UploadedWechatMedia(
        filekey=filekey,
        download_encrypted_query_param=download_encrypted_query_param,
        aeskey_hex=aeskey.hex(),
        file_size=len(plaintext),
        file_size_ciphertext=len(ciphertext),
    )


def _resolve_upload_media_type(kind: MediaKind, mime_type: str) -> int:
    """
    按 kind 决定上传类型；MIME 只做兜底辅助。
    voice 走专门的 _send_voice_item 入口，不会进入此函数。
    """
    if kind == "image" or mime_type.startswith("image/"):
        return api.UPLOAD_MEDIA_TYPE_IMAGE
    if kind == "video" or mime_type.startswith("video/"):
        return api.UPLOAD_MEDIA_TYPE_VIDEO
    # audio / file 均发为 FILE（用户收到附件）
    return api.UPLOAD_MEDIA_TYPE_FILE


def _encrypt_aes_ecb(plaintext: bytes, key: bytes) -> bytes:
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    encryptor = cipher.encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def _encode_uri_component(value: str) -> str:
    return quote(value, safe=_ENCODE_URI_COMPONENT_SAFE_CHARS)


async def _upload_ciphertext_to_cdn(
    http_session: aiohttp.ClientSession,
    *,
    ciphertext: bytes,
    upload_param: str,
    filekey: str,
    cdn_base_url: str,
) -> str:
    cdn_url = (
        f"{cdn_base_url}/upload?encrypted_query_param={_encode_uri_component(upload_param)}"
        f"&filekey={_encode_uri_component(filekey)}"
    )

    last_error: Exception | None = None
    for attempt in range(1, CDN_UPLOAD_MAX_RETRIES + 1):
        try:
            async with http_session.post(
                cdn_url,
                data=ciphertext,
                headers={"Content-Type": "application/octet-stream"},
                timeout=aiohttp.ClientTimeout(total=60),
            ) as resp:
                if 400 <= resp.status < 500:
                    err_msg = resp.headers.get("x-error-message") or await resp.text()
                    raise RuntimeError(f"CDN upload client error {resp.status}: {err_msg}")
                if resp.status != 200:
                    err_msg = resp.headers.get("x-error-message") or f"status {resp.status}"
                    raise RuntimeError(f"CDN upload server error: {err_msg}")

                encrypted_param = resp.headers.get("x-encrypted-param")
                if not encrypted_param:
                    raise RuntimeError("CDN upload response missing x-encrypted-param header")
                return encrypted_param
        except Exception as e:
            last_error = e
            logger.warning(
                f"[WechatSendMedia] CDN upload attempt {attempt}/{CDN_UPLOAD_MAX_RETRIES} failed: {e}"
            )
            if attempt == CDN_UPLOAD_MAX_RETRIES:
                break

    raise last_error or RuntimeError("CDN upload failed")


# ---------------------------------------------------------------------------
# 媒体消息体构造（image / video / file）
# ---------------------------------------------------------------------------

def _build_media_item(
    *,
    kind: MediaKind,
    mime_type: str,
    file_name: str,
    uploaded: UploadedWechatMedia,
) -> dict:
    aes_key_base64 = base64.b64encode(uploaded.aeskey_hex.encode("ascii")).decode()

    if kind == "image" or mime_type.startswith("image/"):
        return api.build_image_message_item(
            encrypt_query_param=uploaded.download_encrypted_query_param,
            aes_key_base64=aes_key_base64,
            mid_size=uploaded.file_size_ciphertext,
        )
    if kind == "video" or mime_type.startswith("video/"):
        return api.build_video_message_item(
            encrypt_query_param=uploaded.download_encrypted_query_param,
            aes_key_base64=aes_key_base64,
            video_size=uploaded.file_size_ciphertext,
        )
    # audio / file 均发为 file_item
    return api.build_file_message_item(
        encrypt_query_param=uploaded.download_encrypted_query_param,
        aes_key_base64=aes_key_base64,
        file_name=file_name,
        file_size=uploaded.file_size,
    )
