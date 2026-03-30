"""
微信媒体上传与发送。

负责：
- 解析本地路径 / file:// / 远程 URL
- AES-128-ECB 加密
- 调 getuploadurl
- 上传到微信 CDN
- 构造图片 / 视频 / 文件消息并发送
"""
from __future__ import annotations

import base64
import hashlib
import mimetypes
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
    prepared = await _prepare_media_file(http_session, media_target)
    try:
        uploaded = await _upload_media_file(
            http_session,
            file_path=prepared.file_path,
            to_user_id=to_user_id,
            base_url=base_url,
            token=token,
            cdn_base_url=cdn_base_url,
            mime_type=prepared.mime_type,
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
                    mime_type=prepared.mime_type,
                    file_name=prepared.file_name,
                    uploaded=uploaded,
                )
            ],
        )
    finally:
        if prepared.cleanup_after_send:
            await async_unlink(prepared.file_path)


async def _prepare_media_file(
    http_session: aiohttp.ClientSession,
    media_target: str,
) -> PreparedWechatMedia:
    if media_target.startswith("file://"):
        file_path = Path(unquote(urlparse(media_target).path))
        return await _build_local_media(file_path)

    if media_target.startswith(("https://", "http://")):
        return await _download_remote_media(http_session, media_target)

    file_path = Path(media_target)
    if not file_path.is_absolute():
        file_path = PathManager.get_workspace_dir() / file_path
    return await _build_local_media(file_path)


async def _build_local_media(file_path: Path) -> PreparedWechatMedia:
    if not await async_exists(file_path):
        raise FileNotFoundError(f"Media file does not exist: {file_path}")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    return PreparedWechatMedia(
        file_path=file_path,
        file_name=file_path.name,
        mime_type=mime_type or "application/octet-stream",
    )


async def _download_remote_media(
    http_session: aiohttp.ClientSession,
    media_target: str,
) -> PreparedWechatMedia:
    async with http_session.get(media_target, timeout=aiohttp.ClientTimeout(total=60)) as resp:
        if resp.status >= 400:
            body = await resp.text()
            raise RuntimeError(f"Remote media download failed: {resp.status} {body[:200]}")
        data = await resp.read()
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip()

    temp_dir = PathManager.get_wechat_im_uploads_dir() / "_outbound_remote"
    await async_mkdir(temp_dir, parents=True, exist_ok=True)
    ext = _guess_extension(content_type, media_target)
    file_name = f"remote_{time.strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(3)}{ext}"
    file_path = temp_dir / file_name
    await async_write_bytes(file_path, data)
    return PreparedWechatMedia(
        file_path=file_path,
        file_name=file_name,
        mime_type=content_type or mimetypes.guess_type(media_target)[0] or "application/octet-stream",
        cleanup_after_send=True,
    )


def _guess_extension(content_type: str, media_target: str) -> str:
    ext = mimetypes.guess_extension(content_type) if content_type else None
    if ext:
        return ext
    url_path = Path(urlparse(media_target).path)
    if url_path.suffix:
        return url_path.suffix
    return ".bin"


async def _upload_media_file(
    http_session: aiohttp.ClientSession,
    *,
    file_path: Path,
    to_user_id: str,
    base_url: str,
    token: str,
    cdn_base_url: str,
    mime_type: str,
) -> UploadedWechatMedia:
    plaintext = await async_read_bytes(file_path)
    filekey = secrets.token_hex(16)
    aeskey = secrets.token_bytes(16)
    ciphertext = _encrypt_aes_ecb(plaintext, aeskey)

    media_type = _resolve_upload_media_type(mime_type)
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


def _resolve_upload_media_type(mime_type: str) -> int:
    if mime_type.startswith("image/"):
        return api.UPLOAD_MEDIA_TYPE_IMAGE
    if mime_type.startswith("video/"):
        return api.UPLOAD_MEDIA_TYPE_VIDEO
    return api.UPLOAD_MEDIA_TYPE_FILE


def _encrypt_aes_ecb(plaintext: bytes, key: bytes) -> bytes:
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.ECB())
    encryptor = cipher.encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def _encode_uri_component(value: str) -> str:
    """按 encodeURIComponent 规则编码查询参数值。"""
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


def _build_media_item(
    *,
    mime_type: str,
    file_name: str,
    uploaded: UploadedWechatMedia,
) -> dict:
    # 官方发送协议使用 base64(hex-string)，接收端再回退还原成原始 16 字节 AES key。
    aes_key_base64 = base64.b64encode(uploaded.aeskey_hex.encode("ascii")).decode()

    if mime_type.startswith("image/"):
        return api.build_image_message_item(
            encrypt_query_param=uploaded.download_encrypted_query_param,
            aes_key_base64=aes_key_base64,
            mid_size=uploaded.file_size_ciphertext,
        )
    if mime_type.startswith("video/"):
        return api.build_video_message_item(
            encrypt_query_param=uploaded.download_encrypted_query_param,
            aes_key_base64=aes_key_base64,
            video_size=uploaded.file_size_ciphertext,
        )
    return api.build_file_message_item(
        encrypt_query_param=uploaded.download_encrypted_query_param,
        aes_key_base64=aes_key_base64,
        file_name=file_name,
        file_size=uploaded.file_size,
    )
