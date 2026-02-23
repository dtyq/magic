"""
批量文件编辑工具

支持原子性批量编辑操作，要么全部成功，要么全部失败。
"""

from app.i18n import i18n
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

import aiofiles
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.syntax_checker import SyntaxChecker
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.file_timestamp_manager import get_global_timestamp_manager
from app.utils.line_number_handler import LineNumberHandler
from app.utils.diff_generator import DiffGenerator
from app.utils.punctuation_matcher import PunctuationMatcher

logger = get_logger(__name__)


class EditOperation(BaseModel):
    """<!--zh: 单个编辑操作-->
Single edit operation"""
    old_string: str = Field(
        ...,
        description="The text to replace"
    )
    new_string: str = Field(
        ...,
        description="The text to replace it with"
    )
    expected_replacements: int = Field(
        default=1,
        description="The expected number of replacements to perform. Defaults to 1 if not specified.",
        ge=1
    )


class MultiEditFileParams(BaseToolParams):
    file_path: str = Field(
        ...,
        description="The absolute path to the file to modify"
    )
    edits: List[EditOperation] = Field(
        ...,
        description="Array of edit operations to perform sequentially on the file",
        min_items=1
    )


@tool()
class MultiEditFile(AbstractFileTool[MultiEditFileParams], WorkspaceTool[MultiEditFileParams]):
    """
    This is a tool for making multiple edits to a single file in one operation. It is built
    on top of the edit_file tool and allows you to perform multiple find-and-replace operations
    efficiently. Prefer this tool over the edit_file tool when you need to make multiple edits
    to the same file.

    IMPORTANT:
    - All edits are applied in sequence, in the order they are provided
    - Each edit operates on the result of the previous edit
    - All edits must be valid for the operation to succeed - if any edit fails, none will be applied
    - This tool is ideal when you need to make several changes to different parts of the same file
    - This tool is for editing existing files only. Use write_file to create new files.

    CRITICAL REQUIREMENTS:
    1. All edits follow the same requirements as the single edit_file tool
    2. The edits are atomic - either all succeed or none are applied
    3. Plan your edits carefully to avoid conflicts between sequential operations

    WARNING:
    - Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find
    - This tool is for editing existing files only. Use write_file to create new files.

    When making edits:
    - Ensure all edits result in idiomatic, correct code
    - Do not leave the code in a broken state
    """

    def get_prompt_hint(self) -> str:
        return """\
STRONGLY PREFERRED when you need to make multiple edits to the same file.
This tool is more efficient than calling edit_file multiple times.

Workflow for multiple edits:
1. Read the file ONCE to identify all locations that need editing
2. Plan all edits together (old_string and new_string for each)
3. Call this tool ONCE with all edits in the edits array
4. DO NOT read the file again between edits - this is the whole point of this tool

Each edit's requirements are the same as the edit_file tool, please refer to the edit_file tool's hints.

IMPORTANT: Copy text exactly as it appears in the file, including punctuation style.
"""

    async def execute(self, tool_context: ToolContext, params: MultiEditFileParams) -> ToolResult:
        """
        Execute batch editing operation

        Args:
            tool_context: Tool context
            params: Batch edit parameters

        Returns:
            ToolResult: Operation result
        """
        try:
            # Get safe file path with fuzzy matching
            file_path, fuzzy_warning = self.resolve_path_fuzzy(params.file_path)
            # Check if file exists
            if not file_path.exists():
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult(
                    error=f"File does not exist: {file_path}\n"
                          "Use write_file to create new files."
                )

            # Verify file hasn't been modified externally
            timestamp_manager = get_global_timestamp_manager()
            is_valid, error_message = await timestamp_manager.validate_file_not_modified(file_path)
            if not is_valid:
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(error_message)

            # Read original content
            original_content = await self._read_file(file_path)



            # Clean line numbers from all edits and collect warnings
            ai_warnings = []

            had_old_line_numbers = False
            had_new_line_numbers = False

            for i, edit in enumerate(params.edits):
                old_cleaned, had_numbers, _ = LineNumberHandler.detect_and_strip(edit.old_string)
                if had_numbers:
                    logger.info(f"Stripped line numbers from edit {i+1} old_string")
                    edit.old_string = old_cleaned
                    had_old_line_numbers = True

                new_cleaned, had_numbers, _ = LineNumberHandler.detect_and_strip(edit.new_string)
                if had_numbers:
                    logger.info(f"Stripped line numbers from edit {i+1} new_string")
                    edit.new_string = new_cleaned
                    had_new_line_numbers = True

                # Check for identical strings
                if edit.old_string == edit.new_string:
                    ai_warnings.append(f"WARNING: Edit {i+1}: old_string and new_string are identical. This edit will be skipped.")

            # Add general warnings about line numbers
            if had_old_line_numbers:
                ai_warnings.append("WARNING: Line numbers were detected and automatically removed from old_string(s). When copying from read_file output, remember to exclude the line number prefix (e.g., '123\\t').")
            if had_new_line_numbers:
                ai_warnings.append("WARNING: Line numbers were detected and automatically removed from new_string(s). The new_string should not contain line number prefixes.")

            # Validate all edits first (dry run)
            validation_result = self._validate_all_edits(params.edits, original_content)
            if not validation_result['valid']:
                # 直接从验证结果中获取错误类型
                error_type = validation_result.get('error_type', "edit_file.error_validation_failed")
                tool_context.set_metadata("error_type", error_type)
                return ToolResult.error(validation_result['error'])

            # Apply edits sequentially
            working_content = original_content
            applied_edits = []
            punctuation_fix_warnings = []  # Collect punctuation fix warnings from each edit

            for i, edit in enumerate(params.edits):
                # Check for no-op
                if edit.old_string == edit.new_string:
                    logger.warning(f"Edit {i+1}: old_string and new_string are identical, skipping")
                    continue

                # Check for empty old_string - not supported
                if edit.old_string == "":
                    tool_context.set_metadata("error_type", "edit_file.error_validation_failed")
                    return ToolResult(
                        error=f"Edit {i+1}/{len(params.edits)} failed:\n"
                              f"Empty old_string is not supported. Use write_file to create new files."
                    )

                # Check if punctuation was auto-fixed during validation phase
                edit_fix_warning = getattr(edit, '_punctuation_fix_warning', None)

                # Count occurrences (old_string already corrected if validation fixed it)
                occurrences = working_content.count(edit.old_string)

                if occurrences == 0:
                    tool_context.set_metadata("error_type", "edit_file.error_match_failed")

                    # First check for punctuation mismatches
                    punctuation_error = PunctuationMatcher.check_fuzzy_match_with_punctuation(
                        edit.old_string,
                        working_content,
                        max_results=3
                    )

                    if punctuation_error:
                        error_msg = f"Edit {i+1}/{len(params.edits)} failed:\n{punctuation_error}"
                        return ToolResult.error(error_msg)

                    error_msg = f"Edit {i+1}/{len(params.edits)} failed:\n"
                    error_msg += f"old_string not found in current content.\n"
                    error_msg += f"This edit may depend on a previous edit that changed the text.\n"
                    error_msg += f"Looking for: {edit.old_string[:100]}...\n\n"

                    # Check for excessive escaping and add warning if detected
                    if re.search(r'\\{3,}', edit.old_string):
                        strings_text = "old_string"
                        if re.search(r'\\{3,}', edit.new_string):
                            strings_text += " and new_string"
                        verb = "contains" if " and " not in strings_text else "contain"

                        error_msg += (
                            "EXCESSIVE ESCAPING DETECTED:\n"
                            f"The {strings_text} {verb} excessive backslashes that prevent matching.\n"
                            "Remove the extra escape characters from your strings."
                        )

                    return ToolResult.error(error_msg)

                if occurrences != edit.expected_replacements:
                    tool_context.set_metadata("error_type", "edit_file.error_replacements_mismatch")
                    return ToolResult(
                        error=f"Edit {i+1}/{len(params.edits)} failed:\n"
                              f"Expected {edit.expected_replacements} replacement(s) but found {occurrences}.\n"
                              f"Adjust expected_replacements or refine old_string."
                    )

                # Collect punctuation fix warning if any
                if edit_fix_warning:
                    punctuation_fix_warnings.append(f"Edit {i+1}: {edit_fix_warning}")

                # Apply replacement
                before_edit = working_content
                working_content = working_content.replace(
                    edit.old_string,
                    edit.new_string,
                    edit.expected_replacements
                )

                # Track applied edit
                applied_edits.append({
                    'index': i + 1,
                    'replacements': edit.expected_replacements,
                    'size_change': len(working_content) - len(before_edit)
                })

            # Check if any changes were made
            if working_content == original_content:
                # Include warnings even when no changes were made
                msg = "No changes made. All edits were no-ops or skipped."
                if ai_warnings:
                    msg += "\n\n" + "\n\n".join(ai_warnings)
                return ToolResult(content=msg)

            # Write the final result with file versioning (triggers events and updates timestamp)
            async with self._file_versioning_context(tool_context, file_path):
                await self._write_file(file_path, working_content)

            # Syntax check
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), working_content)
            if not syntax_result.is_valid:
                # Add syntax errors to AI warnings instead of rolling back
                errors_str = "\n".join(syntax_result.errors)
                ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

            # Generate summary diff for LLM (ToolResult content)
            summary_diff = DiffGenerator.generate_summary_diff(
                original_content,
                working_content,
                str(file_path.name)
            )

            # Generate full diff for user display (get_tool_detail)
            full_diff = DiffGenerator.generate_unified_diff(
                original_content,
                working_content,
                str(file_path.name)
            )

            # Calculate stats
            stats = DiffGenerator.calculate_change_stats(original_content, working_content)

            # Format output
            absolute_path = file_path.resolve()
            output = f"File updated: {absolute_path}\n"
            output += f"Applied {len(applied_edits)} edit(s) successfully\n\n"

            # Summary of each edit
            for edit_info in applied_edits:
                output += f"  Edit {edit_info['index']}: {edit_info['replacements']} replacement(s)"
                if edit_info['size_change'] != 0:
                    sign = '+' if edit_info['size_change'] > 0 else ''
                    output += f" ({sign}{edit_info['size_change']} bytes)"
                output += "\n"

            output += "\n"

            # Overall stats
            if stats['added_lines'] > 0:
                output += f"Total lines added: +{stats['added_lines']}\n"
            if stats['deleted_lines'] > 0:
                output += f"Total lines deleted: -{stats['deleted_lines']}\n"
            if stats['modified_lines'] > 0:
                output += f"Total lines modified: ~{stats['modified_lines']}\n"

            size_change = stats['size_change']
            if size_change != 0:
                sign = '+' if size_change > 0 else ''
                output += f"Total size change: {sign}{size_change} bytes ({stats['old_size']}→{stats['new_size']})\n"

            # Add summary diff for LLM
            if summary_diff:
                output += "\n--- Change Summary ---\n"
                output += summary_diff

            # Add AI warnings if any
            if ai_warnings:
                output += "\n\n" + "\n\n".join(ai_warnings)

            # Add punctuation fix warnings at the end
            if punctuation_fix_warnings:
                output += "\n\n---\n\n" + "\n\n---\n\n".join(punctuation_fix_warnings)

            # Add fuzzy match warning at the end (for file path fuzzy match)
            if fuzzy_warning:
                output += "\n\n---\n\n" + fuzzy_warning

            return ToolResult(
                content=output,
                extra_info={
                    "diff": full_diff,  # Store full diff for get_tool_detail
                    "file_path": str(file_path),
                    "total_edits": len(applied_edits)
                }
            )

        except Exception as e:
            logger.exception(f"Failed to execute multi-edit: {e}")
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return ToolResult.error("The multi_edit_file tool encountered an unexpected error. Try using multiple edit_file calls, shell commands (e.g., sed -i; avoid piping sed to cat -A for multi-byte characters), or write a Python script to perform these edits instead.")

    def _validate_all_edits(self, edits: List[EditOperation], content: str) -> dict:
        """
        Validate all edits can be applied

        Returns:
            dict with 'valid' bool, optional 'error' message, and optional 'error_type'
        """
        if not edits:
            return {
                'valid': False,
                'error': 'No edits provided',
                'error_type': "edit_file.error_validation_failed"
            }

        # Simulate applying all edits
        working_content = content

        for i, edit in enumerate(edits):
            # Check for no-op
            if edit.old_string == edit.new_string:
                continue

            # Check for empty old_string - not supported
            if edit.old_string == "":
                return {
                    'valid': False,
                    'error': f"Edit {i+1} validation failed: Empty old_string is not supported. Use write_file to create new files.",
                    'error_type': "edit_file.error_validation_failed"
                }

            # Check if old_string exists
            occurrences = working_content.count(edit.old_string)

            if occurrences == 0:
                # Try to auto-fix punctuation mismatch
                corrected_string, fix_warning = PunctuationMatcher.try_auto_fix_punctuation(
                    edit.old_string,
                    working_content
                )

                if corrected_string and fix_warning:
                    # Auto-fix succeeded, update edit.old_string and store warning
                    logger.info(f"Auto-fixed punctuation in edit {i+1} old_string during validation: '{edit.old_string[:50]}...' -> '{corrected_string[:50]}...'")
                    edit.old_string = corrected_string
                    # Store the warning for later use in execute phase
                    setattr(edit, '_punctuation_fix_warning', fix_warning)
                    # Recount with corrected string
                    occurrences = working_content.count(edit.old_string)

            # Handle no matches (after potential auto-fix)
            if occurrences == 0:
                # Check for punctuation mismatches and provide diagnostic
                punctuation_error = PunctuationMatcher.check_fuzzy_match_with_punctuation(
                    edit.old_string,
                    working_content,
                    max_results=3
                )

                if punctuation_error:
                    return {
                        'valid': False,
                        'error': f"Edit {i+1} validation failed:\n{punctuation_error}",
                        'error_type': "edit_file.error_match_failed"
                    }

                # Check for excessive escaping in the validation phase
                if re.search(r'\\{3,}', edit.old_string):
                    strings_text = "old_string"
                    if re.search(r'\\{3,}', edit.new_string):
                        strings_text += " and new_string"
                    verb = "contains" if " and " not in strings_text else "contain"

                    error_msg = f"Edit {i+1} validation failed:\n"
                    error_msg += (
                        "EXCESSIVE ESCAPING DETECTED:\n"
                        f"The {strings_text} {verb} excessive backslashes that prevent matching.\n"
                        "Remove the extra escape characters from your strings.\n\n"
                    )
                    return {
                        'valid': False,
                        'error': error_msg,
                        'error_type': "edit_file.error_match_failed"
                    }

                # Try to detect if this is a sequencing issue
                if i > 0:
                    return {
                        'valid': False,
                        'error': f"Edit {i+1} validation failed: old_string not found.\n"
                                 f"This might be due to previous edits changing the content.\n"
                                 f"Verify edit order and dependencies.",
                        'error_type': "edit_file.error_match_failed"
                    }
                else:
                    return {
                        'valid': False,
                        'error': f"Edit {i+1} validation failed: old_string not found in file.\n"
                                 f"Looking for: {edit.old_string[:100]}...",
                        'error_type': "edit_file.error_match_failed"
                    }

            if occurrences != edit.expected_replacements:
                return {
                    'valid': False,
                    'error': f"Edit {i+1} validation failed:\n"
                             f"Expected {edit.expected_replacements} occurrence(s) but found {occurrences}.",
                    'error_type': "edit_file.error_replacements_mismatch"
                }

            # Apply to simulation
            working_content = working_content.replace(
                edit.old_string,
                edit.new_string,
                edit.expected_replacements
            )

        # Check if any changes would be made
        if working_content == content:
            return {
                'valid': False,
                'error': 'No changes would be made. All edits are no-ops.',
                'error_type': "edit_file.error_validation_failed"
            }

        return {'valid': True}

    async def _read_file(self, file_path: Path) -> str:
        """Read file content"""
        async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return await f.read()

    async def _write_file(self, file_path: Path, content: str) -> None:
        """Write file content"""
        if content and not content.endswith('\n'):
            content += '\n'

        async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
            await f.write(content)

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """Get tool details for display - shows the diff of all changes"""
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
        total_edits = result.extra_info.get("total_edits", 0)
        file_name = os.path.basename(file_path) if file_path else "unknown"

        # Format diff as markdown
        markdown_content = f"## Multi-Edit File: {file_name}\n\n"
        markdown_content += f"**Total edits applied:** {total_edits}\n\n"

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
                "action": i18n.translate("multi_edit_file", category="tool.actions"),
                "remark": remark
            }

        return {
            "action": i18n.translate("multi_edit_file", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
