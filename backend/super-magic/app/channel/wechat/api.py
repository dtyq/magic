"""
微信官方 ClawBot ilink API 封装。

本文件按官方插件 `@tencent-weixin/openclaw-weixin@1.0.2` 的协议形状做 Python 移植：
- get_bot_qrcode / get_qrcode_status: GET + query 参数
- getupdates / sendmessage: POST JSON + base_info
- 请求头：AuthorizationType / Content-Length / X-WECHAT-UIN
- client_id 格式：openclaw-weixin:{timestamp}-{8hex}
"""
from __future__ import annotations

import base64
import json
import random
import re
import secrets
import time
from typing import Any

import aiohttp

from agentlang.logger import get_logger

logger = get_logger(__name__)

DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com"
DEFAULT_ILINK_BOT_TYPE = "3"
OFFICIAL_CHANNEL_VERSION = "1.0.2"
OFFICIAL_CLIENT_ID_PREFIX = "openclaw-weixin"
DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000
DEFAULT_API_TIMEOUT_MS = 15_000
DEFAULT_CONFIG_TIMEOUT_MS = 10_000
TYPING_STATUS_TYPING = 1
TYPING_STATUS_CANCEL = 2
SESSION_EXPIRED_ERRCODE = -14
SESSION_PAUSE_DURATION_MS = 60 * 60 * 1000
UPLOAD_MEDIA_TYPE_IMAGE = 1
UPLOAD_MEDIA_TYPE_VIDEO = 2
UPLOAD_MEDIA_TYPE_FILE = 3


class WechatAPIError(RuntimeError):
    """官方 ilink API 返回错误或不可解析响应。"""


def _ensure_trailing_slash(url: str) -> str:
    return url if url.endswith("/") else f"{url}/"


def build_base_info() -> dict[str, str]:
    """与官方 buildBaseInfo 对齐。"""
    return {"channel_version": OFFICIAL_CHANNEL_VERSION}


def generate_client_id() -> str:
    """与官方 generateId("openclaw-weixin") 对齐。"""
    return f"{OFFICIAL_CLIENT_ID_PREFIX}:{int(time.time() * 1000)}-{secrets.token_hex(4)}"


def _random_wechat_uin() -> str:
    """与官方 randomWechatUin 对齐：随机 uint32 的十进制字符串再做 base64。"""
    value = str(random.randint(0, 2**32 - 1)).encode("utf-8")
    return base64.b64encode(value).decode("utf-8")


def _build_headers(body: str = "", token: str | None = None) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "AuthorizationType": "ilink_bot_token",
        "X-WECHAT-UIN": _random_wechat_uin(),
    }
    if body:
        headers["Content-Length"] = str(len(body.encode("utf-8")))
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


async def _read_json_response(resp: aiohttp.ClientResponse) -> dict[str, Any]:
    """忽略非标准 Content-Type，按文本读出后解析 JSON。"""
    raw_text = await resp.text()
    if not raw_text:
        return {}
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise WechatAPIError(f"invalid JSON response: {raw_text[:200]}") from exc


async def _api_fetch(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    endpoint: str,
    body: str,
    token: str | None,
    timeout_ms: int,
    label: str,
) -> str:
    url = f"{_ensure_trailing_slash(base_url)}{endpoint}"
    headers = _build_headers(body=body, token=token)
    timeout = aiohttp.ClientTimeout(total=(timeout_ms / 1000) + 5)
    try:
        async with session.post(url, data=body, headers=headers, timeout=timeout) as resp:
            raw_text = await resp.text()
            logger.debug(f"[WechatAPI] {label} status={resp.status} raw={raw_text[:300]}")
            if resp.status >= 400:
                raise WechatAPIError(f"{label} {resp.status}: {raw_text}")
            return raw_text
    except TimeoutError:
        raise


