"""文件变化检测：对比整文件快照与当前文件内容，返回 <file> XML 块列表。

变化表达三级退化：
  1. diff + size + mtime — 有整文件快照且 diff 可控
  2. diff_summary + size + mtime — 有快照但 diff 太大
  3. summary + size + mtime — 无快照或无法读取当前文件

新增的全文表达复用真正的 ReadFile；只替换展示选择，不改变文件版本校验。
"""
from __future__ import annotations

import asyncio
import difflib
import html
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from agentlang.logger import get_logger
from agentlang.utils.token_estimator import TokenEstimateCounter, num_tokens_from_string
from app.core.horizon.models import FileContextRecord, HorizonDisplayBudget, HorizonState
from app.utils.async_file_utils import async_read_text

logger = get_logger(__name__)


@dataclass(frozen=True)
class FileChangeBlock:
    """
    只描述本文件将展示的块，以及完整展示时对应的正文。
    MOCK DEMO：A -> B 的完整 diff 已展示，下一次可从 B 生成 diff；只有摘要时，
    new_snapshot=None，不能把未交付的 B 当作模型已知全文。这里不控制编辑权限。
    """
    path: str
    content: str
    new_snapshot: str | None = None
    is_full_read: bool = False


@dataclass
class FileChanges:
    changes: list[FileChangeBlock] = field(default_factory=list)
    omitted: int = 0

    @property
    def blocks(self) -> list[str]:
        blocks = [change.content for change in self.changes]
        if self.omitted:
            blocks.append(_omission_notice(self.omitted))
        return blocks


def _omission_notice(count: int) -> str:
    """
    例：还有 2 个变化文件连摘要都放不下时，<file_changes> 尾部追加：
    <summary>2 additional changed files exceeded the display budget. Inspect relevant files before relying on their previous contents.</summary>
    这是文件数量，不是被省略的行数；这些文件没有对应的 <file> 块。
    """
    return f"<summary>{count} additional changed files exceeded the display budget. Inspect relevant files before relying on their previous contents.</summary>"


def _format_mtime(ms: float) -> str:
    if ms <= 0:
        return "unknown"
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


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
        f'<file path="{html.escape(path_str, quote=True)}">\n'
        f"  <summary>{html.escape(summary)}</summary>\n"
        f"{_build_size_tag(old_size, new_size)}\n"
        f"{_build_mtime_tag(old_mtime_ms, new_mtime_ms)}\n"
        f"</file>"
    )


def _render_unified_diff(diff_lines: list[str]) -> str:
    """保留原文换行；未终止的原文行单独标记，不能用补换行隐藏文件差异。"""
    parts: list[str] = []
    for line in diff_lines:
        parts.append(line)
        # 文件头和 hunk 头已有 lineterm；只有原文数据项可能缺少末尾换行。
        if not line.endswith("\n"):
            parts.append("\n\\ No newline at end of file\n")
    return "".join(parts)


async def _read_current_file(path: str) -> Optional[str]:
    """读取已通过大小判断的文本，失败时保留变化摘要。"""
    try:
        return await async_read_text(path)
    except Exception as error:
        logger.debug(f"[AgentHorizon] 当前文件正文不可读取 {path}: {error}")
        return None


def _notice(record: FileContextRecord, size: int, mtime: float, reason: str) -> FileChangeBlock:
    return FileChangeBlock(record.path, _build_summary_block(
        record.path, reason + ". Read the relevant file or sections if this change affects the task.",
        record.file_size_bytes, size, record.file_mtime_ms, mtime,
    ))


