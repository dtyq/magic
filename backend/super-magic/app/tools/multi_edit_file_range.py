"""
区间批量编辑工具

通过 replace_start/replace_end 一次性完成同一文件内多个片段替换（包含边界）。
"""

from app.i18n import i18n
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from agentlang.utils.syntax_checker import SyntaxChecker
from app.utils.diff_generator import DiffGenerator
from app.utils.replace_range_resolver import ContextRange, resolve_replace_range

logger = get_logger(__name__)


class RangeEditChunk(BaseModel):
    """<!--zh: 单个区间编辑片段-->
    Single range edit chunk"""

    replace_start: str = Field(
        ...,
        description="<!--zh: 替换区间起始锚点文本。该锚点会被包含在替换范围内。可为空，与 replace_end 不能同时为空。-->Start anchor text of the replacement range. This anchor is included in replaced range. Can be empty. Cannot be empty together with replace_end."
    )
    replace_end: str = Field(
        ...,
        description="<!--zh: 替换区间结束锚点文本。该锚点会被包含在替换范围内。可为空，与 replace_start 不能同时为空。-->End anchor text of the replacement range. This anchor is included in replaced range. Can be empty. Cannot be empty together with replace_start."
    )
    new_content: str = Field(
        ...,
        description="<!--zh: 用于替换目标区间的新内容。-->New content to replace the target range."
    )


class MultiEditFileRangeParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="<!--zh: 要修改的文件的绝对路径-->The absolute path to the file to modify"
    )
    chunks: List[RangeEditChunk] = Field(
        ...,
        description="<!--zh: 区间编辑片段数组，按原始文件内容解析并原子性执行。-->Array of range edit chunks, resolved on original file content and applied atomically.",
        min_items=1
    )


@dataclass(frozen=True)
class ResolvedChunk:
    chunk_index: int
    range_info: ContextRange
    new_content: str


