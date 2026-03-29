"""
解析微信最终回复里的 `MEDIA:` 协议行。

只处理微信场景，不抽象成通用模块。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

MEDIA_LINE_RE = re.compile(r"^\s*MEDIA:\s*(.*?)\s*$", re.IGNORECASE)
FENCE_LINE_RE = re.compile(r"^\s*```")
BLANK_LINE_RE = re.compile(r"\n{3,}")


@dataclass(slots=True)
class ParsedWechatReply:
    text: str
    media_urls: list[str] = field(default_factory=list)

    @property
    def first_media_url(self) -> str | None:
        return self.media_urls[0] if self.media_urls else None


def parse_reply_media(reply_text: str) -> ParsedWechatReply:
    """
    解析最终回复中的媒体协议。

    规则：
    - 仅识别代码块外的 `MEDIA:` 行
    - 合法媒体行会从可见文本里剥离
    - 非法媒体行保留原文，避免误删正常内容
    - 空 `MEDIA:` 行直接忽略
    """
    visible_lines: list[str] = []
    media_urls: list[str] = []
    inside_code_fence = False

    for line in reply_text.splitlines():
        if FENCE_LINE_RE.match(line):
            inside_code_fence = not inside_code_fence
            visible_lines.append(line)
            continue

        if inside_code_fence:
            visible_lines.append(line)
            continue

        match = MEDIA_LINE_RE.match(line)
        if not match:
            visible_lines.append(line)
            continue

        raw_target = _strip_wrapping_backticks(match.group(1).strip())
        if not raw_target:
            continue

        if _is_supported_media_target(raw_target):
            media_urls.append(raw_target)
            continue

        visible_lines.append(line)

    visible_text = "\n".join(visible_lines).strip()
    visible_text = BLANK_LINE_RE.sub("\n\n", visible_text)
    return ParsedWechatReply(text=visible_text, media_urls=media_urls)


def _strip_wrapping_backticks(value: str) -> str:
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        return value[1:-1].strip()
    return value


def _is_supported_media_target(value: str) -> bool:
    if value.startswith(("https://", "http://", "file://")):
        return True
    return value.startswith("/")