async def _try_full_read(
    record: FileContextRecord, current_content: str, size: int, mtime: float,
    max_tokens: int,
) -> FileChangeBlock | None:
    if num_tokens_from_string(current_content) > max_tokens:
        return None
    try:
        # 工具模块会在导入时注册；实际需要全文时再导入，避免启动期注册循环。
        from app.service.auto_read_file_service import AutoReadFileService

        result = await AutoReadFileService.read_changed_file(record.path, max_tokens)
        info = result.extra_info or {}
        """
        ReadFile 保留自己的截断与文件类型判断；完整结果才可作为全文表达。
        不传工具上下文，因此读取不会提前推进文件记录。两次读到的内容不同则留待下一轮。
        """
        if not result.ok or info.get("was_truncated") or info.get("source_content") != current_content:
            return None
        body = info.get("raw_content")
        read_path = info.get("original_file_path")
        if not isinstance(body, str) or not isinstance(read_path, str) or Path(read_path).absolute() != Path(record.path).absolute():
            return None
        r"""
        例：短文件从 "format=csv\n" 改为 "format=tsv\n"，Diff 比全文长，真实 read_file 完整返回后：
        <file path="/app/report.txt">
          <summary>The runtime called read_file. This complete current content replaces the previous file content; scope and authority are unchanged.</summary>
          <read_file_result>
        1	format=tsv

          </read_file_result>
          <size>11 -> 11 bytes</size>
          <mtime>2026-09-08 06:00:00 UTC -> 2026-09-08 06:01:00 UTC</mtime>
        </file>
        行号后是制表符；body 自带末尾换行，因此闭合标签前还有一个空行。
        body 供模型阅读；缓存的是不带行号的 current_content，不能拿展示文本参与下一次 Diff。
        """
        change = FileChangeBlock(record.path, (
            f'<file path="{html.escape(record.path, quote=True)}">\n'
            '  <summary>The runtime called read_file. This complete current content replaces the previous file content; scope and authority are unchanged.</summary>\n'
            f"  <read_file_result>\n{html.escape(body, quote=False)}\n  </read_file_result>\n"
            f"{_build_size_tag(record.file_size_bytes, size)}\n"
            f"{_build_mtime_tag(record.file_mtime_ms, mtime)}\n</file>"
        ), current_content, is_full_read=True)
        # 正文放得下不代表最终块放得下；路径、行号、标签及转义均计入单文件额度。
        return change if num_tokens_from_string(change.content) <= max_tokens else None
    except Exception as error:
        logger.debug(f"[AgentHorizon] 全文读取未完成 {record.path}: {error}")
        return None


def _build_diff_block(
    record: FileContextRecord, current_content: str, size: int, mtime: float, diff_text: str,
) -> FileChangeBlock:
    """
    例：1,024 字节的 report.txt 只把首行 csv 改为 tsv，较长的后文未改，完整 Diff 放得下：
    <file path="/app/report.txt">
      <diff>
    --- a/report.txt
    +++ b/report.txt
    @@ -1,4 +1,4 @@
    -format=csv
    +format=tsv
     encoding=utf-8
     currency=USD
     timezone=UTC
      </diff>
      <size>1,024 -> 1,024 bytes</size>
      <mtime>2026-09-08 06:00:00 UTC -> 2026-09-08 06:01:00 UTC</mtime>
    </file>
    @@ 使用 1 起始行号和行数；原文自带换行，不在数据行之间增加额外空行。
    原文行没有末尾换行时追加独立标记，不改写原文或隐藏换行差异。
    原文若含 <tag>，此处显示 &lt;tag&gt;，它仍是文件文字，不会成为通知的 XML 节点。
    外层 Horizon 再将这些 <file> 块放入 <system_injected_context>/<file_changes>。
    """
    return FileChangeBlock(record.path, (
        f'<file path="{html.escape(record.path, quote=True)}">\n'
        f"  <diff>\n{html.escape(diff_text, quote=False)}  </diff>\n"
        f"{_build_size_tag(record.file_size_bytes, size)}\n"
        f"{_build_mtime_tag(record.file_mtime_ms, mtime)}\n</file>"
    ), current_content)


