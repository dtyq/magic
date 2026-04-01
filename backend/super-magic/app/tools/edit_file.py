"""
文件编辑工具

提供精确的字符串替换功能，支持：
- expected_replacements 精确控制替换次数
- 自动处理 read_file 的行号前缀
- 详细的错误提示和解决方案
- 标准 unified diff 输出
- 相似文本建议
"""

from app.i18n import i18n
import os
import re
import difflib
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
from app.utils.line_number_handler import LineNumberHandler
from app.utils.diff_generator import DiffGenerator
from app.utils.punctuation_matcher import PunctuationMatcher
from app.utils.input_diagnoser import InputDiagnoser
from app.utils.async_file_utils import async_exists

logger = get_logger(__name__)


class EditFileParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="The absolute path to the file to modify"
    )
    old_string: str = Field(
        ...,
        description="The text to replace"
    )
    new_string: str = Field(
        ...,
        description="The text to replace it with (must be different from old_string)"
    )
    expected_replacements: int = Field(
        default=1,
        description="The expected number of replacements to perform. Defaults to 1 if not specified.",
        ge=1
    )


@tool()
class EditFile(AbstractFileTool[EditFileParams], WorkspaceTool[EditFileParams]):
    """<!--zh
    在文件中执行精确的字符串替换，严格验证替换次数。

    使用方法：
    - 编辑 read_file 输出的文本时，确保保留行号前缀之后的确切缩进（制表符/空格）。行号前缀格式为：行号 + 制表符。制表符之后的所有内容都是要匹配的实际文件内容。永远不要在 old_string 或 new_string 中包含行号前缀的任何部分。
    - 此工具仅用于编辑现有文件。使用 write_file 创建新文件。
    -->
    Performs exact string replacements in files with strict occurrence count validation.

    Usage:
    - When editing text from read_file output, ensure you preserve the exact indentation
    (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix
    format is: line number + tab. Everything after that tab is the actual file content
    to match. Never include any part of the line number prefix in the old_string or new_string.
    - This tool is for editing existing files only. Use write_file to create new files.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
使用编辑工具前：
- 使用 read_file 工具了解文件的内容和上下文。如果你最近已读过文件且未被他人修改，可以基于你的知识直接编辑
- 验证目录路径正确
- 如果 old_string 匹配多个位置且未指定 expected_replacements，工具将失败
- 如果指定了 expected_replacements，匹配数量不等于它时工具将失败
- 如果 old_string 与文件内容不完全匹配（包括空白字符），工具将失败
- 如果 old_string 和 new_string 相同，工具将失败
- 如果 old_string 为空，工具将失败

重要：完全按照文件中出现的方式复制文本，包括标点符号样式。

多次编辑同一文件时：
- 开始时读取文件一次以识别所有编辑位置
- 使用 multi_edit_file 在一次操作中应用所有更改（首选）
- 或按顺序应用编辑而不在编辑之间重新读取文件
- 不要在每次成功编辑后重新读取文件 - 这会浪费 token
-->
Before using edit tool:
- Use the read_file tool to understand the file's contents and context. If you've already read the file recently and it hasn't been modified by others, you can edit directly based on your knowledge
- Verify the directory path is correct
- The tool will fail if old_string matches multiple locations and expected_replacements isn't specified
- The tool will fail if the number of matches doesn't equal expected_replacements when it's specified
- The tool will fail if old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if old_string and new_string are the same
- The tool will fail if old_string is empty

IMPORTANT: Copy text exactly as it appears in the file, including punctuation style.

When editing the same file multiple times:
- Read the file ONCE at the beginning to identify ALL edit locations
- Use multi_edit_file to apply all changes in one operation (preferred)
- OR apply edits sequentially without re-reading the file between edits
- DO NOT re-read the file after each successful edit - this wastes tokens
"""

    async def execute(self, tool_context: ToolContext, params: EditFileParams) -> ToolResult:
        """
        Execute file editing operation

        Args:
            tool_context: Tool context
            params: Edit parameters

        Returns:
            ToolResult: Operation result with diff
        """
        try:
            # Get safe file path with fuzzy matching
            file_path, fuzzy_warning = self.resolve_path_fuzzy(params.file_path)
            # Check and strip line numbers from old_string
            old_string_cleaned, had_line_numbers, line_warning = LineNumberHandler.detect_and_strip(params.old_string)
            if had_line_numbers:
                logger.info(f"Stripped line numbers from old_string for {file_path}")
                params.old_string = old_string_cleaned

            # Also check new_string for line numbers (shouldn't have them but check anyway)
            new_string_cleaned, new_had_numbers, _ = LineNumberHandler.detect_and_strip(params.new_string)
            if new_had_numbers:
                logger.info(f"Stripped line numbers from new_string for {file_path}")
                params.new_string = new_string_cleaned

            # Collect warnings for the AI
            ai_warnings = []

            # Add fuzzy matching warning if applicable
            if fuzzy_warning:
                ai_warnings.append(fuzzy_warning)

            if had_line_numbers:
                ai_warnings.append("WARNING: Line numbers were detected and automatically removed from old_string. When copying from read_file output, remember to exclude the line number prefix (e.g., '123\\t').")
            if new_had_numbers:
                ai_warnings.append("WARNING: Line numbers were detected and automatically removed from new_string. The new_string should not contain line number prefixes.")

            # Validate parameters
            if params.old_string == params.new_string:
                # Auto-fix: treat as no-op but warn the AI
                ai_warnings.append("WARNING: old_string and new_string are identical. This would be a no-op. Skipping the edit.")
                warning_msg = "\n\n".join(ai_warnings) if ai_warnings else ""
                return ToolResult(
                    content=f"No changes made - identical old and new strings.\n\n{warning_msg}".strip()
                )

            # Edit existing file
            if not await async_exists(file_path):
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult(
                    error=f"File does not exist: {file_path}\n"
                          "Use write_file to create new files."
                )

            # Verify file hasn't been modified externally
            is_valid, error_message = await self.get_horizon(tool_context).validate_file_not_modified(file_path)
            if not is_valid:
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(error_message)

            # Read file content
            original_content = await self._read_file(file_path)

            # Count occurrences
            occurrences = original_content.count(params.old_string)

            # Track if punctuation was auto-fixed
            punctuation_fix_warning = None

            if occurrences == 0:
                # Try to auto-fix punctuation mismatch
                corrected_string, fix_warning = PunctuationMatcher.try_auto_fix_punctuation(
                    params.old_string,
                    original_content
                )

                if corrected_string and fix_warning:
                    # Auto-fix succeeded! Use the corrected string
                    logger.info(
                        f"Auto-fixed punctuation in old_string: '{params.old_string[:50]}...' -> '{corrected_string[:50]}...'")
                    params.old_string = corrected_string
                    punctuation_fix_warning = fix_warning
                    # Recount with corrected string
                    occurrences = original_content.count(params.old_string)

            # Handle no matches
            if occurrences == 0:
                tool_context.set_metadata("error_type", "edit_file.error_match_failed")

                # Collect all diagnostic hints (don't return early, show all possible issues)

                # Check for punctuation mismatches
                punctuation_hints = PunctuationMatcher.check_fuzzy_match_with_punctuation(
                    params.old_string,
                    original_content,
                    max_results=3
                )

                # Run input diagnostics
                input_diagnostic_hints = InputDiagnoser.diagnose_input_issues(
                    params.old_string,
                    original_content
                )

                # Find similar strings for suggestion
                similar_suggestions = self._find_similar_strings(original_content, params.old_string)

                # Build error message with all available hints
                error_msg = (
                    "old_string not found in file.\n\n"
                    "CRITICAL: old_string must match file content with CHARACTER-BY-CHARACTER EXACT MATCH.\n"
                    "Every space, tab, newline, and punctuation mark must be identical.\n"
                    "Copy text directly from the file without ANY modifications.\n\n"
                )

                # Add punctuation hints if available
                if punctuation_hints:
                    error_msg += punctuation_hints + "\n"

                # Add input diagnostic hints if available
                if input_diagnostic_hints:
                    error_msg += input_diagnostic_hints + "\n"

                if had_line_numbers and line_warning:
                    error_msg += f"Note: Line numbers were detected and removed:\n{line_warning}\n\n"

                if similar_suggestions:
                    error_msg += "Did you mean one of these?\n"
                    error_msg += similar_suggestions
                else:
                    error_msg += "SOLUTIONS:\n"
                    error_msg += "1. Read current file content around the target snippet to check if it has been modified, then retry with latest text\n"
                    error_msg += "2. Check character-by-character alignment (whitespace, indentation, punctuation, newlines)\n"
                    error_msg += "3. If multiple attempts fail and edit_file_range is available, try it for range-anchored replacement\n"
                    error_msg += "4. As a last resort, use shell commands or a Python script for precise edits"

                # Check for excessive escaping and add warning at the end
                if re.search(r'\\{3,}', params.old_string):
                    strings_text = "old_string"
                    if re.search(r'\\{3,}', params.new_string):
                        strings_text += " and new_string"
                    verb = "contains" if " and " not in strings_text else "contain"

                    error_msg += (
                        "\n\nEXCESSIVE ESCAPING DETECTED:\n"
                        f"The {strings_text} {verb} excessive backslashes that prevent matching.\n"
                        "Remove the extra escape characters from your strings."
                    )

                return ToolResult.error(error_msg)

            # Handle count mismatch
            if occurrences != params.expected_replacements:
                tool_context.set_metadata("error_type", "edit_file.error_replacements_mismatch")

                _, locations = DiffGenerator.generate_match_locations_snippet(
                    original_content,
                    params.old_string,
                    max_matches=5
                )

                error_msg = (f"Expected {params.expected_replacements} replacement(s) but found {occurrences} occurrence(s).\n"
                            f"Set expected_replacements to {occurrences} or refine old_string.\n\n")

                if locations:
                    error_msg += f"Match locations:\n{locations}"

                return ToolResult.error(error_msg)

            # Perform replacement
            new_content = original_content.replace(params.old_string, params.new_string, params.expected_replacements)

            # Write new content with file versioning (triggers events and updates timestamp)
            async with self._file_versioning_context(tool_context, file_path):
                await self._write_file(file_path, new_content)

            # Syntax check
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), new_content)
            if not syntax_result.is_valid:
                # Add syntax errors to AI warnings instead of rolling back
                errors_str = "\n".join(syntax_result.errors)
                ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

            # Generate summary diff for LLM (ToolResult content)
            summary_diff = DiffGenerator.generate_summary_diff(
                original_content,
                new_content,
                str(file_path.name)
            )

            # Generate full diff for user display (get_tool_detail)
            full_diff = DiffGenerator.generate_unified_diff(
                original_content,
                new_content,
                str(file_path.name)
            )

            # Calculate stats
            stats = DiffGenerator.calculate_change_stats(original_content, new_content)

            # Format output
            absolute_path = file_path.resolve()
            output = f"File updated: {absolute_path}\n"
            output += f"Replacements: {params.expected_replacements} occurrence(s) replaced\n"

            if stats['added_lines'] > 0:
                output += f"Lines added: +{stats['added_lines']}\n"
            if stats['deleted_lines'] > 0:
                output += f"Lines deleted: -{stats['deleted_lines']}\n"
            if stats['modified_lines'] > 0:
                output += f"Lines modified: ~{stats['modified_lines']}\n"

            size_change = stats['size_change']
            if size_change != 0:
                sign = '+' if size_change > 0 else ''
                output += f"Size change: {sign}{size_change} bytes ({stats['old_size']}→{stats['new_size']})\n"

            # Add summary diff for LLM
            if summary_diff:
                output += "\n--- Change Summary ---\n"
                output += summary_diff

            # Add AI warnings if any
            if ai_warnings:
                output += "\n\n" + "\n\n".join(ai_warnings)

            # Add punctuation fix warning at the end
            if punctuation_fix_warning:
                output += "\n\n---\n\n" + punctuation_fix_warning

            return ToolResult(
                content=output,
                extra_info={
                    "diff": full_diff,  # Store full diff for get_tool_detail
                    "file_path": str(file_path),
                    "replacements": params.expected_replacements
                }
            )

        except Exception as e:
            logger.exception(f"Failed to edit file: {e}")
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return ToolResult(
                error="The edit_file tool encountered an unexpected error. "
                      "First re-read current file content around the target snippet to check if it has been modified, then retry with latest text. "
                      "Then check exact character alignment (whitespace/punctuation/newlines). "
                      "If multiple attempts fail and edit_file_range is available, try it. "
                      "As a last resort, use shell commands (e.g., sed/awk; avoid piping sed to cat -A for multi-byte characters) "
                      "or write a Python script."
            )



    async def _read_file(self, file_path: Path) -> str:
        """Read file content"""
        async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return await f.read()

    async def _write_file(self, file_path: Path, content: str) -> None:
        """Write file content"""
        # Ensure content ends with newline (if not empty)
        if content and not content.endswith('\n'):
            content += '\n'

        async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
            await f.write(content)

    def _find_similar_strings(self, content: str, search_string: str, max_suggestions: int = 5) -> str:
        """Find similar strings in content for suggestions"""
        if not content or not search_string:
            return ""

        lines = content.split('\n')
        search_lines = search_string.split('\n')

        # If search is multi-line, only look for similar first lines
        if len(search_lines) > 1:
            search_first = search_lines[0]
            candidates = []

            for i, line in enumerate(lines):
                ratio = difflib.SequenceMatcher(None, search_first, line).ratio()
                if ratio > 0.6:  # 60% similarity threshold
                    candidates.append((ratio, i, line))

            candidates.sort(reverse=True, key=lambda x: x[0])

            if candidates:
                suggestions = []
                for ratio, line_num, line in candidates[:max_suggestions]:
                    # 多行匹配时明确标注只是第一行相似，需检查后续行差异
                    similarity_note = f"{int(ratio * 100)}% similar [FIRST LINE ONLY - check subsequent lines for differences]"
                    suggestions.append(f"  Line {line_num + 1} ({similarity_note}): {line[:80]}...")
                return '\n'.join(suggestions)

        else:
            # Single line search - find similar lines
            candidates = []

            for i, line in enumerate(lines):
                if len(line.strip()) == 0:
                    continue
                ratio = difflib.SequenceMatcher(None, search_string, line).ratio()
                if ratio > 0.5:  # 50% similarity threshold for single lines
                    candidates.append((ratio, i, line))

            candidates.sort(reverse=True, key=lambda x: x[0])

            if candidates:
                suggestions = []
                for ratio, line_num, line in candidates[:max_suggestions]:
                    suggestions.append(f"  Line {line_num + 1} ({int(ratio * 100)}% similar): {line[:80]}...")
                return '\n'.join(suggestions)

        return ""

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """Get tool details for display - shows the diff of changes"""
        # Early return for error cases
        if not result.ok:
            return None

        if not result.extra_info or "diff" not in result.extra_info:
            return None

        diff_content = result.extra_info.get("diff", "")
        if not diff_content:
            return None

        # All checks passed, now format the diff
        file_path = result.extra_info.get("file_path", "")
        replacements = result.extra_info.get("replacements", 0)
        file_name = os.path.basename(file_path) if file_path else "unknown"

        # Format diff as markdown
        markdown_content = f"## File Edit: {file_name}\n\n"
        markdown_content += f"**Replacements made:** {replacements}\n\n"
        markdown_content += "```diff\n"
        markdown_content += diff_content
        markdown_content += "\n```"

        return ToolDetail(
            type=DisplayType.MD,  # Use Markdown display type
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
            # 设置使用自定义 remark
            result.use_custom_remark = True

            # 从 ToolContext 中获取错误类型
            error_type = tool_context.get_metadata("error_type")

            # 根据错误类型返回归类后的通用错误消息
            if error_type:
                remark = i18n.translate(error_type, category="tool.messages")
            else:
                # 如果没有设置错误类型，使用通用错误消息
                file_path_str = arguments.get("file_path", "") if arguments else ""
                if file_path_str:
                    remark = i18n.translate("edit_file.error", category="tool.messages", file_path=file_path_str)
                else:
                    # 没有文件路径，使用无文件名错误消息
                    remark = i18n.translate("edit_file.error_no_file", category="tool.messages")

            # 只有 AI 可以尝试修复的错误才添加后缀
            # EDIT_ERROR_UNEXPECTED 建议换工具，不是修复同一操作
            if error_type and error_type != "edit_file.error_unexpected":
                suffix = i18n.translate("tool.ai_retry_suffix", category="tool.messages")
                remark = remark + suffix

            return {
                "action": i18n.translate("edit_file", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("edit_file", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
