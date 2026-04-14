"""
消息分段工具 — 解析 <split delay="N" /> 标记，将回复拆成多条独立消息。

用法：微信渠道用 split_reply() 实现延时多段发送；其他渠道和 web 端用 strip_split_tags() 清除标记。
"""
import re

# 匹配 <split /> 或 <split delay="N" />，delay 单位为秒
_SPLIT_TAG = re.compile(r'<split(?:\s+delay="([0-9.]+)")?\s*/>')

# 在 JSON 字符串中，" 被转义为 \"，需兼容两种形式
_SPLIT_TAG_JSON = re.compile(r'<split[^>]*/>')


def split_reply(text: str) -> list[tuple[str, float]]:
    """将含 <split> 标记的文本拆分为多段，返回 (段落文本, 发送前延时秒数) 列表。

    第一段延时为 0.0，后续段落的延时取自前一个 <split> 标记的 delay 属性（默认 1.0s）。
    空白段落自动过滤。
    """
    result: list[tuple[str, float]] = []
    pos = 0
    pending_delay = 0.0

    for m in _SPLIT_TAG.finditer(text):
        seg = text[pos:m.start()]
        result.append((seg, pending_delay))
        pending_delay = float(m.group(1)) if m.group(1) else 0.5
        pos = m.end()

    result.append((text[pos:], pending_delay))
    return [(seg, delay) for seg, delay in result if seg.strip()]


def strip_split_tags(text: str) -> str:
    """从普通字符串中移除所有 <split .../> 标记。"""
    return _SPLIT_TAG.sub("", text)


def strip_split_tags_from_json(json_str: str) -> str:
    """从 JSON 字符串中移除所有 <split .../> 标记（兼容 JSON 转义的引号）。"""
    if "<split" not in json_str:
        return json_str
    return _SPLIT_TAG_JSON.sub("", json_str)
