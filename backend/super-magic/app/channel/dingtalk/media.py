"""钉钉接收媒体：downloadCode 每次重试重新换取临时链接。"""

import asyncio
import copy
import json
import mimetypes
import posixpath
import re
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.media import (
    MediaDownloadError,
    MediaSource,
    PreparedMediaMessage,
    prepare_media_message,
    read_response_bytes,
)
from app.channel.base.models import ChannelMediaType
from app.channel.dingtalk.users import DingTalkUserResolver
from app.i18n import i18n

logger = get_logger(__name__)


def _message_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _escape_markdown(value: str) -> str:
    return re.sub(r"([\\`*_{}\[\]()#+.!|>-])", r"\\\1", value)


def _format_forwarded_time(value: Any) -> str:
    if not isinstance(value, (int, float)):
        return ""
    timestamp = value / 1000 if value > 10_000_000_000 else value
    try:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).astimezone(ZoneInfo("Asia/Shanghai")).isoformat(
            sep=" ", timespec="seconds"
        )
    except (OverflowError, OSError, ValueError):
        return ""


def _safe_filename_part(value: str) -> str:
    return re.sub(r'[\\/:*?"<>|\r\n]+', "_", value).strip(" .")[:80]


def _forwarded_filename(participants: list[str]) -> str:
    names = [_safe_filename_part(name) for name in participants if _safe_filename_part(name)]
    suffix = i18n.translate("dingtalk.forwarded_record.filename_suffix")
    title = i18n.translate("dingtalk.forwarded_record.title")
    if names:
        participants_text = i18n.translate(
            "dingtalk.forwarded_record.participants",
            participants=i18n.translate("dingtalk.forwarded_record.participant_separator").join(names[:3]),
        )
        if len(names) > 3:
            participants_text += i18n.translate("dingtalk.forwarded_record.more_participants")
        return f"{title} {participants_text} {suffix}.md"
    return f"{title}.md"


def _rich_text_structure(items: Any, path: str = "root", depth: int = 0) -> list[dict[str, Any]]:
    """Return a bounded, redacted shape of DingTalk rich-text nodes for diagnosis."""
    if depth > 4:
        return [{"path": path, "kind": type(items).__name__, "truncated": True}]
    if isinstance(items, str):
        try:
            return _rich_text_structure(json.loads(items), path, depth + 1)
        except json.JSONDecodeError:
            return [{"path": path, "kind": "string", "value": items[:200], "truncated": len(items) > 200}]
    if isinstance(items, dict):
        result: list[dict[str, Any]] = []
        node = {"path": path, "kind": "object", "fields": sorted(items)}
        for key in ("type", "text", "content", "emoji", "emotion", "emotionText", "name"):
            value = items.get(key)
            if isinstance(value, str):
                node[key] = value[:200] if key in {"text", "content", "emoji", "emotionText"} else value
                if len(value) > 200:
                    node[f"{key}_truncated"] = True
        for key in ("downloadCode", "pictureDownloadCode"):
            if key in items:
                node[f"{key}_present"] = bool(items[key])
        result.append(node)
        for key in ("richText", "content", "children"):
            if isinstance(items.get(key), (list, dict)):
                result.extend(_rich_text_structure(items[key], f"{path}.{key}", depth + 1))
        return result
    if isinstance(items, list):
        result = []
        for index, item in enumerate(items[:50]):
            result.extend(_rich_text_structure(item, f"{path}[{index}]", depth + 1))
        if len(items) > 50:
            result.append({"path": path, "truncated_items": len(items) - 50})
        return result
    return [{"path": path, "kind": type(items).__name__}]


def _log_rich_text_structure(items: Any, context: str) -> None:
    structure = _rich_text_structure(items)
    logger.info(f"DingTalk rich text structure: context={context} nodes={len(structure)} structure={structure}")


