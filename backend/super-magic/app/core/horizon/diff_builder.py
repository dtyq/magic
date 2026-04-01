"""文件变化检测：对比 LLM 上次读取的内容与当前文件内容，返回 <file> XML 块列表。

职责边界：只负责文件 diff 检测，不处理时间、通知或 XML 外层结构。
"""
from __future__ import annotations

import difflib
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.core.horizon.models import FileReadRecord, HorizonState

logger = get_logger(__name__)

# read_range 变化行数阈值：超过此数量输出摘要，否则输出完整 diff
FULL_DIFF_LINE_THRESHOLD = 30


def _read_file_lines(path: str, ranges: list[tuple[int, int]]) -> Optional[str]:
    """同步读取文件在指定 ranges 内的原始文本（无行号）。失败返回 None。"""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        result_lines: list[str] = []
        for start, end in ranges:
            if end == -1:
                result_lines.extend(all_lines[start:])
            else:
                result_lines.extend(all_lines[start:end])
        return "".join(result_lines)
    except Exception as e:
        logger.debug(f"[DiffBuilder] 读取文件失败 {path}: {e}")
        return None


def _build_file_diff_block(record: FileReadRecord, current_full_hash: str,
                            current_size: int) -> Optional[str]:
    """为单个文件构建 <file> XML 块。无变化返回 None。"""
    if record.full_file_hash == current_full_hash:
        return None

    path_str = record.path
    range_label = ", ".join(
        f"{s}-{'EOF' if e == -1 else e}" for s, e in record.read_ranges
    ) or "unknown"

    # write-only 记录（无内容快照），只报告文件变化
    if not record.read_content or not record.read_ranges:
        return (
            f'<file path="{path_str}" read_range="{range_label}">\n'
            f"  <note>File modified. Size: {record.file_size_bytes:,} → {current_size:,} bytes</note>\n"
            f"</file>"
        )

    current_content = _read_file_lines(path_str, record.read_ranges)
    if current_content is None:
        return (
            f'<file path="{path_str}" read_range="{range_label}">\n'
            f"  <note>File changed but could not be read for diff</note>\n"
            f"</file>"
        )

    old_lines = record.read_content.splitlines(keepends=True)
    new_lines = current_content.splitlines(keepends=True)

    if old_lines == new_lines:
        # 读取区域未变，其他区域变了
        size_info = f"File size: {record.file_size_bytes:,} → {current_size:,} bytes"
        return (
            f'<file path="{path_str}" read_range="{range_label}">\n'
            f"  <note>Modified outside your read range. {size_info}</note>\n"
            f"</file>"
        )

    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile=f"a/{Path(path_str).name}",
        tofile=f"b/{Path(path_str).name}",
        lineterm="",
    ))

    if not diff_lines:
        return None

    size_info = f"{record.file_size_bytes:,} → {current_size:,} bytes"

    if len(diff_lines) < FULL_DIFF_LINE_THRESHOLD:
        diff_text = "\n".join(diff_lines)
        return (
            f'<file path="{path_str}" read_range="{range_label}">\n'
            f"  <diff>\n{diff_text}\n  </diff>\n"
            f"</file>"
        )
    else:
        added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
        return (
            f'<file path="{path_str}" read_range="{range_label}">\n'
            f"  <summary>{added} lines added, {removed} lines removed in your read range. "
            f"File size: {size_info}</summary>\n"
            f"</file>"
        )


def detect_file_changes(
    state: HorizonState,
    current_hashes: dict[str, tuple[str, int]],  # abs_path → (hash, size)
) -> list[str]:
    """检测所有被追踪文件的变化，返回 <file> XML 块列表（无变化时返回空列表）。

    current_hashes 由调用方（AgentHorizon）预计算并传入，避免此模块直接做 IO。
    """
    blocks: list[str] = []
    for abs_path, record in state.file_records.items():
        cur_hash, cur_size = current_hashes.get(abs_path, ("", 0))
        if not cur_hash:
            continue
        block = _build_file_diff_block(record, cur_hash, cur_size)
        if block:
            blocks.append(block)
    return blocks