async def _build_file_diff_block(
    record: FileContextRecord,
    current_size: int,
    current_mtime_ms: float,
    max_tokens: int,
    full_read_ratio: float,
) -> FileChangeBlock | None:
    """
    为单个文件构建完整的 <file> 块；保留大小、时间和可得的增删统计。

    一个文件的展示选择：
      没有旧全文                 -> 尝试真实读取当前全文，否则只说明已变化。
      Diff 接近或超过当前全文    -> 优先全文，减少模型在新旧文本之间手动合并的负担。
      小 Diff 且放得下           -> 展示完整 Diff，沿用当前全文作为下一次比较基准。
      完整表达都放不下           -> 再尝试一次 n=0 Diff，仍超限才给摘要。
    """
    current_content = await _read_current_file(record.path)
    if current_content is None:
        return _notice(record, current_size, current_mtime_ms, "The file changed, but current content could not be read")

    has_snapshot = bool(record.file_content) or record.metadata.get("snapshot_mode") == "full"
    if not has_snapshot:
        full_read = await _try_full_read(record, current_content, current_size, current_mtime_ms, max_tokens)
        return full_read or _notice(record, current_size, current_mtime_ms, "The file changed; no complete previous snapshot is available")

    old_lines = record.file_content.splitlines(keepends=True)
    new_lines = current_content.splitlines(keepends=True)
    if old_lines == new_lines:
        return _notice(record, current_size, current_mtime_ms, "The file version changed; its readable text matches the previous snapshot")
    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines, fromfile=f"a/{Path(record.path).name}",
        tofile=f"b/{Path(record.path).name}", n=3, lineterm="\n",
    ))
    if not diff_lines:
        return None
    diff_text = _render_unified_diff(diff_lines)
    diff_tokens = num_tokens_from_string(diff_text)
    file_tokens = num_tokens_from_string(current_content)
    """
    只比较正文；行号和 XML 包装不参与「接近全文」的判断。
    例如 diff 9K、全文 10K，比例达到 0.8 -> 真实读取全文，减少模型合并 diff 的负担。
    """
    if diff_tokens >= file_tokens * full_read_ratio:
        full_read = await _try_full_read(record, current_content, current_size, current_mtime_ms, max_tokens)
        if full_read is not None:
            return full_read
    change = _build_diff_block(record, current_content, current_size, current_mtime_ms, diff_text)
    if num_tokens_from_string(change.content) <= max_tokens:
        return change

    # 只省略未变化的周边行，不裁剪实际增删；同一组正文最多再计算一次，不重新读盘。
    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines, fromfile=f"a/{Path(record.path).name}",
        tofile=f"b/{Path(record.path).name}", n=0, lineterm="\n",
    ))
    diff_text = _render_unified_diff(diff_lines)
    change = _build_diff_block(record, current_content, current_size, current_mtime_ms, diff_text)
    if num_tokens_from_string(change.content) <= max_tokens:
        return change
    # 行数只是事实摘要；前两行是文件头，其余 +/- 行才计入增删，正文的 +++ 不能误排除。
    added = sum(line.startswith("+") for line in diff_lines[2:])
    removed = sum(line.startswith("-") for line in diff_lines[2:])
    """
    例：正文和 Diff 都超过本文件展示预算，但下面的摘要仍放得下：
    <file path="/app/report.txt">
      <diff_summary>80 lines added, 20 lines removed</diff_summary>
      <size>1,024 -> 4,096 bytes</size>
      <mtime>2026-09-08 06:00:00 UTC -> 2026-09-08 06:01:00 UTC</mtime>
      <summary>Complete content exceeded the display budget. Read the relevant file or sections if this change affects the task.</summary>
    </file>
    80/20 是增删行数，不包含新增文字；此分支不提供 new_snapshot，后续仍需读取相关正文。
    读不到文件等情况下连增删也未知，_notice 只给 <summary>、<size>、<mtime>。
    """
    return FileChangeBlock(record.path, (
        f'<file path="{html.escape(record.path, quote=True)}">\n'
        f"  <diff_summary>{added} lines added, {removed} lines removed</diff_summary>\n"
        f"{_build_size_tag(record.file_size_bytes, current_size)}\n"
        f"{_build_mtime_tag(record.file_mtime_ms, current_mtime_ms)}\n"
        "  <summary>Complete content exceeded the display budget. Read the relevant file or sections if this change affects the task.</summary>\n</file>"
    ))