def merge_dingtalk_payloads(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    """把钉钉留言和转发事件合成一个逻辑 payload。"""
    forwarded = next((item for item in payloads if item.get("msgtype") == "chatRecord"), None)
    merged = copy.deepcopy(forwarded or payloads[-1])
    notes = [
        _message_text(item.get("text", {}).get("content"))
        for item in payloads
        if item.get("msgtype") == "text" and isinstance(item.get("text"), dict)
    ]
    if notes:
        merged["_dingtalk_merged_text"] = "\n".join(note for note in notes if note)
    merged["_dingtalk_source_message_ids"] = [str(item.get("msgId")) for item in payloads if item.get("msgId")]
    return merged


def _parse_rich_text_items(
    items: Any,
    add_media: Callable[[dict, str, bool], MediaSource | None],
    from_quote: bool,
    attachment_index: list[int],
) -> list[str]:
    parts: list[str] = []
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except json.JSONDecodeError:
            return [_escape_markdown(items)] if items.strip() else []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        return parts
    for item in items:
        if isinstance(item, str):
            parts.append(_escape_markdown(item))
            continue
        if not isinstance(item, dict):
            continue
        node_type = item.get("type")
        children = next((item[key] for key in ("richText", "content", "children") if isinstance(item.get(key), (list, dict))), None)
        if children is not None:
            parts.extend(_parse_rich_text_items(children, add_media, from_quote, attachment_index))
            if node_type == "paragraph":
                parts.append("\n")
            continue
        readable = next((item[key] for key in ("text", "content") if isinstance(item.get(key), str) and item[key]), "")
        if readable:
            parts.append(_escape_markdown(readable))
            continue
        if node_type in ("paragraph", "lineBreak", "br"):
            parts.append("\n")
            continue
        if node_type == "mention":
            attrs = item.get("attrs") or {}
            label = attrs.get("label") or attrs.get("name") or attrs.get("id")
            parts.append(f"@{label}" if label else "@")
            continue
        if node_type in ("emoji", "emotion"):
            attrs = item.get("attrs") if isinstance(item.get("attrs"), dict) else {}
            label = next((value for key in ("emoji", "emotion", "emotionText", "name", "label")
                          for value in (item.get(key), attrs.get(key)) if isinstance(value, str) and value), "")
            if label:
                parts.append(_escape_markdown(label))
            continue
        if node_type in ("picture", "image") or item.get("pictureDownloadCode") or (node_type != "file" and item.get("downloadCode")):
            attachment_index[0] += 1
            name = item.get("fileName") or f"image-{attachment_index[0]:03d}.png"
            add_media({**item, "fileName": name}, "picture", from_quote)
            parts.append(
                i18n.translate("dingtalk.forwarded_record.image", index=attachment_index[0], filename=name)
            )
            continue
        if node_type == "file":
            attachment_index[0] += 1
            name = item.get("fileName") or f"file-{attachment_index[0]:03d}.bin"
            add_media({**item, "fileName": name}, "file", from_quote)
            parts.append(
                i18n.translate("dingtalk.forwarded_record.file", index=attachment_index[0], filename=name)
            )
            continue
    return parts


def _parse_forwarded_chat_record(
    content: dict,
    add_media: Callable[[dict, str, bool], MediaSource | None] | None = None,
    sender_display_names: dict[str, str] | None = None,
) -> tuple[str, list[MediaSource], str]:
    """Parse a DingTalk forwarded record into Markdown text and media sources."""
    sources: list[MediaSource] = []
    participants: list[str] = []
    sender_names: dict[str, str] = {}
    parts: list[str] = []
    attachment_index = [0]

    def collect_media(item: dict, item_kind: str, from_quote: bool) -> None:
        if add_media is not None:
            source = add_media(item, item_kind, from_quote)
            if source is not None:
                sources.append(source)

    records = _chat_records(content)
    sender_display_names = {
        **_summary_sender_names(content, records),
        **(sender_display_names or {}),
    }

    for record in records:
        if not isinstance(record, dict):
            continue
        raw_sender = _message_text(record.get("senderNick"))
        sender_key = _message_text(record.get("senderId")) or raw_sender
        if not sender_key:
            sender = ""
        elif sender_key in sender_names:
            sender = sender_names[sender_key]
        elif sender_display_names and sender_key in sender_display_names:
            sender = sender_display_names[sender_key]
            sender_names[sender_key] = sender
        elif not raw_sender or raw_sender.startswith("$:LWCP"):
            sender = i18n.translate("dingtalk.forwarded_record.participant", index=len(sender_names) + 1)
            sender_names[sender_key] = sender
        else:
            sender = raw_sender
            sender_names[sender_key] = sender
        if sender and sender not in participants:
            participants.append(sender)
        msg_type = record.get("msgType")
        if sender:
            timestamp = _format_forwarded_time(record.get("createAt"))
            heading = f"**{_escape_markdown(sender)}**"
            if timestamp:
                heading += f" · {timestamp}"
            parts.append(heading)
        if msg_type == "text":
            parts.append(_escape_markdown(_message_text(record.get("content"))))
        elif msg_type == "richText":
            _log_rich_text_structure(record.get("richText"), f"forwarded:{record.get('msgId') or 'unknown'}")
            rich_parts = _parse_rich_text_items(record.get("richText"), collect_media, True, attachment_index)
            if not any(part.strip() for part in rich_parts):
                fallback = _message_text(record.get("content"))
                rich_parts = [_escape_markdown(fallback) if fallback else i18n.translate("dingtalk.forwarded_record.unknown_item")]
            parts.extend(rich_parts)
        elif msg_type == "file":
            attachment_index[0] += 1
            name = record.get("fileName") or f"file-{attachment_index[0]:03d}.bin"
            collect_media({**record, "fileName": name}, "file", True)
            parts.append(i18n.translate("dingtalk.forwarded_record.file", index=attachment_index[0], filename=name))
        else:
            parts.append(i18n.translate("dingtalk.forwarded_record.unknown_item"))

    if not parts:
        summary = content.get("summary")
        try:
            summary_items = json.loads(summary) if isinstance(summary, str) else summary
        except json.JSONDecodeError:
            summary_items = []
        if isinstance(summary_items, list):
            parts = [_message_text(item) for item in summary_items if _message_text(item)]
        elif isinstance(summary_items, str) and summary_items.strip():
            parts = [summary_items.strip()]

    body = "\n\n".join(part for part in parts if part).strip()
    return body, sources, _forwarded_filename(participants)


def _summary_sender_names(content: dict, records: list[dict[str, Any]]) -> dict[str, str]:
    """从钉钉 summary 的“昵称:摘要”中建立历史消息的可读名称映射。"""
    summary = content.get("summary")
    try:
        summary_items = json.loads(summary) if isinstance(summary, str) else summary
    except (TypeError, json.JSONDecodeError):
        return {}
    if not isinstance(summary_items, list):
        return {}
    candidates: list[tuple[str, str]] = []
    for item in summary_items:
        value = _message_text(item)
        if not value:
            continue
        name, separator, preview = value.partition(":")
        if not separator:
            name, separator, preview = value.partition("：")
        if name.strip() and separator and preview.strip():
            candidates.append((name.strip(), preview.strip()))

    mapping: dict[str, str] = {}
    used: set[int] = set()
    for record in records:
        sender_id = _message_text(record.get("senderId"))
        if not sender_id:
            continue
        text = _message_text(record.get("content"))
        if not text and record.get("msgType") == "richText":
            text = "".join(
                _message_text(item.get("text"))
                for item in record.get("richText", [])
                if isinstance(item, dict)
            )
        for index, (name, preview) in enumerate(candidates):
            if index in used:
                continue
            if text and (text == preview or text in preview or preview in text):
                mapping[sender_id] = name
                used.add(index)
                break
    return mapping


def _chat_records(content: dict) -> list[dict[str, Any]]:
    try:
        records = json.loads(content.get("chatRecord") or "[]")
    except (TypeError, json.JSONDecodeError):
        return []
    return [record for record in records if isinstance(record, dict)] if isinstance(records, list) else []


def _render_forwarded_markdown(body: str, media: list[Any], markdown_path: str) -> str:
    """Replace logical attachment markers with links to downloaded workspace files."""
    media_by_name: dict[str, list[Any]] = {}
    for item in media:
        media_by_name.setdefault(item.file_name, []).append(item)

    def replace(match: re.Match[str]) -> str:
        kind, index, logical_name = match.group(1), match.group(2), match.group(3)
        is_image = kind in ("图片附件", "Image attachment")
        candidates = media_by_name.get(logical_name, [])
        if not candidates:
            return i18n.translate(
                "dingtalk.forwarded_record.download_failed",
                kind=i18n.translate(
                    "dingtalk.forwarded_record.image_label" if is_image else "dingtalk.forwarded_record.file_label"
                ),
                filename=logical_name,
            )
        item = candidates.pop(0)
        target = Path(item.relative_path)
        # 图片链接相对于 Markdown 所在目录，而非工作区根目录。
        relative = posixpath.relpath(target.as_posix(), Path(markdown_path).parent.as_posix())
        link = f"./{relative}"
        if is_image:
            return f"![{kind} {index}：{item.file_name or target.name}]({link})"
        return f"[{kind} {index}：{item.file_name or target.name}]({link})"

    return re.sub(r"\[(图片附件|文件附件|Image attachment|File attachment) (\d+)(?:：|: )([^\]]+)\]", replace, body)


def _parse_chat_record(content: dict) -> str:
    """Compatibility helper returning the readable forwarded record body."""
    body, _, _ = _parse_forwarded_chat_record(content)
    return f"[Forwarded messages]\n{body}" if body else "[Forwarded messages]"


async def prepare_dingtalk_message(payload: dict, client):
    kind = payload.get("msgtype", "")
    content = payload.get("content") or {}
    text = (payload.get("text", {}).get("content") or "").strip() if kind == "text" else ""
    if kind == "text":
        return await prepare_media_message("dingtalk", (payload.get("text", {}).get("content") or "").strip(), [])
    pieces = []
    sources = []
    async with aiohttp.ClientSession() as session:

        def add_media(item, item_kind, from_quote=False):
            code = item.get("downloadCode") or item.get("pictureDownloadCode")
            media_type = {
                "picture": ChannelMediaType.IMAGE,
                "file": ChannelMediaType.FILE,
            }[item_kind]
            name = item.get("fileName") or ""

            async def fetch():
                if not code:
                    raise MediaDownloadError("Media download code is missing.")
                token = await asyncio.to_thread(client.get_access_token)
                if not token:
                    raise MediaDownloadError("DingTalk authentication is unavailable.")
                async with session.post(
                    "https://api.dingtalk.com/v1.0/robot/messageFiles/download",
                    headers={"x-acs-dingtalk-access-token": token},
                    json={"robotCode": payload.get("robotCode") or client.credential.client_id, "downloadCode": code},
                ) as response:
                    data = json.loads(await read_response_bytes(response, max_bytes=1024 * 1024))
                url = data.get("downloadUrl")
                if not url:
                    raise MediaDownloadError("DingTalk did not return a download URL.")
                async with session.get(url) as response:
                    return await read_response_bytes(response)

            return MediaSource(
                media_type=media_type,
                file_name=name,
                mime_type=mimetypes.guess_type(name)[0] or "",
                fetch=fetch,
                from_quote=from_quote,
            )

        def register_media(item, item_kind, from_quote=False):
            sources.append(add_media(item, item_kind, from_quote))

        if kind in ("picture", "file"):
            register_media(content, kind)
        elif kind == "richText":
            _log_rich_text_structure(content.get("richText"), f"message:{payload.get('msgId') or 'unknown'}")
            pieces.extend(_parse_rich_text_items(content.get("richText"), register_media, False, [0]))
            if not pieces and not sources:
                pieces.append("[Unsupported or empty DingTalk rich text message.]")
        elif kind == "chatRecord":
            records = _chat_records(content)
            display_names = _summary_sender_names(content, records)
            outer_sender_ids = {
                _message_text(payload.get("senderId")),
                _message_text(payload.get("senderStaffId")),
            }
            outer_nick = _message_text(payload.get("senderNick"))
            if outer_nick:
                for sender_id in outer_sender_ids - {""}:
                    display_names.setdefault(sender_id, outer_nick)
            unresolved = [
                _message_text(record.get("senderId"))
                for record in records
                if _message_text(record.get("senderId")) not in display_names
            ]
            if unresolved and client is not None:
                resolver = DingTalkUserResolver(client)
                display_names.update(await resolver.resolve_many(unresolved, session))
            record_body, record_sources, filename = _parse_forwarded_chat_record(
                content,
                add_media=add_media,
                sender_display_names=display_names,
            )
            sources.extend(record_sources)
            media_result = await prepare_media_message("dingtalk", "", sources)
            markdown_path = f"uploads/im-channels/dingtalk/{filename}"
            markdown = (
                f"# {i18n.translate('dingtalk.forwarded_record.title')}\n\n"
                f"{_render_forwarded_markdown(record_body, media_result.media, markdown_path) or i18n.translate('dingtalk.forwarded_record.empty')}\n"
            ).encode("utf-8")

            async def fetch_record() -> bytes:
                return markdown

            markdown_result = await prepare_media_message(
                "dingtalk",
                "",
                [
                    MediaSource(
                        media_type=ChannelMediaType.FILE,
                        file_name=filename,
                        mime_type="text/markdown",
                        fetch=fetch_record,
                        from_quote=True,
                    )
                ],
            )
            return PreparedMediaMessage(
                text=_message_text(payload.get("_dingtalk_merged_text")),
                media=[*media_result.media, *markdown_result.media],
            )
        elif kind != "text":
            pieces.append("[Unsupported DingTalk message type. Please resend as text or a supported attachment.]")
        if pieces:
            text = "\n".join(pieces).strip()
        return await prepare_media_message("dingtalk", text, sources)
