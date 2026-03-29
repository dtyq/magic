"""
微信 CDN 媒体下载、AES-128-ECB 解密和本地保存。

协议参考：openclaw-weixin/src/cdn/pic-decrypt.ts、media-download.ts
CDN URL：{cdn_base_url}/download?encrypted_query_param=<encoded>
AES key 编码两种情况（来自 pic-decrypt.ts parseAesKey）：
  - base64(raw 16 bytes)           → 直接用
  - base64(32-char hex string)     → 再做一次 hex decode 得到 16 bytes
"""
from __future__ import annotations

import base64
import mimetypes
import secrets
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import aiohttp
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from agentlang.logger import get_logger
from app.core.entity.message.client_message import WechatMediaContext, WechatMediaType
from app.path_manager import PathManager
from app.utils.async_file_utils import async_mkdir, async_write_bytes

logger = get_logger(__name__)

CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c"

# 媒体类型常量，与官方 types.ts MessageItemType 对齐
_ITEM_TYPE_IMAGE = 2
_ITEM_TYPE_VOICE = 3
_ITEM_TYPE_FILE = 4
_ITEM_TYPE_VIDEO = 5


def _parse_aes_key(aes_key_b64: str) -> bytes:
    """
    解析 CDN AES key（base64 编码）。

    两种编码（来自 pic-decrypt.ts parseAesKey）：
    - base64 → 16 raw bytes：直接返回
    - base64 → 32-char hex string：再 hex decode 得到 16 bytes
    """
    decoded = base64.b64decode(aes_key_b64)
    if len(decoded) == 16:
        return decoded
    if len(decoded) == 32:
        try:
            hex_str = decoded.decode("ascii")
            if all(c in "0123456789abcdefABCDEF" for c in hex_str):
                return bytes.fromhex(hex_str)
        except (UnicodeDecodeError, ValueError):
            pass
    raise ValueError(
        f"AES key must decode to 16 raw bytes or 32-char hex string, got {len(decoded)} bytes"
    )


def _decrypt_aes_ecb(ciphertext: bytes, key: bytes) -> bytes:
    """AES-128-ECB 解密（PKCS7 自动去填充）。"""
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    decryptor = cipher.decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


def _build_cdn_url(encrypt_query_param: str, cdn_base_url: str = CDN_BASE_URL) -> str:
    return f"{cdn_base_url}/download?{urlencode({'encrypted_query_param': encrypt_query_param})}"


async def _fetch_bytes(session: aiohttp.ClientSession, url: str, label: str) -> bytes:
    """从 CDN 下载原始字节（不解密）。"""
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        if resp.status != 200:
            body = await resp.text()
            raise RuntimeError(f"{label}: CDN {resp.status} {body[:100]}")
        return await resp.read()


async def _download_and_decrypt(
    session: aiohttp.ClientSession,
    encrypt_query_param: str,
    aes_key_b64: str,
    label: str,
    cdn_base_url: str = CDN_BASE_URL,
) -> bytes:
    """下载并 AES-128-ECB 解密一个 CDN 媒体文件。"""
    key = _parse_aes_key(aes_key_b64)
    url = _build_cdn_url(encrypt_query_param, cdn_base_url)
    logger.debug(f"{label}: fetching {url[:80]}")
    encrypted = await _fetch_bytes(session, url, label)
    logger.debug(f"{label}: downloaded {len(encrypted)} bytes, decrypting")
    plaintext = _decrypt_aes_ecb(encrypted, key)
    logger.debug(f"{label}: decrypted {len(plaintext)} bytes")
    return plaintext


def _make_filename(media_type: str, ext: str) -> str:
    """生成带时间戳和随机后缀的文件名，格式：<type>_yyyyMMdd_HHmmss_<6hex>.<ext>"""
    ts = time.strftime("%Y%m%d_%H%M%S")
    rand = secrets.token_hex(3)
    return f"{media_type}_{ts}_{rand}.{ext}"