async def get_bot_qrcode(
    session: aiohttp.ClientSession,
    *,
    api_base_url: str = DEFAULT_BASE_URL,
    bot_type: str = DEFAULT_ILINK_BOT_TYPE,
) -> dict[str, Any]:
    """按官方协议申请二维码。"""
    url = f"{_ensure_trailing_slash(api_base_url)}ilink/bot/get_bot_qrcode?bot_type={bot_type}"
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
        raw = await _read_json_response(resp)
        if resp.status >= 400:
            raise WechatAPIError(f"get_bot_qrcode {resp.status}: {raw}")
    return raw


async def get_qrcode_status(
    session: aiohttp.ClientSession,
    *,
    qrcode: str,
    api_base_url: str = DEFAULT_BASE_URL,
) -> dict[str, Any]:
    """按官方协议轮询扫码状态；客户端超时视为 wait。"""
    url = f"{_ensure_trailing_slash(api_base_url)}ilink/bot/get_qrcode_status?qrcode={qrcode}"
    timeout = aiohttp.ClientTimeout(total=(DEFAULT_LONG_POLL_TIMEOUT_MS / 1000) + 1)
    try:
        async with session.get(
            url,
            headers={"iLink-App-ClientVersion": "1"},
            timeout=timeout,
        ) as resp:
            raw = await resp.text()
            logger.debug(f"[WechatAPI] get_qrcode_status status={resp.status} raw={raw[:300]}")
            if resp.status >= 400:
                raise WechatAPIError(f"get_qrcode_status {resp.status}: {raw}")
            return json.loads(raw) if raw else {"status": "wait"}
    except TimeoutError:
        return {"status": "wait"}


