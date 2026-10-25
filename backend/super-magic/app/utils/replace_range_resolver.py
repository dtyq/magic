"""替换区间解析工具

根据 replace_start/replace_end 在文件内容中定位唯一替换区间。
区间语义为 inclusive（包含边界锚点本身）。

锚点匹配采用四档梯度降级（via fuzzy_text_matcher）：精确匹配失败时自动
尝试归一化纠偏，并将纠偏警告通过 RangeResolution 传递给调用方。
"""

from dataclasses import dataclass, field
from typing import Optional

from app.utils.fuzzy_text_matcher import find_in_text


class RangeMatchError(ValueError):
    """A match failure with a stable code for tool-level recovery."""

    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ContextRange:
    """上下文解析结果"""

    start_index: int
    end_index: int
    start_line: int
    end_line: int


@dataclass
class AnchorResolution:
    """内部用：单个锚点的解析结果。

    positions: 锚点在文件内容中的所有起始位置
    actual_anchor: 实际匹配到的锚点文本（纠偏时与原始输入不同）
    warning: 发生了纠偏时的 AI 侧提示；无纠偏时为 None
    is_ambiguous: 归一化后匹配到了多个候选，不能自动纠偏
    """

    positions: list[int]
    actual_anchor: str
    warning: Optional[str]
    is_ambiguous: bool = False


@dataclass
class RangeResolution:
    """替换区间解析结果。

    matched_range: 解析出的替换区间
    warnings: 锚点纠偏时的 AI 提示列表（可能为空）
    """

    matched_range: ContextRange
    warnings: list[str] = field(default_factory=list)


def validate_non_overlapping_ranges(ranges: list[ContextRange]) -> None:
    """所有位置属于同一快照；相邻区间可同时修改，重叠或重复区间必须拒绝。"""
    ordered = sorted(enumerate(ranges), key=lambda item: (item[1].start_index, item[1].end_index))
    for (previous_index, previous), (current_index, current) in zip(ordered, ordered[1:]):
        if current.start_index < previous.end_index or current == previous:
            raise RangeMatchError(
                f"Ranges {previous_index + 1} and {current_index + 1} overlap. "
                "Use separate, non-overlapping ranges.",
                code="range_overlap",
            )


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


def _resolve_anchor(content: str, anchor: str) -> AnchorResolution:
    """解析单个锚点：先精确匹配，失败则尝试归一化纠偏。"""
    positions = _find_all_occurrences(content, anchor)
    if positions:
        return AnchorResolution(positions=positions, actual_anchor=anchor, warning=None)

    # 精确匹配失败，尝试归一化纠偏
    result = find_in_text(anchor, content)
    if result and result.actual != anchor:
        if result.match_count != 1:
            return AnchorResolution(
                positions=[],
                actual_anchor=anchor,
                warning=None,
                is_ambiguous=True,
            )
        positions = _find_all_occurrences(content, result.actual)
        return AnchorResolution(
            positions=positions,
            actual_anchor=result.actual,
            warning=result.warning,
            is_ambiguous=False,
        )

    return AnchorResolution(positions=[], actual_anchor=anchor, warning=None)


def resolve_replace_range(
    content: str,
    replace_start: str,
    replace_end: str,
) -> RangeResolution:
    """根据替换边界定位唯一替换区间。

    规则：
    - replace_start 和 replace_end 不能同时为空
    - 若 replace_start 为空：替换文件开头到 replace_end 结束（包含 replace_end）
    - 若 replace_end 为空：替换 replace_start 开始到文件结尾（包含 replace_start）
    - 若都不为空：替换 replace_start 开始到 replace_end 结束（包含两侧边界）

    Returns:
        RangeResolution（包含区间和纠偏警告列表）

    Raises:
        ValueError: 锚点无法唯一定位时
    """
    if replace_start == "" and replace_end == "":
        raise RangeMatchError("replace_start and replace_end cannot both be empty.", code="invalid_anchors")

    warnings: list[str] = []

    if replace_start == "":
        end_resolution = _resolve_anchor(content, replace_end)
        if end_resolution.warning:
            warnings.append(end_resolution.warning)
        if end_resolution.is_ambiguous:
            raise RangeMatchError(
                "replace_end is ambiguous after normalization. Make replace_end more specific.",
                code="range_ambiguous",
            )
        if len(end_resolution.positions) == 0:
            raise RangeMatchError("replace_end not found in file.", code="range_not_found")
        if len(end_resolution.positions) > 1:
            raise RangeMatchError(
                f"replace_end is ambiguous: found {len(end_resolution.positions)} matches. "
                "Make replace_end more specific.",
                code="range_ambiguous",
            )

        end_pos = end_resolution.positions[0]
        end_index = end_pos + len(end_resolution.actual_anchor)
        return RangeResolution(
            matched_range=ContextRange(
                start_index=0,
                end_index=end_index,
                start_line=1,
                end_line=_end_index_to_line(content, 0, end_index),
            ),
            warnings=warnings,
        )

    if replace_end == "":
        start_resolution = _resolve_anchor(content, replace_start)
        if start_resolution.warning:
            warnings.append(start_resolution.warning)
        if start_resolution.is_ambiguous:
            raise RangeMatchError(
                "replace_start is ambiguous after normalization. Make replace_start more specific.",
                code="range_ambiguous",
            )
        if len(start_resolution.positions) == 0:
            raise RangeMatchError("replace_start not found in file.", code="range_not_found")
        if len(start_resolution.positions) > 1:
            raise RangeMatchError(
                f"replace_start is ambiguous: found {len(start_resolution.positions)} matches. "
                "Make replace_start more specific.",
                code="range_ambiguous",
            )

        start_index = start_resolution.positions[0]
        end_index = len(content)
        return RangeResolution(
            matched_range=ContextRange(
                start_index=start_index,
                end_index=end_index,
                start_line=_index_to_line(content, start_index),
                end_line=_end_index_to_line(content, start_index, end_index),
            ),
            warnings=warnings,
        )

    start_resolution = _resolve_anchor(content, replace_start)
    end_resolution = _resolve_anchor(content, replace_end)

    if start_resolution.warning:
        warnings.append(start_resolution.warning)
    if end_resolution.warning:
        warnings.append(end_resolution.warning)
    if start_resolution.is_ambiguous:
        raise ValueError("replace_start is ambiguous after normalization. Make replace_start more specific.")
    if end_resolution.is_ambiguous:
        raise ValueError("replace_end is ambiguous after normalization. Make replace_end more specific.")

    if len(start_resolution.positions) == 0:
        raise ValueError("replace_start not found in file.")
    if len(end_resolution.positions) == 0:
        raise ValueError("replace_end not found in file.")

    candidates: list[tuple[int, int]] = []
    for start_pos in start_resolution.positions:
        for end_pos in end_resolution.positions:
            if end_pos >= start_pos:
                candidates.append((start_pos, end_pos + len(end_resolution.actual_anchor)))

    if len(candidates) == 0:
        raise RangeMatchError(
            "No valid range found: replace_start appears after all replace_end matches.",
            code="range_order_invalid",
        )
    if len(candidates) > 1:
        raise RangeMatchError(
            f"Replace range is ambiguous: found {len(candidates)} possible ranges. "
            "Make replace_start/replace_end more specific.",
            code="range_ambiguous",
        )

    start_index, end_index = candidates[0]
    return RangeResolution(
        matched_range=ContextRange(
            start_index=start_index,
            end_index=end_index,
            start_line=_index_to_line(content, start_index),
            end_line=_end_index_to_line(content, start_index, end_index),
        ),
        warnings=warnings,
    )
