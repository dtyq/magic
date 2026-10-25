"""
消息分段工具 — 解析 <split delay="N" /> 标记，将回复拆成多条独立消息。

用法：微信渠道用 split_reply() 实现延时多段发送；其他渠道和 web 端用 strip_split_tags() 清除标记。
"""
import json
import math
import re
from collections.abc import Iterator

# 匹配 <split /> 或 <split delay="N" />，delay 单位为秒
_SPLIT_TAG = re.compile(r"""<split(?:\s+delay=(?:"([0-9]+(?:\.[0-9]+)?)"|'([0-9]+(?:\.[0-9]+)?)'))?\s*/?>""")

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
_INLINE_CODE = re.compile(r"(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)")


def _active_split_tags(text: str) -> Iterator[re.Match[str]]:
    """同一组有效标签供发送与展示使用；代码、引用和转义内容不执行指令。"""
    protected: list[tuple[int, int]] = []
    fence_char = ""
    fence_size = 0
    offset = 0
    for line in text.splitlines(keepends=True):
        fence = _FENCE.match(line)
        if fence_char:
            protected.append((offset, offset + len(line)))
            if fence and fence[1][0] == fence_char and len(fence[1]) >= fence_size and not line[fence.end():].strip():
                fence_char = ""
        elif fence:
            fence_char, fence_size = fence[1][0], len(fence[1])
            protected.append((offset, offset + len(line)))
        elif line.lstrip().startswith(">") or line.startswith(("    ", "\t")):
            protected.append((offset, offset + len(line)))
        offset += len(line)
    protected.extend(match.span() for match in _INLINE_CODE.finditer(text))
    for match in _SPLIT_TAG.finditer(text):
        if any(start <= match.start() < end for start, end in protected):
            continue
        preceding = text[:match.start()]
        if (len(preceding) - len(preceding.rstrip("\\"))) % 2:
            continue
        delay = match[1] or match[2]
        if delay and not math.isfinite(float(delay)):
            continue
        yield match


def split_reply(text: str) -> list[tuple[str, float]]:
    """将含 <split> 标记的文本拆分为多段，返回 (段落文本, 发送前延时秒数) 列表。

    第一段延时为 0.0，后续段落的延时取自前一个 <split> 标记的 delay 属性（默认 1.0s）。
    空白段落自动过滤。
    """
    result: list[tuple[str, float]] = []
    pos = 0
    pending_delay = 0.0

    for m in _active_split_tags(text):
        seg = text[pos:m.start()]
        result.append((seg, pending_delay))
        pending_delay = float(m[1] or m[2]) if (m[1] or m[2]) else 0.5
        pos = m.end()

    result.append((text[pos:], pending_delay))
    return [(seg, delay) for seg, delay in result if seg.strip()]


def strip_split_tags(text: str) -> str:
    """从普通字符串中移除所有 <split .../> 标记。"""
    parts: list[str] = []
    position = 0
    for match in _active_split_tags(text):
        parts.append(text[position:match.start()])
        position = match.end()
    parts.append(text[position:])
    return "".join(parts)


def strip_split_tags_from_json(json_str: str) -> str:
    """从 JSON 字符串中移除所有 <split .../> 标记（兼容 JSON 转义的引号）。"""
    if "<split" not in json_str:
        return json_str
    # 只清理完整模型回复正文，不能把用户文本、工具参数或附件名中的示例删掉。
    # 在 JSON 字符串中，" 被转义为 \"，需兼容两种形式
    try:
        message = json.loads(json_str)
    except (ValueError, TypeError):
        return json_str
    if not isinstance(message, dict):
        return json_str
    payload = message.get("payload")
    if not isinstance(payload, dict) or payload.get("event") not in {"after_agent_reply", "before_tool_call"}:
        return json_str
    if payload.get("content_type") != "content":
        return json_str
    if payload.get("type") == "agent_reply" and isinstance(payload.get("content"), str):
        payload["content"] = strip_split_tags(payload["content"])
    raw = payload.get("raw_content")
    inner = raw.get("super_magic_message") if isinstance(raw, dict) else None
    if isinstance(inner, dict) and inner.get("role") == "assistant":
        if isinstance(inner.get("content"), str):
            inner["content"] = strip_split_tags(inner["content"])
        if isinstance(payload.get("content"), str):
            payload["content"] = strip_split_tags(payload["content"])
    return json.dumps(message, ensure_ascii=False)