@tool()
class MultiEditFileRange(AbstractFileTool[MultiEditFileRangeParams], WorkspaceTool[MultiEditFileRangeParams]):
    """<!--zh
    基于替换边界的批量编辑工具，一次调用完成同一文件多个片段替换。
    适合多处长片段编辑，避免多轮编辑时定位漂移。
    此工具用于编辑现有文件，使用 write_file 创建新文件。
    -->
    Range-based batch editing tool for replacing multiple fragments in one file call.
    Best for multi-location long-fragment edits and avoiding position drift across edit rounds.
    This tool is for editing existing files. Use write_file to create new files.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
工具选择指南：
- 使用 multi_edit_file：多处短文本精确替换（单词、短句、变量名/函数名）
- 使用 multi_edit_file_range：多处长片段替换（按 chunk 评估 old_string）

同一文件有多处修改时优先用本工具，比多次调用 edit_file_range 更稳更省 token。

必须遵循的工作流程：
1. 基于同一份原始文件快照规划全部 chunk
2. 每个 chunk 至少提供一个替换锚点（replace_start/replace_end 不能同时为空）
3. 每个 chunk 都要满足「文本唯一（确实是目标块）」
4. 调用前先检查 inclusive 重叠：按 start 排序后，若 next.start < prev.end 即冲突
5. 一次调用完成，不要在 chunk 之间反复读取文件

关键约束：
- 每个 chunk 的被替换内容（old_string）至少满足其一：
  1) >= 5 行
  2) >= 200 字符
- 对不满足上条的短替换，改用 multi_edit_file 或 edit_file
- 每个 chunk 的 replace_start 与 replace_end（非空时）各自至少满足其一：
  1) >= 3 行
  2) >= 80 字符
- 空 start 或空 end 是允许的边界模式，不受上条最小长度限制
- 锚点必须直接复制原文，不带行号前缀，不改空格/标点/大小写
- 每个 chunk 都必须唯一命中（0 或 >1 都会失败）
- chunk 目标区间不能重叠；共享同一边界标记通常也会冲突（因包含边界）
- 原子性：任一 chunk 失败则整体失败
-->
Tool selection guide:
- Use multi_edit_file: multiple precise short-text replacements (words/phrases, variable or function names)
- Use multi_edit_file_range: multi-location long-fragment replacement (evaluate per chunk old_string)

Preferred for multiple edits in one file; usually more stable and token-efficient than repeated edit_file_range calls.

Required workflow:
1. Plan all chunks on the same original snapshot
2. Each chunk must provide at least one anchor (replace_start/replace_end cannot both be empty)
3. Every chunk must be text-unique (targeting intended block)
4. Check inclusive overlap before call: after sorting by start, if next.start < prev.end, it conflicts
5. Complete in one call; do not re-read file between chunks

Key constraints:
- The replaced content (old_string) for each chunk must meet at least one threshold:
  1) >= 5 lines
  2) >= 200 characters
- For chunks below both thresholds, use multi_edit_file or edit_file instead
- For non-empty anchors, replace_start and replace_end of each chunk must each meet at least one threshold:
  1) >= 3 lines
  2) >= 80 characters
- Empty start or empty end is allowed for boundary mode and is exempt from the minimum-length rule
- Copy anchors directly from file text, without line-number prefixes and without changing spaces/punctuation/case
- Every chunk must match uniquely (0 or >1 fails)
- Chunk target ranges cannot overlap; reusing the same boundary marker often conflicts under inclusive semantics
- Atomic operation: any chunk failure means all fail
"""

    async def execute(self, tool_context: ToolContext, params: MultiEditFileRangeParams) -> ToolResult:
        """
        Execute batch range editing operation

        Args:
            tool_context: Tool context
            params: Batch edit parameters

        Returns:
            ToolResult: Operation result
        """
        try:
            resolved = self.resolve_path_fuzzy(params.file_path)
            file_path = resolved.path
            fuzzy_warning = resolved.warning
            if not file_path.exists():
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult(
                    error=f"File does not exist: {file_path}\n"
                          "Use write_file to create new files."
                )

            is_valid, error_message = await self.get_horizon(tool_context).validate_file_not_modified(file_path)
            if not is_valid:
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(error_message)

            original_content = await self._read_file(file_path)
            resolved_chunks, chunk_warnings = self._resolve_all_chunks(params.chunks, original_content)
            overlap_error = self._validate_no_overlaps(resolved_chunks)
            if overlap_error:
                tool_context.set_metadata("error_type", "edit_file.error_conflict_detected")
                return ToolResult.error(overlap_error)

            new_content = original_content
            for chunk in sorted(resolved_chunks, key=lambda item: item.range_info.start_index, reverse=True):
                start_index = chunk.range_info.start_index
                end_index = chunk.range_info.end_index
                new_content = new_content[:start_index] + chunk.new_content + new_content[end_index:]

            if new_content == original_content:
                msg = "No changes made. All chunks resulted in no actual changes."
                if fuzzy_warning:
                    msg += "\n\n" + fuzzy_warning
                return ToolResult(content=msg)

            async with self._file_versioning_context(tool_context, file_path):
                await self._write_file(file_path, new_content)

            ai_warnings: list[str] = []
            if fuzzy_warning:
                ai_warnings.append(fuzzy_warning)
            ai_warnings.extend(chunk_warnings)

            syntax_result = await SyntaxChecker.check_syntax(str(file_path), new_content)
            if not syntax_result.is_valid:
                errors_str = "\n".join(syntax_result.errors)
                ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

            summary_diff = DiffGenerator.generate_summary_diff(
                original_content,
                new_content,
                str(file_path.name)
            )
            full_diff = DiffGenerator.generate_unified_diff(
                original_content,
                new_content,
                str(file_path.name)
            )
            stats = DiffGenerator.calculate_change_stats(original_content, new_content)

            absolute_path = file_path.resolve()
            output = f"File updated: {absolute_path}\n"
            output += f"Applied {len(resolved_chunks)} range chunk(s) successfully\n\n"

            for resolved in sorted(resolved_chunks, key=lambda item: item.chunk_index):
                range_info = resolved.range_info
                old_fragment = original_content[range_info.start_index:range_info.end_index]
                old_lines = 0 if old_fragment == "" else old_fragment.count("\n") + 1
                new_lines = 0 if resolved.new_content == "" else resolved.new_content.count("\n") + 1
                output += (
                    f"  Chunk {resolved.chunk_index}: lines {range_info.start_line}-{range_info.end_line} "
                    f"({old_lines} → {new_lines} lines)\n"
                )

            output += "\n"

            if stats["added_lines"] > 0:
                output += f"Total lines added: +{stats['added_lines']}\n"
            if stats["deleted_lines"] > 0:
                output += f"Total lines deleted: -{stats['deleted_lines']}\n"
            if stats["modified_lines"] > 0:
                output += f"Total lines modified: ~{stats['modified_lines']}\n"

            size_change = stats["size_change"]
            if size_change != 0:
                sign = "+" if size_change > 0 else ""
                output += f"Total size change: {sign}{size_change} bytes ({stats['old_size']}→{stats['new_size']})\n"

            if summary_diff:
                output += "\n--- Change Summary ---\n"
                output += summary_diff

            if ai_warnings:
                output += "\n\n" + "\n\n".join(ai_warnings)

            return ToolResult(
                content=output,
                extra_info={
                    "diff": full_diff,
                    "file_path": str(file_path),
                    "total_chunks": len(resolved_chunks)
                }
            )

        except ValueError as validation_error:
            logger.warning(f"Range batch edit validation failed: {validation_error}")
            tool_context.set_metadata("error_type", "edit_file.error_validation_failed")
            return ToolResult.error(str(validation_error))
        except Exception as e:
            logger.exception(f"Failed to execute multi file range edit: {e}")
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return ToolResult(
                error="The multi_edit_file_range tool encountered an unexpected error. "
                      "First re-read current file content around range anchors to check if it has been modified, then retry with latest text. "
                      "If multiple attempts fail and edit_file_range is available, try smaller chunks. "
                      "As a last resort, use shell commands or a Python script."
            )

    def _resolve_all_chunks(
        self,
        chunks: List[RangeEditChunk],
        original_content: str,
    ) -> tuple[List[ResolvedChunk], list[str]]:
        """Resolve all chunk ranges against original content.

        Returns:
            (resolved_chunks, warnings) — warnings 来自各 chunk 的锚点纠偏
        """
        resolved_chunks: list[ResolvedChunk] = []
        all_warnings: list[str] = []

        for idx, chunk in enumerate(chunks, start=1):
            if chunk.replace_start == "" and chunk.replace_end == "":
                raise ValueError(f"Chunk {idx} invalid: replace_start and replace_end cannot both be empty.")

            try:
                resolution = resolve_replace_range(
                    original_content,
                    chunk.replace_start,
                    chunk.replace_end,
                )
                range_info = resolution.matched_range
                all_warnings.extend(resolution.warnings)
            except ValueError as match_error:
                raise ValueError(
                    f"Chunk {idx} range match failed: {match_error}. "
                    "If multiple attempts fail, re-read latest file content around anchors and refine them."
                ) from match_error

            resolved_chunks.append(
                ResolvedChunk(
                    chunk_index=idx,
                    range_info=range_info,
                    new_content=chunk.new_content,
                )
            )

        return resolved_chunks, all_warnings

    def _validate_no_overlaps(self, resolved_chunks: List[ResolvedChunk]) -> Optional[str]:
        """Validate that target ranges do not overlap"""
        ordered = sorted(resolved_chunks, key=lambda item: item.range_info.start_index)
        for i in range(1, len(ordered)):
            prev_chunk = ordered[i - 1]
            current_chunk = ordered[i]
            if current_chunk.range_info.start_index < prev_chunk.range_info.end_index:
                return (
                    "Chunk range conflict detected:\n"
                    f"- Chunk {prev_chunk.chunk_index} targets lines "
                    f"{prev_chunk.range_info.start_line}-{prev_chunk.range_info.end_line}\n"
                    f"- Chunk {current_chunk.chunk_index} targets lines "
                    f"{current_chunk.range_info.start_line}-{current_chunk.range_info.end_line}\n"
                    "Overlapping chunk ranges are not allowed. Please refine chunk anchors."
                )
        return None

    async def _read_file(self, file_path: Path) -> str:
        """Read file content"""
        async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return await f.read()

    async def _write_file(self, file_path: Path, content: str) -> None:
        """Write file content"""
        if content and not content.endswith("\n"):
            content += "\n"

        async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
            await f.write(content)

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """Get tool details for display - shows the diff of all changes"""
        if not result.ok:
            return None

        if not result.extra_info or "diff" not in result.extra_info:
            return None

        diff_content = result.extra_info.get("diff", "")
        if not diff_content:
            return None

        file_path = result.extra_info.get("file_path", "")
        total_chunks = result.extra_info.get("total_chunks", 0)
        file_name = os.path.basename(file_path) if file_path else "unknown"

        markdown_content = f"## File Edit: {file_name}\n\n"
        markdown_content += f"**Total edits applied:** {total_chunks}\n\n"
        markdown_content += "```diff\n"
        markdown_content += diff_content
        markdown_content += "\n```"

        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=f"{file_name}.diff",
                content=markdown_content
            )
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """Get remark content"""
        if not arguments or "file_path" not in arguments:
            return i18n.translate("read_file.not_found", category="tool.messages")

        file_path = arguments["file_path"]
        return os.path.basename(file_path)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None
    ) -> Dict:
        """Get friendly action and remark after tool call"""
        if not result.ok:
            result.use_custom_remark = True
            error_type = tool_context.get_metadata("error_type")

            if error_type:
                remark = i18n.translate(error_type, category="tool.messages")
            else:
                file_path_str = arguments.get("file_path", "") if arguments else ""
                if file_path_str:
                    remark = i18n.translate("edit_file.error", category="tool.messages", file_path=file_path_str)
                else:
                    remark = i18n.translate("edit_file.error_no_file", category="tool.messages")

            if error_type and error_type != "edit_file.error_unexpected":
                suffix = i18n.translate("tool.ai_retry_suffix", category="tool.messages")
                remark = remark + suffix

            return {
                "action": i18n.translate("multi_edit_file_range", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("multi_edit_file_range", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
