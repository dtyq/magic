"""
解析微信最终回复里的媒体引用，转为结构化媒体项列表。

支持以下标签（代码块外）：
  <img src="path">
  <img src="path" />
  <video src="path"></video>
  <video src="path" />
  <video><source src="path"></video>
  <audio src="path"></audio>
  <audio src="path" />
  <file src="path"></file>
  <file src="path" />
  <voice src="path"></voice>
  <voice src="path" />

当前状态说明：
  - <audio> / <file> 会按附件发送
  - <voice> 语法会被解析并保留为独立 kind，方便未来启用语音条发送
  - 但当前微信 bot API 不支持主动发送 voice_item，发送层会把 <voice> 降级成音频附件

同时向后兼容旧写法：
  Markdown 图片：![alt](path)
  HTML img（无 filename 属性）

所有媒体标签从可见文本里剥离；文本渲染给用户。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

# 媒体类型字面量，和微信 API 的 item type 保持语义对应
MediaKind = Literal["image", "video", "audio", "file", "voice"]

_ATTR_SRC_RE = re.compile(r'\bsrc=(?:"([^"]+)"|\'([^\']+)\')', re.IGNORECASE)
_ATTR_FILENAME_RE = re.compile(r'\bfilename=(?:"([^"]+)"|\'([^\']+)\')', re.IGNORECASE)

# Markdown 图片：![alt](path) 或 ![alt](path "title")
_MD_IMAGE_RE = re.compile(r'!\[[^\]]*\]\(([^)\s"\']+)(?:\s+"[^"]*")?\)')

# HTML img（兼容 <img ...> / <img ... />）
_HTML_IMG_RE = re.compile(r'<img\b([^>]*)\s*/?>', re.IGNORECASE)

# 简单单行标签：支持自闭合和成对闭合
_VIDEO_INLINE_RE = re.compile(r'<video\b([^>]*)\s*/?>(?:\s*</video>)?', re.IGNORECASE)
_AUDIO_INLINE_RE = re.compile(r'<audio\b([^>]*)\s*/?>(?:\s*</audio>)?', re.IGNORECASE)
_FILE_INLINE_RE = re.compile(r'<file\b([^>]*)\s*/?>(?:\s*</file>)?', re.IGNORECASE)
_VOICE_INLINE_RE = re.compile(r'<voice\b([^>]*)\s*/?>(?:\s*</voice>)?', re.IGNORECASE)

# 多行标签：当标签内还有嵌套内容（如 <video><source ...></video>）时兜底处理
_VIDEO_OPEN_RE = re.compile(r"<video\b", re.IGNORECASE)
_VIDEO_CLOSE = "</video>"
_AUDIO_OPEN_RE = re.compile(r"<audio\b", re.IGNORECASE)
_AUDIO_CLOSE = "</audio>"
_FILE_OPEN_RE = re.compile(r"<file\b", re.IGNORECASE)
_FILE_CLOSE = "</file>"
_VOICE_OPEN_RE = re.compile(r"<voice\b", re.IGNORECASE)
_VOICE_CLOSE = "</voice>"

_VIDEO_SELF_CLOSED_RE = re.compile(r'<video\b[^>]*\/>', re.IGNORECASE)
_AUDIO_SELF_CLOSED_RE = re.compile(r'<audio\b[^>]*\/>', re.IGNORECASE)
_FILE_SELF_CLOSED_RE = re.compile(r'<file\b[^>]*\/>', re.IGNORECASE)
_VOICE_SELF_CLOSED_RE = re.compile(r'<voice\b[^>]*\/>', re.IGNORECASE)

# 代码块边界
_FENCE_RE = re.compile(r"^\s*```")

_BLANK_LINE_RE = re.compile(r"\n{3,}")


@dataclass(slots=True)
class MediaItem:
    kind: MediaKind
    src: str
    filename: str = ""  # 仅 audio/file 生效，为空时用 src 推断


@dataclass(slots=True)
class ParsedWechatReply:
    text: str
    media_items: list[MediaItem] = field(default_factory=list)

    @property
    def media_urls(self) -> list[str]:
        """向后兼容：返回所有媒体 src 列表。"""
        return [m.src for m in self.media_items]

    @property
    def first_media_url(self) -> str | None:
        return self.media_items[0].src if self.media_items else None


def _extract_src(attrs_text: str) -> str | None:
    m = _ATTR_SRC_RE.search(attrs_text)
    return (m.group(1) or m.group(2)) if m else None


def _extract_filename(attrs_text: str) -> str:
    m = _ATTR_FILENAME_RE.search(attrs_text)
    return (m.group(1) or m.group(2)) if m else ""


def _is_valid_src(value: str | None) -> bool:
    if not value:
        return False
    if value.startswith(("https://", "http://", "file://")):
        return True
    if value.startswith("/"):
        return True
    # 排除 HTML anchor 和其他 URI scheme
    if value.startswith("#") or "://" in value:
        return False
    return True


def _parse_inline_media(line: str) -> tuple[str, list[MediaItem]]:
    """提取单行内的媒体引用，返回剥离后的行和媒体项列表。"""
    items: list[MediaItem] = []

    def _replace_md(m: re.Match) -> str:
        src = m.group(1)
        if _is_valid_src(src):
            items.append(MediaItem(kind="image", src=src))
            return ""
        return m.group(0)

    def _replace_html_img(m: re.Match) -> str:
        src = _extract_src(m.group(1))
        if _is_valid_src(src):
            items.append(MediaItem(kind="image", src=src))  # type: ignore[arg-type]
            return ""
        return m.group(0)

    def _replace_video(m: re.Match) -> str:
        src = _extract_src(m.group(1))
        if _is_valid_src(src):
            items.append(MediaItem(kind="video", src=src))  # type: ignore[arg-type]
            return ""
        return m.group(0)

    def _replace_audio(m: re.Match) -> str:
        src = _extract_src(m.group(1))
        if _is_valid_src(src):
            filename = _extract_filename(m.group(1))
            items.append(MediaItem(kind="audio", src=src, filename=filename))  # type: ignore[arg-type]
            return ""
        return m.group(0)

    def _replace_file(m: re.Match) -> str:
        src = _extract_src(m.group(1))
        if _is_valid_src(src):
            filename = _extract_filename(m.group(1))
            items.append(MediaItem(kind="file", src=src, filename=filename))  # type: ignore[arg-type]
            return ""
        return m.group(0)

    def _replace_voice(m: re.Match) -> str:
        src = _extract_src(m.group(1))
        if _is_valid_src(src):
            items.append(MediaItem(kind="voice", src=src))  # type: ignore[arg-type]
            return ""
        return m.group(0)

    line = _MD_IMAGE_RE.sub(_replace_md, line)
    line = _HTML_IMG_RE.sub(_replace_html_img, line)
    line = _VIDEO_INLINE_RE.sub(_replace_video, line)
    line = _AUDIO_INLINE_RE.sub(_replace_audio, line)
    line = _FILE_INLINE_RE.sub(_replace_file, line)
    line = _VOICE_INLINE_RE.sub(_replace_voice, line)
    return line, items


def _find_block_tag_kind(line: str) -> tuple[MediaKind, str, re.Pattern[str]] | None:
    if _VIDEO_OPEN_RE.search(line):
        return "video", _VIDEO_CLOSE, _VIDEO_SELF_CLOSED_RE
    if _AUDIO_OPEN_RE.search(line):
        return "audio", _AUDIO_CLOSE, _AUDIO_SELF_CLOSED_RE
    if _FILE_OPEN_RE.search(line):
        return "file", _FILE_CLOSE, _FILE_SELF_CLOSED_RE
    if _VOICE_OPEN_RE.search(line):
        return "voice", _VOICE_CLOSE, _VOICE_SELF_CLOSED_RE
    return None


def _collect_block_tag(
    lines: list[str],
    start_idx: int,
    *,
    first_line: str,
    close_tag: str,
    self_closed_re: re.Pattern[str],
) -> tuple[list[str], int, bool]:
    """
    收集多行标签块。
    返回：(block_lines, end_idx, terminated)
    terminated=False 表示直到文件末尾都没找到合法结束，应保留原文。
    """
    block_lines = [first_line]
    first_line_lower = first_line.lower()
    if self_closed_re.search(first_line) or close_tag in first_line_lower:
        return block_lines, start_idx, True

    idx = start_idx
    while idx + 1 < len(lines):
        idx += 1
        block_lines.append(lines[idx])
        if close_tag in lines[idx].lower():
            return block_lines, idx, True

    return block_lines, idx, False


def _parse_block_media(kind: MediaKind, block_text: str) -> MediaItem | None:
    src = _extract_src(block_text)
    if not _is_valid_src(src):
        return None
    filename = _extract_filename(block_text) if kind in {"audio", "file"} else ""
    return MediaItem(kind=kind, src=src, filename=filename)  # type: ignore[arg-type]


def parse_reply_media(reply_text: str) -> ParsedWechatReply:
    """
    从回复里提取媒体引用，返回剥离媒体后的可见文本和结构化媒体项列表。
    代码块内的内容不处理。
    """
    lines = reply_text.splitlines()
    result_lines: list[str] = []
    media_items: list[MediaItem] = []
    in_fence = False
    i = 0

    while i < len(lines):
        line = lines[i]

        if _FENCE_RE.match(line):
            in_fence = not in_fence
            result_lines.append(line)
            i += 1
            continue

        if in_fence:
            result_lines.append(line)
            i += 1
            continue

        line, inline_items = _parse_inline_media(line)
        media_items.extend(inline_items)

        block_tag = _find_block_tag_kind(line)
        if block_tag is not None:
            kind, close_tag, self_closed_re = block_tag
            block_lines, end_idx, terminated = _collect_block_tag(
                lines,
                i,
                first_line=line,
                close_tag=close_tag,
                self_closed_re=self_closed_re,
            )
            if terminated:
                block_text = "\n".join(block_lines)
                block_item = _parse_block_media(kind, block_text)
                if block_item is not None:
                    media_items.append(block_item)
                    i = end_idx + 1
                    continue
            result_lines.extend(block_lines)
            i = end_idx + 1
            continue

        result_lines.append(line)
        i += 1

    visible_text = "\n".join(result_lines).strip()
    visible_text = _BLANK_LINE_RE.sub("\n\n", visible_text)
    return ParsedWechatReply(text=visible_text, media_items=media_items)
