"""统一文本纠偏匹配设施。

解决模型输出与实际文件内容存在轻微归一化偏差时的匹配问题，支持：
- 中英文标点混淆（`，` vs `,` 等）
- Unicode 特殊空白字符（全角空格 U+3000 等）
- 中英文/数字边界多余空格（如 `topic 主题` vs `topic主题`）

匹配梯度（精确优先，逐档降级，仅在精确命中失败后触发）：
  档 1：原样精确匹配
  档 2：去行尾空白后匹配
  档 3：去首尾空白后匹配
  档 4：双边归一化比较，再通过索引映射回到原文真实子串

设计原则：
- 纠偏只在精确匹配失败后触发，永远是 fallback
- 命中后返回文件中的真实子串，不是归一化版本
- 归一化不做全量去空格，只处理 CJK-ASCII 边界
- 不使用编辑距离、模糊打分或正则扩展等重型机制
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import re

@dataclass
class TextMatchResult:
    """文本纠偏匹配结果。

    actual: 文件中的真实子串，用于后续替换
    warning: AI 侧英文纠偏提示；精确命中时为 None
    match_count: 该候选在匹配层面出现的次数，用于判断是否唯一
    """

    actual: str
    warning: Optional[str]
    match_count: int = 1


@dataclass
class FileMatchResult:
    """文件名模糊匹配结果。

    path: 匹配到的文件路径
    warning: AI 侧英文纠偏提示
    """

    path: Path
    warning: str


@dataclass
class NormalizedText:
    """带原文索引映射的归一化文本。

    text: 归一化后的文本
    index_map: 归一化后每个字符对应原文中的起始索引
    """

    text: str
    index_map: list[int]


# 合并自原 file_path_fuzzy_matcher.py 和 punctuation_matcher.py 的中文标点表
# 统一用此表，两个旧文件都将改为复用此处的规则
PUNCTUATION_MAP: dict[str, str] = {
    '，': ',',
    '。': '.',
    '：': ':',
    '；': ';',
    '！': '!',
    '？': '?',
    '（': '(',
    '）': ')',
    '"': '"',
    '"': '"',
    ''': "'",
    ''': "'",
    '《': '<',
    '》': '>',
    '【': '[',
    '】': ']',
    '、': ',',
    '—': '-',
    '－': '-',
    '｛': '{',
    '｝': '}',
}

# Unicode 特殊空白字符，统一映射为普通空格
# 参考 openclaw apply-patch-update.ts normalizePunctuation 的覆盖范围
_UNICODE_SPACES: frozenset[str] = frozenset({
    '\u00A0',  # non-breaking space
    '\u2002',  # en space
    '\u2003',  # em space
    '\u2004',  # three-per-em space
    '\u2005',  # four-per-em space
    '\u2006',  # six-per-em space
    '\u2007',  # figure space
    '\u2008',  # punctuation space
    '\u2009',  # thin space
    '\u200A',  # hair space
    '\u202F',  # narrow no-break space
    '\u205F',  # medium mathematical space
    '\u3000',  # ideographic space（全角空格）
})

# CJK 统一汉字基本区 + 扩展 A
_CJK_RANGE = r'\u4e00-\u9fff\u3400-\u4dbf'
_CJK_RE = re.compile(rf'[{_CJK_RANGE}]')


def normalize_for_match(text: str) -> str:
    """将文本归一化为用于模糊匹配的比较键。

    顺序：
      1. 中文标点 → 英文标点（1:1 字符替换，不改变长度分布）
      2. Unicode 特殊空白 → 普通空格（1:1 字符替换）
      3. CJK-ASCII/数字 边界多余空格移除（变长操作，最后执行）

    注意：不做全量去空格；调用方负责决定是否处理 .md 行尾两空格等特殊场景。
    """
    return normalize_with_index_map(text).text


def _normalize_char(ch: str) -> str:
    """归一化单个字符，保持 1:1 映射。"""
    if ch in PUNCTUATION_MAP:
        return PUNCTUATION_MAP[ch]
    if ch in _UNICODE_SPACES or ch == "\t":
        return " "
    return ch


def _is_cjk_ascii_boundary(left: Optional[str], right: Optional[str]) -> bool:
    """判断左右字符是否构成 CJK ↔ ASCII/数字 边界。"""
    if not left or not right:
        return False
    cjk_to_ascii = _CJK_RE.match(left) and re.match(r"[a-zA-Z0-9]", right)
    ascii_to_cjk = re.match(r"[a-zA-Z0-9]", left) and _CJK_RE.match(right)
    return bool(cjk_to_ascii or ascii_to_cjk)


def normalize_with_index_map(text: str) -> NormalizedText:
    """归一化文本，并保留归一化字符到原文索引的映射。

    这里不使用正则扩展匹配，而是：
    1. 先做 1:1 字符归一化（标点、特殊空白）
    2. 再删除 CJK-ASCII 边界的空格 run
    3. 同时记录归一化后每个字符来自原文的哪个索引
    """
    stage1_chars: list[str] = []
    stage1_indexes: list[int] = []
    for idx, ch in enumerate(text):
        stage1_chars.append(_normalize_char(ch))
        stage1_indexes.append(idx)

    result_chars: list[str] = []
    result_indexes: list[int] = []
    i = 0
    while i < len(stage1_chars):
        current = stage1_chars[i]
        if current != " ":
            result_chars.append(current)
            result_indexes.append(stage1_indexes[i])
            i += 1
            continue

        run_end = i
        while run_end + 1 < len(stage1_chars) and stage1_chars[run_end + 1] == " ":
            run_end += 1

        prev_char = stage1_chars[i - 1] if i > 0 else None
        next_char = stage1_chars[run_end + 1] if run_end + 1 < len(stage1_chars) else None
        if _is_cjk_ascii_boundary(prev_char, next_char):
            i = run_end + 1
            continue

        for j in range(i, run_end + 1):
            result_chars.append(" ")
            result_indexes.append(stage1_indexes[j])
        i = run_end + 1

    return NormalizedText(text="".join(result_chars), index_map=result_indexes)


def _find_all_occurrences(haystack: str, needle: str) -> list[int]:
    """查找 needle 在 haystack 中的所有起始位置。"""
    if not needle:
        return []

    positions: list[int] = []
    start = 0
    while True:
        idx = haystack.find(needle, start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + 1
    return positions


def find_in_text(
    needle: str,
    haystack: str,
) -> Optional[TextMatchResult]:
    """在 haystack 中查找 needle，采用四档梯度降级匹配。

    Returns:
        None 表示未找到；
        TextMatchResult.warning 为 None 表示精确命中，非 None 表示发生了纠偏。
    """
    if not needle:
        return None

    # 档 1：原样精确
    if needle in haystack:
        return TextMatchResult(actual=needle, warning=None)

    # 档 2：needle 去行尾空白
    needle_rstrip = needle.rstrip()
    if needle_rstrip and needle_rstrip != needle and needle_rstrip in haystack:
        return TextMatchResult(actual=needle_rstrip, warning=_build_warning(needle, needle_rstrip))

    # 档 3：needle 去首尾空白
    needle_strip = needle.strip()
    if needle_strip and needle_strip != needle_rstrip and needle_strip in haystack:
        return TextMatchResult(actual=needle_strip, warning=_build_warning(needle, needle_strip))

    # 档 4：双边归一化比较，再通过索引映射回到原文真实子串
    base = needle_strip if needle_strip else needle
    normalized_needle = normalize_for_match(base)
    normalized_haystack = normalize_with_index_map(haystack)

    if normalized_needle:
        positions = _find_all_occurrences(normalized_haystack.text, normalized_needle)
        if positions:
            start = positions[0]
            end = start + len(normalized_needle)
            start_index = normalized_haystack.index_map[start]
            end_index = normalized_haystack.index_map[end - 1] + 1
            actual = haystack[start_index:end_index]
            if actual != needle:
                return TextMatchResult(
                    actual=actual,
                    warning=_build_warning(needle, actual),
                    match_count=len(positions),
                )

    return None


def find_unique_in_filenames(
    target_name: str,
    directory: Path,
) -> Optional[FileMatchResult]:
    """在 directory 下查找与 target_name 归一化等价的文件，唯一命中才返回。

    Returns:
        None 表示未找到或命中多个；FileMatchResult 表示唯一命中。
    """
    if not directory.exists() or not directory.is_dir():
        return None

    target_norm = normalize_for_match(target_name)

    matches: list[Path] = []
    try:
        for entry in directory.iterdir():
            if entry.is_file() and normalize_for_match(entry.name) == target_norm:
                matches.append(entry)
    except OSError:
        return None

    if len(matches) != 1:
        return None

    matched = matches[0]
    return FileMatchResult(path=matched, warning=_build_warning(target_name, matched.name))


def _build_warning(original: str, corrected: str) -> str:
    """统一的模型侧纠偏提示（英文，进入模型上下文）。"""
    return (
        f"**Auto-Correction Applied**\n\n"
        f"The input did not match exactly; a normalized equivalent was found.\n\n"
        f"- Your input: `{original}`\n"
        f"- Matched: `{corrected}`\n\n"
        f"**IMPORTANT**: Use `{corrected}` in future requests to avoid repeated corrections."
    )
