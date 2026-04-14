"""文件变化检测：对比整文件快照与当前文件内容，返回 <file> XML 块列表。

变化表达三级退化：
  1. diff + size + mtime — 有整文件快照且 diff 可控
  2. diff_summary + size + mtime — 有快照但 diff 太大
  3. summary + size + mtime — 无快照或无法读取当前文件
"""
from __future__ import annotations

import difflib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from app.core.horizon.models import FileReadRecord, HorizonState
from app.utils.async_file_utils import async_try_read_text

logger = get_logger(__name__)

# diff 安全输出预算：三维同时满足才输出完整 diff，任一超限退化为 diff_summary
FULL_DIFF_LINE_THRESHOLD = 30
FULL_DIFF_CHAR_THRESHOLD = 16 * 1024
FULL_DIFF_SINGLE_LINE_CHAR_THRESHOLD = 2000


def _format_mtime(ms: float) -> str:
    if ms <= 0:
        return "unknown"
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _build_size_tag(old_size: int, new_size: int) -> str:
    return f"  <size>{old_size:,} -> {new_size:,} bytes</size>"


def _build_mtime_tag(old_mtime_ms: float, new_mtime_ms: float) -> str:
    return f"  <mtime>{_format_mtime(old_mtime_ms)} -> {_format_mtime(new_mtime_ms)}</mtime>"


def _build_summary_block(
    path_str: str,
    summary: str,
    old_size: int,
    new_size: int,
    old_mtime_ms: float,
    new_mtime_ms: float,
) -> str:
    return (
        f'<file path="{path_str}">\n'
        f"  <summary>{summary}</summary>\n"
        f"{_build_size_tag(old_size, new_size)}\n"
        f"{_build_mtime_tag(old_mtime_ms, new_mtime_ms)}\n"
        f"</file>"
    )


def _is_diff_payload_safe(diff_lines: list[str]) -> bool:
    """判断 diff 是否适合直接注入上下文（行数、总字符数、单行长度三维预算）。"""
    if len(diff_lines) >= FULL_DIFF_LINE_THRESHOLD:
        return False
    total_chars = sum(len(line) for line in diff_lines)
    if total_chars > FULL_DIFF_CHAR_THRESHOLD:
        return False
    if any(len(line) > FULL_DIFF_SINGLE_LINE_CHAR_THRESHOLD for line in diff_lines):
        return False
    return True


async def _read_current_file(path: str) -> Optional[str]:
    """异步读取整文件文本，失败返回 None。"""
    return await async_try_read_text(path)


async def _build_file_diff_block(
    record: FileReadRecord,
    current_file_hash: str,
    current_size: int,
    current_mtime_ms: float,
) -> Optional[str]:
    """为单个文件构建 <file> XML 块。无变化返回 None。"""
    if record.file_hash == current_file_hash:
        return None

    path_str = record.path

    # 没有整文件快照时，退化为 summary + size + mtime
    if not record.file_content:
        return _build_summary_block(
            path_str=path_str,
            summary="File changed since your last read",
            old_size=record.file_size_bytes,
            new_size=current_size,
            old_mtime_ms=record.file_mtime_ms,
            new_mtime_ms=current_mtime_ms,
        )

    current_content = await _read_current_file(path_str)
    if current_content is None:
        return _build_summary_block(
            path_str=path_str,
            summary="File changed since your last read; current content could not be read for diff",
            old_size=record.file_size_bytes,
            new_size=current_size,
            old_mtime_ms=record.file_mtime_ms,
            new_mtime_ms=current_mtime_ms,
        )

    old_lines = record.file_content.splitlines(keepends=True)
    new_lines = current_content.splitlines(keepends=True)

    if old_lines == new_lines:
        # hash 变了但文本相同（理论上罕见），仍然通知
        return _build_summary_block(
            path_str=path_str,
            summary="File changed since your last read",
            old_size=record.file_size_bytes,
            new_size=current_size,
            old_mtime_ms=record.file_mtime_ms,
            new_mtime_ms=current_mtime_ms,
        )

    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile=f"a/{Path(path_str).name}",
        tofile=f"b/{Path(path_str).name}",
        lineterm="",
    ))

    if not diff_lines:
        return None

    if _is_diff_payload_safe(diff_lines):
        diff_text = "\n".join(diff_lines)
        return (
            f'<file path="{path_str}">\n'
            f"  <diff>\n{diff_text}\n  </diff>\n"
            f"{_build_size_tag(record.file_size_bytes, current_size)}\n"
            f"{_build_mtime_tag(record.file_mtime_ms, current_mtime_ms)}\n"
            f"</file>"
        )
    else:
        added = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
        removed = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
        return (
            f'<file path="{path_str}">\n'
            f"  <diff_summary>{added} lines added, {removed} lines removed</diff_summary>\n"
            f"{_build_size_tag(record.file_size_bytes, current_size)}\n"
            f"{_build_mtime_tag(record.file_mtime_ms, current_mtime_ms)}\n"
            f"</file>"
        )


async def detect_file_changes(
    state: HorizonState,
    current_hashes: dict[str, tuple[str, int]],
    current_mtimes: dict[str, float],
) -> list[str]:
    """检测所有被追踪文件的变化，返回 <file> XML 块列表。"""
    blocks: list[str] = []
    for abs_path, record in state.file_records.items():
        cur_hash, cur_size = current_hashes.get(abs_path, ("", 0))
        cur_mtime_ms = current_mtimes.get(abs_path, 0.0)
        if not cur_hash:
            continue
        block = await _build_file_diff_block(record, cur_hash, cur_size, cur_mtime_ms)
        if block:
            blocks.append(block)
    return blocks