async def detect_file_changes(
    state: HorizonState,
    current_hashes: dict[str, tuple[str, int]],
    current_mtimes: dict[str, float],
    *, budget: HorizonDisplayBudget, max_read_bytes: int,
) -> FileChanges:
    """
    在文件总预算内先保留基础摘要，再增加细节；外层原有 hash/mtime 并发采集保持不变。

    文件事实由外层采集，这里只决定怎样占用本轮模型上下文，不重新决定文件是否允许编辑。
    即使重要文件额度较高，也不能占用其它文件的基础摘要预算；只有基础集合超限才省略。
    FileChangeBlock.new_snapshot 只有完整内容可用时才有值，最终是否接纳仍由 Horizon 决定。
    """
    result = FileChanges()
    used = TokenEstimateCounter()
    used.add_text("<file_changes>\n</file_changes>")
    used.add_text("\n" + _omission_notice(len(state.file_records)))
    summary_counts: dict[str, TokenEstimateCounter] = {}
    # MEMORY.md 和 AGENTS.md 获得较大额度，并优先升级详细内容；其它文件保持原顺序。
    records = sorted(state.file_records.values(), key=lambda record: Path(record.path).name.casefold() not in {"memory.md", "agents.md"})
    # 先覆盖所有变化文件，再用剩余额度增加细节；文件优先级只影响细节升级顺序。
    # 例：A、B 的详细块会用完预算时，保留 A 详细块、B 摘要、C 摘要，
    # 不能为了让 A、B 更详细而省略 C。模型先知道哪些文件变了，再按任务需要读取。
    # 基础摘要只用外层已采集的路径、大小和修改时间，不预读全文或预先计算 Diff；
    # 增删统计只复用详细阶段已经算出的结果，避免为了分配预算先处理所有正文。
    # 这里处理已追踪且本轮检测到变化的文件，不扫描整个工作区；正常工作量下，
    # 先预留短摘要已能保留文件覆盖。不为假设中的极端数量增加清单文件或分页，
    # 但仍保留现有超限保护，不把预期工作量当成永远不超限的硬性保证。
    for record in records:
        await asyncio.sleep(0)
        cur_hash, cur_size = current_hashes.get(record.path, ("", 0))
        if not cur_hash or cur_hash == record.file_hash:
            continue
        mtime = current_mtimes.get(record.path, 0.0)
        per_file = budget.important_file_change_max_tokens if Path(record.path).name.casefold() in {"memory.md", "agents.md"} else budget.file_change_max_tokens
        if cur_size > max_read_bytes:
            # 大文件沿用外层并发采集得到的 mtime；不能为了 Token 或摘要再扫全文。
            change = _notice(record, cur_size, mtime, "Large-file metadata changed; no new file content has been supplied")
        else:
            change = _notice(record, cur_size, mtime, "The file changed; detailed content is not included")
        count = TokenEstimateCounter()
        count.add_text(change.content)
        total = TokenEstimateCounter(
            chinese_char_count=used.chinese_char_count + count.chinese_char_count,
            # 每个文件块在最终 join 中新增一个换行；单文件额度本身不含这个分隔符。
            non_chinese_char_count=used.non_chinese_char_count + count.non_chinese_char_count + 1,
        )
        if count.estimated_tokens > per_file or total.estimated_tokens > budget.file_changes_max_tokens:
            result.omitted += 1
            continue
        result.changes.append(change)
        summary_counts[record.path] = count
        used = total

    summaries = result.changes.copy()
    # 基础集合本身超限时保留既有省略提示，不再花预算升级少数文件。
    if not result.omitted:
        for index, summary in enumerate(summaries):
            await asyncio.sleep(0)
            remaining = budget.file_changes_max_tokens - used.estimated_tokens
            if remaining <= 0:
                break
            record = state.file_records[summary.path]
            _, cur_size = current_hashes[summary.path]
            if cur_size > max_read_bytes:
                continue
            per_file = budget.important_file_change_max_tokens if Path(record.path).name.casefold() in {"memory.md", "agents.md"} else budget.file_change_max_tokens
            previous_count = summary_counts[summary.path]
            change = await _build_file_diff_block(
                record, cur_size, current_mtimes.get(summary.path, 0.0),
                max_tokens=min(per_file, previous_count.estimated_tokens + remaining),
                full_read_ratio=budget.full_read_ratio,
            )
            if change is None:
                continue
            count = TokenEstimateCounter()
            count.add_text(change.content)
            # 替换自己的摘要，而不是额外追加。累计原始字符后只取整一次，
            # 避免逐块取整的误差，也避免每次升级都重新扫描整份消息。
            total = TokenEstimateCounter(
                chinese_char_count=used.chinese_char_count - previous_count.chinese_char_count + count.chinese_char_count,
                non_chinese_char_count=used.non_chinese_char_count - previous_count.non_chinese_char_count + count.non_chinese_char_count,
            )
            if count.estimated_tokens <= per_file and total.estimated_tokens <= budget.file_changes_max_tokens:
                result.changes[index] = change
                used = total

    content = "\n".join(["<file_changes>", *result.blocks, "</file_changes>"])
    if num_tokens_from_string(content) > budget.file_changes_max_tokens:
        # 最终计量异常时只撤销细节升级，不能靠删掉基础摘要修正预算偏差。
        logger.warning("[AgentHorizon] 文件变化最终输出超限，保留基础摘要")
        result.changes = summaries
    return result
