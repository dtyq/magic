"""
区间单点编辑工具

通过 replace_start/replace_end 定位并替换文件中的唯一区间（包含边界）。
"""

from app.i18n import i18n
import os
from pathlib import Path
from typing import Any, Dict, Optional

import aiofiles
from pydantic import Field

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from agentlang.utils.syntax_checker import SyntaxChecker
from app.utils.file_timestamp_manager import get_global_timestamp_manager
from app.utils.diff_generator import DiffGenerator
from app.utils.replace_range_resolver import resolve_replace_range

logger = get_logger(__name__)


class EditFileRangeParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="<!--zh: 要修改的文件的绝对路径-->The absolute path to the file to modify"
    )
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


@tool()
class EditFileRange(AbstractFileTool[EditFileRangeParams], WorkspaceTool[EditFileRangeParams]):
    """<!--zh
    基于替换边界编辑文件，替换从 replace_start 到 replace_end 的整个区间（包含边界）。
    优先用 edit_file；old_string 过长时才用本工具。创建新文件用 write_file。
    -->
    Range-based file editing, replacing the full range from replace_start to replace_end (inclusive).
    Prefer edit_file; use this tool only when old_string is too long. Use write_file to create new files.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
使用前提（必须满足）：
- 本工具只在「被替换内容 old_string 较大」时使用，用于节省 token
- old_string 至少满足其一：
  1) old_string >= 5 行
  2) old_string >= 200 字符
- 若 old_string 同时小于 5 行且小于 200 字符，改用 edit_file

锚点规则：
- 调用前先读文件，确认锚点文本存在，再逐字复制（空格/缩进/标点/大小写完全一致）
- replace_start 与 replace_end（非空时）各自至少满足其一：
  1) >= 2 行
  2) >= 50 字符
- start 为空或 end 为空是允许的边界模式，不受上条最小长度限制
- 锚点需文本唯一；不唯一会导致匹配失败

区间语义（包含边界，replace_start/end 本身也被替换）：
- 两端都有：替换 replace_start 到 replace_end 之间的完整区间
- start 为空：从文件开头替换到 replace_end
- end 为空：从 replace_start 替换到文件末尾（追加场景）；new_content 须重新包含 replace_start 的内容

失败时：重读文件确认锚点存在与唯一性 → 扩展锚点长度 → 仍失败则改用 edit_file
-->
Usage prerequisites (must meet):
- Use this tool only when the REPLACED content (old_string) is large enough to justify range replacement
- old_string must meet at least one threshold:
  1) old_string >= 5 lines
  2) old_string >= 200 characters
- If old_string is below both thresholds, use edit_file instead

Anchor rules:
- Read the file before calling and copy anchors verbatim (spaces/indentation/punctuation/case must match exactly)
- For non-empty anchors, replace_start and replace_end must each meet at least one threshold:
  1) >= 2 lines
  2) >= 50 characters
- Empty start or empty end is allowed for boundary mode and is exempt from the minimum-length rule
- Anchors must be text-unique; non-unique anchors cause matching failure

Range semantics (inclusive; replace_start/end themselves are replaced):
- Both provided: replace the full range from replace_start to replace_end
- Empty start: replace from file start to replace_end
- Empty end: replace from replace_start to end of file (append scenario); new_content must include replace_start again

On failure: re-read and verify anchor existence/uniqueness -> increase anchor length -> switch to edit_file if still failing
"""

    async def execute(self, tool_context: ToolContext, params: EditFileRangeParams) -> ToolResult:
        """
        Execute range-based editing operation

        Args:
            tool_context: Tool context
            params: Edit parameters

        Returns:
            ToolResult: Operation result with diff
        """
        try:
            file_path, fuzzy_warning = self.resolve_path_fuzzy(params.file_path)
            ai_warnings = []
            if fuzzy_warning:
                ai_warnings.append(fuzzy_warning)

            if params.replace_start == "" and params.replace_end == "":
                tool_context.set_metadata("error_type", "edit_file.error_validation_failed")
                return ToolResult.error("replace_start and replace_end cannot both be empty.")

            if not file_path.exists():
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult(
                    error=f"File does not exist: {file_path}\n"
                          "Use write_file to create new files."
                )

            timestamp_manager = get_global_timestamp_manager()
            is_valid, error_message = await timestamp_manager.validate_file_not_modified(file_path)
            if not is_valid:
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(error_message)

            original_content = await self._read_file(file_path)

            try:
                matched_range = resolve_replace_range(
                    original_content,
                    params.replace_start,
                    params.replace_end
                )
            except ValueError as match_error:
                tool_context.set_metadata("error_type", "edit_file.error_match_failed")
                return ToolResult(
                    error=(
                        f"Range match failed: {match_error}\n\n"
                        "SOLUTIONS:\n"
                        "1. Re-read current file content around range anchors to check if it has been modified, then retry with latest text\n"
                        "2. Ensure anchors are copied character-by-character (whitespace, punctuation, indentation, newlines)\n"
                        "3. If multiple attempts fail and edit_file is available (for short/precise edits), try edit_file\n"
                        "4. As a last resort, use shell commands or a Python script for precise edits"
                    )
                )

            new_content = (
                original_content[:matched_range.start_index]
                + params.new_content
                + original_content[matched_range.end_index:]
            )

            if new_content == original_content:
                msg = "No changes made. Replacement content is identical to current content in target range."
                if ai_warnings:
                    msg += "\n\n" + "\n\n".join(ai_warnings)
                return ToolResult(content=msg)

            async with self._file_versioning_context(tool_context, file_path):
                await self._write_file(file_path, new_content)

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

            replaced_fragment = original_content[matched_range.start_index:matched_range.end_index]
            replaced_line_count = 0 if replaced_fragment == "" else replaced_fragment.count("\n") + 1
            new_line_count = 0 if params.new_content == "" else params.new_content.count("\n") + 1

            absolute_path = file_path.resolve()
            output = f"File updated: {absolute_path}\n"
            output += (
                f"Range replaced: lines {matched_range.start_line}-{matched_range.end_line} "
                f"({replaced_line_count} line(s) replaced with {new_line_count} line(s))\n"
            )

            if stats["added_lines"] > 0:
                output += f"Lines added: +{stats['added_lines']}\n"
            if stats["deleted_lines"] > 0:
                output += f"Lines deleted: -{stats['deleted_lines']}\n"
            if stats["modified_lines"] > 0:
                output += f"Lines modified: ~{stats['modified_lines']}\n"

            size_change = stats["size_change"]
            if size_change != 0:
                sign = "+" if size_change > 0 else ""
                output += f"Size change: {sign}{size_change} bytes ({stats['old_size']}→{stats['new_size']})\n"

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
                }
            )

        except Exception as e:
            logger.exception(f"Failed to edit file range: {e}")
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return ToolResult(
                error="The edit_file_range tool encountered an unexpected error. "
                      "First re-read current file content around range anchors to check if it has been modified, then retry with latest text. "
                      "Then check exact character alignment in anchors (whitespace/punctuation/newlines). "
                      "If multiple attempts fail and the edit_file tool is available (for short/precise edits), try it. "
                      "As a last resort, use shell commands or write a Python script."
            )

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
        """Get tool details for display - shows the diff of changes"""
        if not result.ok:
            return None

        if not result.extra_info or "diff" not in result.extra_info:
            return None

        diff_content = result.extra_info.get("diff", "")
        if not diff_content:
            return None

        file_path = result.extra_info.get("file_path", "")
        file_name = os.path.basename(file_path) if file_path else "unknown"

        markdown_content = f"## File Edit: {file_name}\n\n"
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
                "action": i18n.translate("edit_file_range", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("edit_file_range", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
