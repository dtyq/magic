"""
替换区间解析工具

用于根据 replace_start/replace_end 在文件内容中定位唯一替换区间。
区间语义为 inclusive（包含边界锚点本身）。
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ContextRange:
    """上下文解析结果"""

    start_index: int
    end_index: int
    start_line: int
    end_line: int


def _find_all_occurrences(content: str, needle: str) -> list[int]:
    """查找子串在内容中的所有起始位置"""
    if not needle:
        return []

    positions: list[int] = []
    start = 0
    while True:
        idx = content.find(needle, start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + 1
    return positions


def _index_to_line(content: str, index: int) -> int:
    """将字符索引转换为 1-based 行号"""
    safe_index = max(0, min(index, len(content)))
    return content.count("\n", 0, safe_index) + 1


def _end_index_to_line(content: str, start_index: int, end_index: int) -> int:
    """将区间结束索引（exclusive）转换为区间结束行号（inclusive）"""
    if end_index <= start_index:
        return _index_to_line(content, start_index)
    return _index_to_line(content, end_index - 1)


def resolve_replace_range(content: str, replace_start: str, replace_end: str) -> ContextRange:
    """
    根据替换边界定位唯一替换区间

    规则：
    - replace_start 和 replace_end 不能同时为空
    - 若 replace_start 为空：替换文件开头到 replace_end 结束（包含 replace_end）
    - 若 replace_end 为空：替换 replace_start 开始到文件结尾（包含 replace_start）
    - 若都不为空：替换 replace_start 开始到 replace_end 结束（包含两侧边界）
    """
    if replace_start == "" and replace_end == "":
        raise ValueError("replace_start and replace_end cannot both be empty.")

    if replace_start == "":
        end_positions = _find_all_occurrences(content, replace_end)
        if len(end_positions) == 0:
            raise ValueError("replace_end not found in file.")
        if len(end_positions) > 1:
            raise ValueError(
                f"replace_end is ambiguous: found {len(end_positions)} matches. "
                "Make replace_end more specific."
            )

        end_pos = end_positions[0]
        end_index = end_pos + len(replace_end)
        return ContextRange(
            start_index=0,
            end_index=end_index,
            start_line=1,
            end_line=_end_index_to_line(content, 0, end_index),
        )

    if replace_end == "":
        start_positions = _find_all_occurrences(content, replace_start)
        if len(start_positions) == 0:
            raise ValueError("replace_start not found in file.")
        if len(start_positions) > 1:
            raise ValueError(
                f"replace_start is ambiguous: found {len(start_positions)} matches. "
                "Make replace_start more specific."
            )

        start_index = start_positions[0]
        end_index = len(content)
        return ContextRange(
            start_index=start_index,
            end_index=end_index,
            start_line=_index_to_line(content, start_index),
            end_line=_end_index_to_line(content, start_index, end_index),
        )

    start_positions = _find_all_occurrences(content, replace_start)
    end_positions = _find_all_occurrences(content, replace_end)

    if len(start_positions) == 0:
        raise ValueError("replace_start not found in file.")
    if len(end_positions) == 0:
        raise ValueError("replace_end not found in file.")

    candidates: list[tuple[int, int]] = []
    for start_pos in start_positions:
        for end_pos in end_positions:
            if end_pos >= start_pos:
                candidates.append((start_pos, end_pos + len(replace_end)))

    if len(candidates) == 0:
        raise ValueError("No valid range found: replace_start appears after all replace_end matches.")
    if len(candidates) > 1:
        raise ValueError(
            f"Replace range is ambiguous: found {len(candidates)} possible ranges. "
            "Make replace_start/replace_end more specific."
        )

    start_index, end_index = candidates[0]
    return ContextRange(
        start_index=start_index,
        end_index=end_index,
        start_line=_index_to_line(content, start_index),
        end_line=_end_index_to_line(content, start_index, end_index),
    )
