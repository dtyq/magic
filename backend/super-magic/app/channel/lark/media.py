"""飞书用户消息资源必须使用 messages/resources，不能用机器人上传资源接口。"""

import json
import mimetypes
import re
from collections.abc import Callable
from datetime import datetime, timezone
from email.message import Message
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.media import (
    MediaDownloadError,
    MediaSource,
    PreparedMediaMessage,
    prepare_media_message,
    read_response_bytes,
)
from app.channel.base.models import ChannelMediaContext, ChannelMediaType
from app.channel.lark.aggregation import LarkInboundBatch
from app.i18n import i18n

logger = get_logger(__name__)

_STRUCTURE_MAX_DEPTH = 6
_STRUCTURE_MAX_NODES = 64


class _ForwardNoteParser(HTMLParser):
    """只接受连续根级 p 元素，避免把普通用户文本当 HTML 清洗。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[str] = []
        self.valid = True
        self._inside_paragraph = False
        self._current: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "p" or self._inside_paragraph:
            self.valid = False
            return
        self._inside_paragraph = True
        self._current = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "p" or not self._inside_paragraph:
            self.valid = False
            return
        self.paragraphs.append("".join(self._current).strip())
        self._inside_paragraph = False
        self._current = []

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.valid = False

    def handle_data(self, data: str) -> None:
        if self._inside_paragraph:
            self._current.append(data)
        elif data.strip():
            self.valid = False

    def handle_comment(self, data: str) -> None:
        self.valid = False

    def handle_decl(self, decl: str) -> None:
        self.valid = False

    def unknown_decl(self, data: str) -> None:
        self.valid = False

    def handle_pi(self, data: str) -> None:
        self.valid = False

    @property
    def complete(self) -> bool:
        return self.valid and not self._inside_paragraph and bool(self.paragraphs)


def normalize_lark_forward_note(text: str) -> str:
    """将飞书转发备注的完整 p 包装转换为纯文本；其它输入保持原样。"""
    parser = _ForwardNoteParser()
    parser.feed(text)
    parser.close()
    if not parser.complete:
        return text.strip()
    return "\n".join(parser.paragraphs).strip()


def _lark_content_structure(kind: str, content: dict) -> dict:
    """Build a bounded, value-free summary suitable for inbound diagnostics."""
    nodes: list[dict] = []
    truncated = False
    visited = 0

    def walk(value: object, path: str, depth: int) -> None:
        nonlocal truncated, visited
        if visited >= _STRUCTURE_MAX_NODES:
            truncated = True
            return
        visited += 1
        if depth > _STRUCTURE_MAX_DEPTH:
            truncated = True
            return
        if isinstance(value, dict):
            if "tag" in value or "image_key" in value or "file_key" in value:
                summary = {
                    "path": path,
                    "fields": sorted(str(key) for key in value),
                    "has_image_key": bool(value.get("image_key")),
                    "has_file_key": bool(value.get("file_key")),
                }
                if isinstance(value.get("tag"), str):
                    summary["tag"] = value["tag"]
                if isinstance(value.get("text"), str):
                    summary["text_length"] = len(value["text"])
                nodes.append(summary)
            for key, child in value.items():
                walk(child, f"{path}.{key}", depth + 1)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]", depth + 1)

    walk(content, "$", 0)
    return {
        "message_type": kind,
        "content_fields": sorted(str(key) for key in content),
        "nodes": nodes,
        "truncated": truncated,
    }


def _post_body(content: dict) -> dict:
    """Return one localized post body while keeping direct event payloads compatible."""
    if "content" in content or "content_v2" in content or "title" in content:
        return content
    for locale in ("zh_cn", "en_us", "ja_jp"):
        body = content.get(locale)
        if isinstance(body, dict):
            return body
    return next((value for value in content.values() if isinstance(value, dict)), {})


def _styled_text(text: str, styles: object) -> str:
    if not text or not isinstance(styles, list):
        return text
    if "bold" in styles:
        text = f"**{text}**"
    if "italic" in styles:
        text = f"*{text}*"
    if "underline" in styles:
        text = f"<u>{text}</u>"
    if "lineThrough" in styles:
        text = f"~~{text}~~"
    return text


def _render_post_item(
    item: dict,
    add_media: Callable[[dict, ChannelMediaType, str | None], str],
) -> str:
    tag = item.get("tag")
    if tag == "text":
        return _styled_text(item.get("text") or "", item.get("style"))
    if tag == "a":
        text = item.get("text") or ""
        href = item.get("href") or ""
        rendered = f"[{text}]({href})" if text and href else href or text
        return _styled_text(rendered, item.get("style"))
    if tag == "at":
        name = item.get("user_name") or item.get("user_id") or ""
        return f"@{name}" if name and not str(name).startswith("@") else str(name)
    if tag == "emotion":
        emoji = item.get("emoji_type") or ""
        return f":{emoji}:" if emoji else ""
    if tag == "md":
        return item.get("text") or ""
    if tag == "img":
        return add_media(item, ChannelMediaType.IMAGE, item.get("image_key"))
    if tag == "media":
        return add_media(item, ChannelMediaType.VIDEO, item.get("file_key"))
    if tag == "code_block":
        language = item.get("language") or ""
        return f"\n```{language}\n{item.get('text') or ''}\n```\n"
    if tag == "hr":
        return "\n---\n"
    # Future Lark nodes may still carry readable text. Preserve it without
    # injecting an unsupported-node marker into otherwise valid user content.
    return item.get("text") or ""


def _parse_post(
    content: dict,
    add_media: Callable[[dict, ChannelMediaType, str | None], str],
) -> str:
    body = _post_body(content)
    pieces: list[str] = []
    if title := body.get("title"):
        pieces.append(str(title))
    blocks = body.get("content_v2") or body.get("content") or []
    if isinstance(blocks, list):
        for row in blocks:
            if not isinstance(row, list):
                continue
            row_text = "".join(
                _render_post_item(item, add_media) for item in row if isinstance(item, dict)
            )
            if row_text:
                pieces.append(row_text)

    files = content.get("files")
    if not isinstance(files, list):
        files = body.get("files")
    if isinstance(files, list):
        for item in files:
            if not isinstance(item, dict):
                continue
            if item.get("is_folder"):
                name = item.get("file_name") or "folder"
                pieces.append(i18n.translate("lark.inbound.folder_unsupported", filename=name))
                continue
            marker = add_media(item, ChannelMediaType.FILE, item.get("file_key"))
            if marker:
                pieces.append(marker)
    return "\n".join(pieces).strip()


def _response_file_name(content_disposition: str) -> str:
    if not content_disposition:
        return ""
    message = Message()
    message["content-disposition"] = content_disposition
    name = message.get_filename() or ""
    return name.rsplit("/", 1)[-1]


def _format_lark_time(value: object) -> str:
    try:
        timestamp = int(str(value))
    except (TypeError, ValueError):
        return "unknown time"
    # Lark documents millisecond strings, but normalizing seconds as well avoids
    # silently rendering a 1970 date if an older payload uses second precision.
    seconds = timestamp if abs(timestamp) < 10_000_000_000 else timestamp / 1000
    try:
        return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except (OSError, OverflowError, ValueError):
        return "unknown time"


def _escape_markdown(value: object) -> str:
    text = str(value or "")
    for char in ("\\", "*", "_", "[", "]", "`", "#"):
        text = text.replace(char, f"\\{char}")
    return text


def _forwarded_children(items: list[dict], root_message_id: str) -> dict[str, list[dict]]:
    def timestamp(item: dict) -> int:
        try:
            return int(str(item.get("create_time") or "0"))
        except ValueError:
            return 0

    children: dict[str, list[dict]] = {}
    for item in items:
        item_id = str(item.get("message_id") or "")
        upper_id = str(item.get("upper_message_id") or "")
        if item_id == root_message_id and not upper_id:
            continue
        parent_id = upper_id or root_message_id
        children.setdefault(parent_id, []).append(item)
    for siblings in children.values():
        siblings.sort(key=timestamp)
    return children


def _forwarded_sender(item: dict) -> str:
    sender = item.get("sender")
    if not isinstance(sender, dict):
        return "Participant"
    return str(sender.get("sender_name") or sender.get("name") or sender.get("id") or "Participant")


def _safe_filename_part(value: str) -> str:
    return re.sub(r'[\\/:*?"<>|\r\n]+', "_", value).strip(" .")[:80]


def _forwarded_filename(items: list[dict], root_message_id: str) -> str:
    """根据查询结果中的实际参与人生成飞书会话记录文件名。"""
    participants: list[str] = []
    for item in items:
        item_id = str(item.get("message_id") or "")
        upper_id = str(item.get("upper_message_id") or "")
        if item_id == root_message_id and not upper_id:
            continue
        name = _safe_filename_part(_forwarded_sender(item))
        if name and name not in participants:
            participants.append(name)

    if not participants:
        return f"{i18n.translate('lark.forwarded_record.filename_fallback')}.md"

    participant_text = i18n.translate("lark.forwarded_record.participant_separator").join(
        participants[:3]
    )
    if len(participants) > 3:
        participant_text += i18n.translate("lark.forwarded_record.more_participants")
    return f"{i18n.translate('lark.forwarded_record.filename', participants=participant_text)}.md"


def _forwarded_content(
    item: dict,
    add_media: Callable[[dict, ChannelMediaType, str | None], str],
) -> str:
    kind = str(item.get("msg_type") or "text")
    body = item.get("body")
    raw_content = body.get("content") if isinstance(body, dict) else ""
    try:
        content = json.loads(raw_content or "{}")
    except (TypeError, ValueError):
        content = {}
    if not isinstance(content, dict):
        content = {}
    if kind == "text":
        return _escape_markdown(content.get("text") or "")
    if kind == "post":
        return _parse_post(content, add_media)
    if kind in ("image", "file", "audio", "media", "video"):
        media_type = {
            "image": ChannelMediaType.IMAGE,
            "file": ChannelMediaType.FILE,
            "audio": ChannelMediaType.VOICE,
            "media": ChannelMediaType.VIDEO,
            "video": ChannelMediaType.VIDEO,
        }[kind]
        key_name = "image_key" if kind == "image" else "file_key"
        return add_media(content, media_type, content.get(key_name))
    return i18n.translate("lark.inbound.unsupported_forwarded_type", kind=kind)


def _forwarded_markdown_template(
    items: list[dict],
    root_message_id: str,
    add_media: Callable[[dict, ChannelMediaType, str | None], str],
) -> str:
    children = _forwarded_children(items, root_message_id)
    visited: set[str] = set()

    def render(parent_id: str, depth: int) -> list[str]:
        if parent_id in visited:
            return []
        visited.add(parent_id)
        sections: list[str] = []
        for item in children.get(parent_id, []):
            item_id = str(item.get("message_id") or "")
            sender = _escape_markdown(_forwarded_sender(item))
            created_at = _format_lark_time(item.get("create_time"))
            sections.append(f"{'  ' * depth}**{sender}** · {created_at}")
            if item.get("msg_type") == "merge_forward" and item_id:
                sections.extend(render(item_id, depth + 1))
            else:
                content = _forwarded_content(item, add_media)
                if content:
                    sections.append(content)
        return sections

    body = "\n\n".join(render(root_message_id, 0))
    empty = i18n.translate("lark.inbound.no_readable_forwarded_messages")
    return f"# Forwarded messages\n\n{body or empty}\n"


def _render_forwarded_media_links(
    template: str,
    media: list[ChannelMediaContext],
    source_names: list[str],
    source_types: list[ChannelMediaType],
) -> str:
    by_name: dict[str, list[ChannelMediaContext]] = {}
    for item in media:
        by_name.setdefault(item.file_name, []).append(item)
    rendered = template
    for index, (name, media_type) in enumerate(zip(source_names, source_types, strict=True)):
        matches = by_name.get(name, [])
        downloaded = matches.pop(0) if matches else None
        if downloaded is None:
            replacement = i18n.translate("lark.inbound.forwarded_attachment_download_failed")
        else:
            target = f"./{Path(downloaded.relative_path).name}"
            if media_type == ChannelMediaType.IMAGE:
                replacement = f"![Forwarded image]({target})"
            else:
                label = _escape_markdown(downloaded.file_name or Path(target).name)
                replacement = f"[Forwarded attachment: {label}]({target})"
        rendered = rendered.replace(f"{{{{LARK_MEDIA_{index}}}}}", replacement)
    return rendered


async def prepare_lark_message(
    kind: str,
    content: dict,
    message_id: str,
    app_id: str,
    app_secret: str,
    accompanying_text: str = "",
):
    if kind == "text":
        return await prepare_media_message("lark", (content.get("text") or "").strip(), [])
    pieces = []
    sources = []
    async with aiohttp.ClientSession() as session:

        access_token = ""

        async def get_access_token(force_refresh: bool = False) -> str:
            nonlocal access_token
            if access_token and not force_refresh:
                return access_token
            async with session.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={"app_id": app_id, "app_secret": app_secret},
            ) as response:
                data = json.loads(await read_response_bytes(response, max_bytes=1024 * 1024))
            access_token = str(data.get("tenant_access_token") or "")
            if not access_token:
                raise MediaDownloadError("Lark authentication is unavailable.")
            return access_token

        def add_media(item, media_type, key, *, from_quote=False, fallback_name=""):
            name = item.get("file_name") or fallback_name
            source: MediaSource

            async def fetch():
                if not key or not message_id:
                    raise MediaDownloadError("Lark message resource key is missing.")
                url = f"https://open.feishu.cn/open-apis/im/v1/messages/{quote(message_id, safe='')}/resources/{quote(key, safe='')}"
                resource_type = "image" if media_type == ChannelMediaType.IMAGE else "file"
                for auth_attempt in range(2):
                    token = await get_access_token(force_refresh=auth_attempt > 0)
                    async with session.get(
                        url,
                        headers={"Authorization": f"Bearer {token}"},
                        params={"type": resource_type},
                    ) as response:
                        if response.status == 401 and auth_attempt == 0:
                            continue
                        if response.status == 403:
                            raise MediaDownloadError(
                                "Lark resource access denied; enable im:message:readonly permission.", status=403
                            )
                        content_type = response.headers.get("Content-Type", "").split(";")[0]
                        if not source.file_name:
                            source.file_name = _response_file_name(response.headers.get("Content-Disposition", ""))
                        if not source.mime_type and content_type != "application/json":
                            source.mime_type = content_type
                        if content_type == "application/json":
                            data = await read_response_bytes(response)
                            error = json.loads(data)
                            if isinstance(error, dict) and error.get("code") and "msg" in error:
                                raise MediaDownloadError(
                                    "Lark resource unavailable; verify message read permission and resend the attachment."
                                )
                            return data
                        return await read_response_bytes(response)
                raise MediaDownloadError("Lark authentication is unavailable.", status=401)

            source = MediaSource(
                media_type=media_type,
                file_name=name,
                mime_type=mimetypes.guess_type(name)[0] or "",
                fetch=fetch,
                from_quote=from_quote,
            )
            sources.append(source)
            return ""

        async def fetch_merge_forward_items() -> list[dict]:
            if not message_id:
                raise MediaDownloadError("Lark merged-forward message ID is missing.")
            token = await get_access_token()
            url = f"https://open.feishu.cn/open-apis/im/v1/messages/{quote(message_id, safe='')}"
            async with session.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "user_id_type": "open_id",
                    "card_msg_content_type": "raw_card_content",
                    "with_sender_name": "true",
                },
            ) as response:
                data = json.loads(await read_response_bytes(response, max_bytes=10 * 1024 * 1024))
            if data.get("code") not in (None, 0):
                raise MediaDownloadError("Lark merged-forward message details are unavailable.")
            result = data.get("data")
            items = result.get("items") if isinstance(result, dict) else []
            return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []

        if kind == "text":
            pieces.append(content.get("text") or "")
        elif kind == "post":
            post_text = _parse_post(content, add_media)
            if post_text:
                pieces.append(post_text)
            if not pieces and not sources:
                pieces.append(i18n.translate("lark.inbound.unsupported_or_empty_post"))
        elif kind in ("image", "file", "audio", "media", "video"):
            media_type = {
                "image": ChannelMediaType.IMAGE,
                "file": ChannelMediaType.FILE,
                "audio": ChannelMediaType.VOICE,
                "media": ChannelMediaType.VIDEO,
                "video": ChannelMediaType.VIDEO,
            }[kind]
            add_media(content, media_type, content.get("image_key" if kind == "image" else "file_key"))
        elif kind == "merge_forward":
            try:
                items = await fetch_merge_forward_items()
            except Exception as error:
                logger.warning(
                    f"[Lark inbound] merged-forward query failed error_type={type(error).__name__}"
                )
                text = "\n\n".join(
                    part
                    for part in (
                        accompanying_text,
                        i18n.translate("lark.inbound.merged_forward_retrieval_failed"),
                    )
                    if part
                )
                return await prepare_media_message(
                    "lark", text, []
                )

            source_names: list[str] = []
            source_types: list[ChannelMediaType] = []

            def add_forwarded_media(item, media_type, key):
                index = len(source_names)
                fallback_name = f"forwarded-{media_type.value}-{index + 1}"
                source_names.append(item.get("file_name") or fallback_name)
                source_types.append(media_type)
                add_media(
                    item,
                    media_type,
                    key,
                    from_quote=True,
                    fallback_name=fallback_name,
                )
                return f"{{{{LARK_MEDIA_{index}}}}}"

            template = _forwarded_markdown_template(items, message_id, add_forwarded_media)
            media_result = await prepare_media_message("lark", accompanying_text, sources)
            markdown = _render_forwarded_media_links(
                template,
                media_result.media,
                source_names,
                source_types,
            )
            markdown_filename = _forwarded_filename(items, message_id)

            async def markdown_bytes() -> bytes:
                return markdown.encode()

            markdown_result = await prepare_media_message(
                "lark",
                "",
                [
                    MediaSource(
                        media_type=ChannelMediaType.FILE,
                        file_name=markdown_filename,
                        mime_type="text/markdown",
                        fetch=markdown_bytes,
                        from_quote=True,
                    )
                ],
            )
            text = media_result.text
            if not markdown_result.media:
                text = "\n".join(part for part in (text, markdown_result.text) if part)
            return PreparedMediaMessage(
                text=text,
                media=[*media_result.media, *markdown_result.media],
            )
        else:
            pieces.append(i18n.translate("lark.inbound.unsupported_message_type"))
        return await prepare_media_message("lark", "\n".join(pieces).strip(), sources)


async def prepare_lark_batch(
    batch: LarkInboundBatch,
    app_id: str,
    app_secret: str,
) -> PreparedMediaMessage:
    """准备一个逻辑 Lark 消息；只有已配对的转发备注才去除 p 包装。"""
    canonical = batch.canonical_event
    note = ""
    if batch.merge_forward is not None and batch.note is not None:
        note = normalize_lark_forward_note(str(batch.note.content.get("text") or ""))

    return await prepare_lark_message(
        canonical.message_type,
        canonical.content,
        canonical.message_id,
        app_id,
        app_secret,
        accompanying_text=note,
    )