async def _save_media(data: bytes, user_id: str, filename: str) -> Path:
    """
    保存媒体文件到 .workspace/uploads/im-channels/wechat/<user_id>/<filename>。
    返回绝对路径。
    """
    user_dir = PathManager.get_wechat_im_uploads_dir() / user_id
    await async_mkdir(user_dir, parents=True, exist_ok=True)
    file_path = user_dir / filename
    await async_write_bytes(file_path, data)
    return file_path


def _relative_path(abs_path: Path) -> str:
    """返回相对于 workspace 根目录的路径字符串，供模型引用。"""
    workspace_dir = PathManager.get_workspace_dir()
    try:
        return str(abs_path.relative_to(workspace_dir))
    except ValueError:
        return str(abs_path)


def _build_media_context(
    *,
    abs_path: Path,
    media_type: WechatMediaType,
    mime_type: str,
    from_quote: bool,
) -> WechatMediaContext:
    return WechatMediaContext(
        relative_path=_relative_path(abs_path),
        absolute_path=str(abs_path),
        media_type=media_type,
        mime_type=mime_type,
        from_quote=from_quote,
    )


async def download_message_media(
    session: aiohttp.ClientSession,
    item_list: list[dict[str, Any]],
    user_id: str,
    cdn_base_url: str = CDN_BASE_URL,
) -> WechatMediaContext | None:
    """
    从消息 item_list 中找到第一个可下载的媒体，下载解密后保存到工作区。
    优先级：IMAGE > VIDEO > FILE > VOICE（无转文字）。

    当前消息没有媒体时，会回退检查引用消息里的媒体。
    """
    if not item_list:
        return None

    candidate = _find_media_item(item_list)
    from_quote = False
    if candidate is None:
        candidate = _find_media_item(_extract_ref_message_items(item_list))
        from_quote = candidate is not None
    if candidate is None:
        return None

    item_type = candidate.get("type")
    try:
        if item_type == _ITEM_TYPE_IMAGE:
            return await _handle_image(session, candidate, user_id, cdn_base_url, from_quote)
        if item_type == _ITEM_TYPE_VIDEO:
            return await _handle_video(session, candidate, user_id, cdn_base_url, from_quote)
        if item_type == _ITEM_TYPE_FILE:
            return await _handle_file(session, candidate, user_id, cdn_base_url, from_quote)
        if item_type == _ITEM_TYPE_VOICE:
            return await _handle_voice(session, candidate, user_id, cdn_base_url, from_quote)
    except Exception as e:
        logger.error(f"[wechat media] download failed type={item_type} user={user_id}: {e}")

    return None