async def get_updates(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    get_updates_buf: str = "",
    timeout_ms: int = DEFAULT_LONG_POLL_TIMEOUT_MS,
) -> dict[str, Any]:
    """按官方 getUpdates 协议长轮询；客户端超时返回空响应。"""
    body = json.dumps(
        {
            "get_updates_buf": get_updates_buf,
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    try:
        raw = await _api_fetch(
            session,
            base_url=base_url,
            endpoint="ilink/bot/getupdates",
            body=body,
            token=token,
            timeout_ms=timeout_ms,
            label="getUpdates",
        )
        return json.loads(raw) if raw else {"ret": 0, "msgs": [], "get_updates_buf": get_updates_buf}
    except TimeoutError:
        return {"ret": 0, "msgs": [], "get_updates_buf": get_updates_buf}


async def get_upload_url(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    filekey: str,
    media_type: int,
    to_user_id: str,
    rawsize: int,
    rawfilemd5: str,
    filesize: int,
    aeskey: str,
    thumb_rawsize: int | None = None,
    thumb_rawfilemd5: str | None = None,
    thumb_filesize: int | None = None,
    no_need_thumb: bool = True,
    timeout_ms: int = DEFAULT_API_TIMEOUT_MS,
) -> dict[str, Any]:
    body = json.dumps(
        {
            "filekey": filekey,
            "media_type": media_type,
            "to_user_id": to_user_id,
            "rawsize": rawsize,
            "rawfilemd5": rawfilemd5,
            "filesize": filesize,
            "thumb_rawsize": thumb_rawsize,
            "thumb_rawfilemd5": thumb_rawfilemd5,
            "thumb_filesize": thumb_filesize,
            "no_need_thumb": no_need_thumb,
            "aeskey": aeskey,
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    raw = await _api_fetch(
        session,
        base_url=base_url,
        endpoint="ilink/bot/getuploadurl",
        body=body,
        token=token,
        timeout_ms=timeout_ms,
        label="getUploadUrl",
    )
    return json.loads(raw) if raw else {}


def build_send_text_message_body(
    *,
    to_user_id: str,
    text: str,
    context_token: str,
) -> dict[str, Any]:
    """构造与官方 buildTextMessageReq 对齐的文本消息请求体。"""
    item_list = [{"type": 1, "text_item": {"text": text}}] if text else None
    return {
        "msg": {
            "from_user_id": "",
            "to_user_id": to_user_id,
            "client_id": generate_client_id(),
            "message_type": 2,
            "message_state": 2,
            "item_list": item_list,
            "context_token": context_token or None,
        }
    }


def build_send_items_message_body(
    *,
    to_user_id: str,
    item_list: list[dict[str, Any]],
    context_token: str,
) -> dict[str, Any]:
    return {
        "msg": {
            "from_user_id": "",
            "to_user_id": to_user_id,
            "client_id": generate_client_id(),
            "message_type": 2,
            "message_state": 2,
            "item_list": item_list or None,
            "context_token": context_token or None,
        }
    }


def build_image_message_item(
    *,
    encrypt_query_param: str,
    aes_key_base64: str,
    mid_size: int,
) -> dict[str, Any]:
    return {
        "type": 2,
        "image_item": {
            "media": {
                "encrypt_query_param": encrypt_query_param,
                "aes_key": aes_key_base64,
                "encrypt_type": 1,
            },
            "mid_size": mid_size,
        },
    }


def build_video_message_item(
    *,
    encrypt_query_param: str,
    aes_key_base64: str,
    video_size: int,
) -> dict[str, Any]:
    return {
        "type": 5,
        "video_item": {
            "media": {
                "encrypt_query_param": encrypt_query_param,
                "aes_key": aes_key_base64,
                "encrypt_type": 1,
            },
            "video_size": video_size,
        },
    }


def build_file_message_item(
    *,
    encrypt_query_param: str,
    aes_key_base64: str,
    file_name: str,
    file_size: int,
) -> dict[str, Any]:
    return {
        "type": 4,
        "file_item": {
            "media": {
                "encrypt_query_param": encrypt_query_param,
                "aes_key": aes_key_base64,
                "encrypt_type": 1,
            },
            "file_name": file_name,
            "len": str(file_size),
        },
    }


async def send_message(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    text: str,
    timeout_ms: int = DEFAULT_API_TIMEOUT_MS,
) -> None:
    """发送单条文本消息；缺少 context_token 时直接拒绝。"""
    if not context_token:
        raise WechatAPIError("send_message: context_token is required")

    body = json.dumps(
        {
            **build_send_text_message_body(
                to_user_id=to_user_id,
                text=text,
                context_token=context_token,
            ),
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    await _api_fetch(
        session,
        base_url=base_url,
        endpoint="ilink/bot/sendmessage",
        body=body,
        token=token,
        timeout_ms=timeout_ms,
        label="sendMessage",
    )


async def send_message_items(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    to_user_id: str,
    context_token: str,
    item_list: list[dict[str, Any]],
    timeout_ms: int = DEFAULT_API_TIMEOUT_MS,
) -> None:
    if not context_token:
        raise WechatAPIError("send_message_items: context_token is required")

    body = json.dumps(
        {
            **build_send_items_message_body(
                to_user_id=to_user_id,
                item_list=item_list,
                context_token=context_token,
            ),
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    await _api_fetch(
        session,
        base_url=base_url,
        endpoint="ilink/bot/sendmessage",
        body=body,
        token=token,
        timeout_ms=timeout_ms,
        label="sendMessage",
    )


async def get_config(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    ilink_user_id: str,
    context_token: str | None = None,
    timeout_ms: int = DEFAULT_CONFIG_TIMEOUT_MS,
) -> dict[str, Any]:
    """按官方协议获取 bot 配置（当前主要用于 typing_ticket）。"""
    body = json.dumps(
        {
            "ilink_user_id": ilink_user_id,
            "context_token": context_token,
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    raw = await _api_fetch(
        session,
        base_url=base_url,
        endpoint="ilink/bot/getconfig",
        body=body,
        token=token,
        timeout_ms=timeout_ms,
        label="getConfig",
    )
    return json.loads(raw) if raw else {}


async def send_typing(
    session: aiohttp.ClientSession,
    *,
    base_url: str,
    token: str,
    ilink_user_id: str,
    typing_ticket: str,
    status: int = TYPING_STATUS_TYPING,
    timeout_ms: int = DEFAULT_CONFIG_TIMEOUT_MS,
) -> None:
    """按官方协议发送 typing / cancel typing。"""
    body = json.dumps(
        {
            "ilink_user_id": ilink_user_id,
            "typing_ticket": typing_ticket,
            "status": status,
            "base_info": build_base_info(),
        },
        ensure_ascii=False,
    )
    await _api_fetch(
        session,
        base_url=base_url,
        endpoint="ilink/bot/sendtyping",
        body=body,
        token=token,
        timeout_ms=timeout_ms,
        label="sendTyping",
    )


def is_api_error_response(data: dict[str, Any]) -> bool:
    return data.get("ret") not in (None, 0) or data.get("errcode") not in (None, 0)


def is_session_expired_response(data: dict[str, Any]) -> bool:
    return data.get("ret") == SESSION_EXPIRED_ERRCODE or data.get("errcode") == SESSION_EXPIRED_ERRCODE


def describe_non_text_item(item: dict[str, Any]) -> str:
    item_type = item.get("type")
    if item_type == 2:
        return "[image]"
    if item_type == 3:
        voice_text = str(((item.get("voice_item") or {}).get("text") or ""))
        return voice_text or "[voice message]"
    if item_type == 4:
        file_name = str(((item.get("file_item") or {}).get("file_name") or "")).strip()
        return f"[file: {file_name}]" if file_name else "[file]"
    if item_type == 5:
        return "[video]"
    return ""


def extract_text_from_item_list(item_list: list[dict[str, Any]] | None) -> str:
    """按官方 inbound.ts 的 bodyFromItemList 逻辑提取文本主体。"""
    if not item_list:
        return ""
    for item in item_list:
        item_type = item.get("type")
        if item_type == 1:
            text = str(((item.get("text_item") or {}).get("text") or ""))
            ref = item.get("ref_msg")
            if not ref:
                if text:
                    return text
                continue
            ref_message_item = ref.get("message_item")
            if ref_message_item and is_media_item(ref_message_item):
                if text:
                    return text
                continue
            parts: list[str] = []
            if ref.get("title"):
                parts.append(str(ref["title"]))
            if ref_message_item:
                ref_body = extract_text_from_item_list([ref_message_item])
                if ref_body:
                    parts.append(ref_body)
            if text:
                return text if not parts else f"[引用: {' | '.join(parts)}]\n{text}"
            continue
        if item_type == 3:
            voice_text = str(((item.get("voice_item") or {}).get("text") or ""))
            if voice_text:
                return voice_text
    for item in item_list:
        fallback_text = describe_non_text_item(item)
        if fallback_text:
            return fallback_text
    return "[unsupported message type]"


def is_media_item(item: dict[str, Any]) -> bool:
    return item.get("type") in {2, 3, 4, 5}


def markdown_to_plain_text(text: str) -> str:
    """按官方 send.ts + stripMarkdown 的规则把 Markdown 回复转成微信纯文本。"""
    result = text
    result = re.sub(r"```[^\n]*\n?([\s\S]*?)```", lambda m: m.group(1).strip(), result)
    result = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", result)
    result = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", result)
    result = re.sub(r"^\|[\s:|-]+\|$", "", result, flags=re.MULTILINE)

    def _table_repl(match: re.Match[str]) -> str:
        inner = match.group(1)
        return "  ".join(cell.strip() for cell in inner.split("|"))

    result = re.sub(r"^\|(.+)\|$", _table_repl, result, flags=re.MULTILINE)

    # 以下逻辑对齐 openclaw/src/line/markdown-to-line.ts 中的 stripMarkdown()
    result = re.sub(r"\*\*(.+?)\*\*", r"\1", result)
    result = re.sub(r"__(.+?)__", r"\1", result)
    result = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", result)
    result = re.sub(r"(?<!_)_(?!_)(.+?)(?<!_)_(?!_)", r"\1", result)
    result = re.sub(r"~~(.+?)~~", r"\1", result)
    result = re.sub(r"^#{1,6}\s+(.+)$", r"\1", result, flags=re.MULTILINE)
    result = re.sub(r"^>\s?(.*)$", r"\1", result, flags=re.MULTILINE)
    result = re.sub(r"^[-*_]{3,}$", "", result, flags=re.MULTILINE)
    result = re.sub(r"`([^`]+)`", r"\1", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()
