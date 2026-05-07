"""文件内容展示处理工具

用于 get_tool_detail 中对展示内容进行预处理：
1. 将 base64 数据替换为人性化描述，避免大量无意义字符刷屏
2. 对超长内容按行数或字符数截断，保留头尾以供预览
"""

from __future__ import annotations

import math
import re

from app.core.entity.message.server_message import DisplayType

# --------------------------------------------------------------------------- #
# 截断阈值常量
# --------------------------------------------------------------------------- #

# 行数截断：超过此行数时取头尾行
MAX_DETAIL_DISPLAY_LINES: int = 200
DETAIL_HEAD_LINES: int = 100
DETAIL_TAIL_LINES: int = 50

# 字符截断：行数未超但总字符数超出时兜底（主要针对 minified 单行文件）
MAX_DETAIL_DISPLAY_CHARS: int = 10_000
DETAIL_HEAD_CHARS: int = 6_000
DETAIL_TAIL_CHARS: int = 2_000

# --------------------------------------------------------------------------- #
# base64 识别常量
# --------------------------------------------------------------------------- #

# 纯 base64 行：行长 >= 此值且 base64 字符占比 >= BASE64_LINE_RATIO
BASE64_LINE_MIN_LEN: int = 200
BASE64_LINE_RATIO: float = 0.9

# data URI 正则：匹配 data:[mimetype];base64,[base64数据]
_DATA_URI_RE = re.compile(
    r'data:([^;,\s]+);base64,([A-Za-z0-9+/=]+)',
    re.ASCII,
)

# 判断字符是否为合法 base64 字符
_BASE64_CHARS = frozenset('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=')


# --------------------------------------------------------------------------- #
# 公共入口
# --------------------------------------------------------------------------- #

def truncate_content_for_display(content: str, display_type: DisplayType) -> tuple[str, DisplayType]:
    """
    对展示内容做预处理，依次执行：
      1. base64 替换
      2. 超长截断（行数优先，字符数兜底）

    IMAGE 类型直接跳过，原样返回。

    HTML 类型若发生截断，展示类型降级为 TEXT，避免前端渲染残缺结构。

    Args:
        content:      原始展示内容
        display_type: 展示类型

    Returns:
        (处理后的展示内容, 最终展示类型)
    """
    if display_type == DisplayType.IMAGE:
        return content, display_type

    if not content:
        return content, display_type

    # 第一步：替换 base64 数据
    content = _replace_base64_content(content)

    # 第二步：超长截断
    truncated = _truncate_content(content)

    # HTML 被截断后结构残缺，无法正常渲染，降级为 TEXT 展示原始文本
    if truncated is not content and display_type == DisplayType.HTML:
        display_type = DisplayType.TEXT

    return truncated, display_type


# --------------------------------------------------------------------------- #
# base64 替换
# --------------------------------------------------------------------------- #

def _replace_base64_content(content: str) -> str:
    """
    替换内容中的 base64 数据为人性化描述。

    处理两种模式：
    - data URI：data:[mimetype];base64,[data]
    - 纯 base64 行：整行几乎全是 base64 字符且行长超过阈值
    """
    # 替换 data URI（含 base64 的内联资源）
    content = _DATA_URI_RE.sub(_replace_data_uri, content)

    # 替换纯 base64 行
    lines = content.split('\n')
    processed = [_maybe_replace_base64_line(line) for line in lines]
    return '\n'.join(processed)


def _replace_data_uri(match: re.Match) -> str:
    """将 data URI 替换为人性化描述。"""
    mimetype = match.group(1)
    raw_b64 = match.group(2)
    # base64 字符数 * 3/4 约等于字节数
    approx_bytes = int(len(raw_b64) * 3 / 4)
    size_str = _format_bytes(approx_bytes)
    return f'[base64 数据: {mimetype}, 约 {size_str}]'


def _maybe_replace_base64_line(line: str) -> str:
    """
    如果某行是一个独立的 base64 数据块，替换为人性化描述。
    判断依据：行长 >= BASE64_LINE_MIN_LEN 且 base64 字符占比 >= BASE64_LINE_RATIO。
    """
    stripped = line.strip()
    if len(stripped) < BASE64_LINE_MIN_LEN:
        return line

    base64_char_count = sum(1 for c in stripped if c in _BASE64_CHARS)
    ratio = base64_char_count / len(stripped)
    if ratio < BASE64_LINE_RATIO:
        return line

    approx_bytes = int(len(stripped) * 3 / 4)
    size_str = _format_bytes(approx_bytes)
    return f'[base64 数据块: 约 {size_str}]'


def _format_bytes(n: int) -> str:
    """将字节数格式化为易读的大小字符串。"""
    if n < 1024:
        return f'{n}B'
    kb = n / 1024
    if kb < 1024:
        return f'{math.ceil(kb)}KB'
    mb = kb / 1024
    return f'{mb:.1f}MB'


# --------------------------------------------------------------------------- #
# 超长截断
# --------------------------------------------------------------------------- #

def _truncate_content(content: str) -> str:
    """
    对内容进行超长截断，策略优先级：
    1. 行数超出 MAX_DETAIL_DISPLAY_LINES → 行数截断（保留头尾行）
    2. 字符数超出 MAX_DETAIL_DISPLAY_CHARS → 字符截断（保留头尾字符）
    3. 都未超出 → 原样返回
    """
    lines = content.split('\n')
    total_lines = len(lines)

    if total_lines > MAX_DETAIL_DISPLAY_LINES:
        return _truncate_by_lines(lines, total_lines)

    total_chars = len(content)
    if total_chars > MAX_DETAIL_DISPLAY_CHARS:
        return _truncate_by_chars(content, total_chars)

    return content


def _truncate_by_lines(lines: list[str], total_lines: int) -> str:
    """保留头部 DETAIL_HEAD_LINES 行 + 尾部 DETAIL_TAIL_LINES 行，中间替换为省略说明。"""
    head = lines[:DETAIL_HEAD_LINES]
    tail = lines[-DETAIL_TAIL_LINES:]
    omitted = total_lines - DETAIL_HEAD_LINES - DETAIL_TAIL_LINES
    notice = f'\n... [已省略 {omitted} 行，文件共 {total_lines} 行，AI 已完整处理] ...\n'
    return '\n'.join(head) + notice + '\n'.join(tail)


def _truncate_by_chars(content: str, total_chars: int) -> str:
    """保留头部 DETAIL_HEAD_CHARS 个字符 + 尾部 DETAIL_TAIL_CHARS 个字符，中间替换为省略说明。"""
    head = content[:DETAIL_HEAD_CHARS]
    tail = content[-DETAIL_TAIL_CHARS:]
    omitted = total_chars - DETAIL_HEAD_CHARS - DETAIL_TAIL_CHARS
    notice = f'\n... [已省略 {omitted} 字符，共 {total_chars} 字符，AI 已完整处理] ...\n'
    return head + notice + tail