def _extract_ref_message_items(item_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ref_items: list[dict[str, Any]] = []
    for item in item_list:
        ref_msg = item.get("ref_msg") or {}
        ref_item = ref_msg.get("message_item")
        if isinstance(ref_item, dict):
            ref_items.append(ref_item)
    return ref_items


def _find_media_item(item_list: list[dict[str, Any]]) -> dict[str, Any] | None:
    """按 IMAGE > VIDEO > FILE > VOICE(无转文字) 优先级找首个可下载媒体 item。"""

    def has_cdn(item: dict[str, Any], sub_key: str) -> bool:
        sub = item.get(sub_key) or {}
        media = sub.get("media") or {}
        return bool(media.get("encrypt_query_param"))

    for item in item_list:
        if item.get("type") == _ITEM_TYPE_IMAGE and has_cdn(item, "image_item"):
            return item
    for item in item_list:
        if item.get("type") == _ITEM_TYPE_VIDEO and has_cdn(item, "video_item"):
            return item
    for item in item_list:
        if item.get("type") == _ITEM_TYPE_FILE and has_cdn(item, "file_item"):
            return item
    for item in item_list:
        if item.get("type") == _ITEM_TYPE_VOICE:
            voice = item.get("voice_item") or {}
            if not voice.get("text") and has_cdn(item, "voice_item"):
                return item
    return None


def _guess_mime_type(filename: str, fallback: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


async def _handle_image(
    session: aiohttp.ClientSession,
    item: dict[str, Any],
    user_id: str,
    cdn_base_url: str,
    from_quote: bool,
) -> WechatMediaContext | None:
    img = item.get("image_item") or {}
    media = img.get("media") or {}
    eqp = media.get("encrypt_query_param")
    if not eqp:
        return None

    raw_aeskey: str | None = img.get("aeskey")
    if raw_aeskey:
        aes_key_b64 = base64.b64encode(bytes.fromhex(raw_aeskey)).decode()
    else:
        aes_key_b64 = media.get("aes_key")

    if not aes_key_b64:
        data = await _fetch_bytes(session, _build_cdn_url(eqp, cdn_base_url), "image-plain")
    else:
        data = await _download_and_decrypt(session, eqp, aes_key_b64, "image", cdn_base_url)

    filename = _make_filename("image", "jpg")
    abs_path = await _save_media(data, user_id, filename)
    return _build_media_context(
        abs_path=abs_path,
        media_type=WechatMediaType.IMAGE,
        mime_type=_guess_mime_type(filename, "image/jpeg"),
        from_quote=from_quote,
    )


async def _handle_voice(
    session: aiohttp.ClientSession,
    item: dict[str, Any],
    user_id: str,
    cdn_base_url: str,
    from_quote: bool,
) -> WechatMediaContext | None:
    voice = item.get("voice_item") or {}
    media = voice.get("media") or {}
    eqp = media.get("encrypt_query_param")
    aes_key_b64 = media.get("aes_key")
    if not eqp or not aes_key_b64:
        return None

    # 当前项目暂不额外引入 SILK -> WAV 转码依赖，先稳定保存原始 SILK。
    data = await _download_and_decrypt(session, eqp, aes_key_b64, "voice", cdn_base_url)
    filename = _make_filename("voice", "silk")
    abs_path = await _save_media(data, user_id, filename)
    return _build_media_context(
        abs_path=abs_path,
        media_type=WechatMediaType.VOICE,
        mime_type="audio/silk",
        from_quote=from_quote,
    )


async def _handle_file(
    session: aiohttp.ClientSession,
    item: dict[str, Any],
    user_id: str,
    cdn_base_url: str,
    from_quote: bool,
) -> WechatMediaContext | None:
    file_item = item.get("file_item") or {}
    media = file_item.get("media") or {}
    eqp = media.get("encrypt_query_param")
    aes_key_b64 = media.get("aes_key")
    if not eqp or not aes_key_b64:
        return None

    data = await _download_and_decrypt(session, eqp, aes_key_b64, "file", cdn_base_url)

    original_name = (file_item.get("file_name") or "").strip()
    if original_name:
        original_path = Path(original_name)
        ts = time.strftime("%Y%m%d_%H%M%S")
        rand = secrets.token_hex(3)
        filename = (
            f"{original_path.stem}_{ts}_{rand}{original_path.suffix}"
            if original_path.suffix
            else f"{original_path.stem}_{ts}_{rand}"
        )
    else:
        filename = _make_filename("file", "bin")

    abs_path = await _save_media(data, user_id, filename)
    return _build_media_context(
        abs_path=abs_path,
        media_type=WechatMediaType.FILE,
        mime_type=_guess_mime_type(filename, "application/octet-stream"),
        from_quote=from_quote,
    )


async def _handle_video(
    session: aiohttp.ClientSession,
    item: dict[str, Any],
    user_id: str,
    cdn_base_url: str,
    from_quote: bool,
) -> WechatMediaContext | None:
    video = item.get("video_item") or {}
    media = video.get("media") or {}
    eqp = media.get("encrypt_query_param")
    aes_key_b64 = media.get("aes_key")
    if not eqp or not aes_key_b64:
        return None

    data = await _download_and_decrypt(session, eqp, aes_key_b64, "video", cdn_base_url)
    filename = _make_filename("video", "mp4")
    abs_path = await _save_media(data, user_id, filename)
    return _build_media_context(
        abs_path=abs_path,
        media_type=WechatMediaType.VIDEO,
        mime_type=_guess_mime_type(filename, "video/mp4"),
        from_quote=from_quote,
    )
