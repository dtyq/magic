"""最终回复的微信投递副本；原始正文继续留在模型历史与网页。"""
from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass

_TAG = re.compile(r"<\s*(/?)\s*no_send\s*(/?)\s*>", re.IGNORECASE)
_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
_INLINE_CODE = re.compile(r"(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)")


@dataclass(frozen=True, slots=True)
class _ProtectedRange:
    start: int
    end: int


@dataclass(frozen=True, slots=True)
class NoSendResult:
    content: str
    region_count: int = 0
    unclosed: bool = False
    orphan_closing_count: int = 0


def _protected_ranges(text: str) -> list[_ProtectedRange]:
    """与 split 一致：代码、引用中的同名标签只作示例，不能执行发送控制。"""
    ranges: list[_ProtectedRange] = []
    fence_char = ""
    fence_size = 0
    offset = 0
    for line in text.splitlines(keepends=True):
        fence = _FENCE.match(line)
        if fence_char:
            ranges.append(_ProtectedRange(offset, offset + len(line)))
            if (
                fence and fence[1][0] == fence_char and len(fence[1]) >= fence_size
                and not line[fence.end():].strip()
            ):
                fence_char = ""
        elif fence:
            fence_char, fence_size = fence[1][0], len(fence[1])
            ranges.append(_ProtectedRange(offset, offset + len(line)))
        elif line.lstrip().startswith(">") or line.startswith(("    ", "\t")):
            ranges.append(_ProtectedRange(offset, offset + len(line)))
        offset += len(line)
    ranges.extend(_ProtectedRange(*match.span()) for match in _INLINE_CODE.finditer(text))

    merged: list[_ProtectedRange] = []
    for item in sorted(ranges, key=lambda item: item.start):
        if merged and item.start <= merged[-1].end:
            merged[-1] = _ProtectedRange(merged[-1].start, max(merged[-1].end, item.end))
        else:
            merged.append(item)
    return merged


def _active_tags(text: str) -> Iterator[re.Match[str]]:
    ranges = _protected_ranges(text)
    range_index = 0
    for match in _TAG.finditer(text):
        while range_index < len(ranges) and ranges[range_index].end <= match.start():
            range_index += 1
        if range_index < len(ranges) and ranges[range_index].start <= match.start():
            continue
        preceding = match.start() - 1
        while preceding >= 0 and text[preceding] == "\\":
            preceding -= 1
        if (match.start() - preceding - 1) % 2:
            continue
        yield match


def filter_no_send(content: str) -> NoSendResult:
    """只过滤包裹范围；工具是否发送过消息不决定这次最终回复的可见范围。"""
    if "no_send" not in content.casefold():
        return NoSendResult(content)

    visible: list[str] = []
    position = 0
    depth = 0
    region_count = 0
    orphan_closing_count = 0
    for tag in _active_tags(content):
        if depth == 0:
            visible.append(content[position:tag.start()])
        if tag[1]:
            if depth:
                depth -= 1
            else:
                orphan_closing_count += 1
        elif not tag[2]:
            if depth == 0:
                region_count += 1
            depth += 1
        position = tag.end()

    # 例：正常内容 <no_send>检查记录（漏写闭合标签）。只发送开标签前的内容，
    # 不能因为格式不完整把已经明确标为不发送的记录重新发到微信。
    if depth == 0:
        visible.append(content[position:])
    return NoSendResult(
        content="".join(visible), region_count=region_count,
        unclosed=depth > 0, orphan_closing_count=orphan_closing_count,
    )
