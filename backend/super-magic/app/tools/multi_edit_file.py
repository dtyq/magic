"""
批量文件编辑工具

支持原子性批量编辑操作，要么全部成功，要么全部失败。
"""

from app.core.entity.factory.tool_detail_factory import ToolDetailFactory

from app.core.entity.message.server_message import OperationResultChanges, OperationResultStatus
from app.i18n import i18n
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.syntax_checker import SyntaxChecker
from app.core.entity.message.server_message import DisplayType, ToolDetail
from app.core.horizon.agent_horizon import VALIDATION_ERROR_NOT_READ
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.line_number_handler import LineNumberHandler
from app.utils.diff_generator import DiffGenerator
from app.utils.punctuation_matcher import PunctuationMatcher
from app.service.html_app_memory_service import is_html_app_memory_path
from app.utils.async_file_utils import async_exists, async_write_text
from app.tools.utils.file_change_stats import (
    FileChangeMetrics, FileTextSnapshot, format_file_change_metrics, measure_text, read_text_snapshot,
)

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
1. Obtain the exact content needed for all edits; do not repeat a read when a file observation and sufficient context already exist
2. Plan all edits together (old_string and new_string for each)
3. Call this tool ONCE with all edits in the edits array
4. DO NOT read the file again between edits - this is the whole point of this tool

Each edit's requirements are the same as the edit_file tool, please refer to the edit_file tool's hints.
The file must have a recorded observation from read_file/read_files, grep_search, or a recognized
single-file shell view. User-provided snippets do not create a record; partial reads do not restrict
edit locations. If the version changed, every applied edit must request and match exactly one
replacement in its sequential step. Otherwise follow the error's reading guidance. Read surrounding
content when needed for your decision; skipped no-ops do not count as replacements.

This call is atomic for one file: all edits are validated before any file write. If one edit fails,
the whole call fails and none of its edits are applied. Separate tool calls, including calls for
other files, are independent and may have different results.

IMPORTANT: Copy text exactly as it appears in the file, including punctuation style.
When copying from read_file output, copy only the actual file content after the line-number prefix.
Never include the line number + tab in any old_string or new_string.
"""

    @staticmethod
    def _format_atomic_failure(message: str, total_edits: int) -> str:
        """明确告诉模型：单文件批量编辑在写入前整体失败。"""
        return (
            "Atomic multi-edit failed before the file was written.\n"
            f"This call contained {total_edits} edits for one file. "
            "No changes were written; none of the edits from this call were applied.\n\n"
            f"Reason:\n{message}\n\n"
            "Correct the failed edit and retry the complete edits list. "
            "Do not assume that any part of this call succeeded."
        )

    async def execute(self, tool_context: ToolContext, params: MultiEditFileParams) -> ToolResult:
        """
        Execute batch editing operation

        Args:
            tool_context: Tool context
            params: Batch edit parameters

        Returns:
            ToolResult: Operation result
        """
        write_started = False
        try:
            # Get safe file path with fuzzy matching
            resolved = self.resolve_path_fuzzy(params.file_path)
            file_path = resolved.path
            fuzzy_warning = resolved.warning
            if is_html_app_memory_path(file_path):
                return ToolResult.error("MICRO-APP.md is managed by update_html_app_memory. Use that tool instead of multi_edit_file so MagicBase data model records are not overwritten.")
            # Check if file exists
            if not await async_exists(file_path):
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult.error(
                    f"File does not exist: {file_path}\n"
                    "Use write_file to create new files.\n\n"
                    "No changes were written to the file."
                )

            # 内部读取只服务本次匹配，不能替代编辑前必须已有的观察记录。
            horizon = self.get_horizon(tool_context)
            if not await horizon.is_file_tracked(file_path):
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(
                    f"{VALIDATION_ERROR_NOT_READ}\n\n"
                    "No changes were written to the file."
                )

            # Read original content
            original_snapshot = await self._read_file(file_path)
            original_content = original_snapshot.content



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
                return ToolResult.error(
                    self._format_atomic_failure(validation_result['error'], len(params.edits))
                )

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
                    return ToolResult.error(
                        self._format_atomic_failure(
                            f"Edit {i+1}/{len(params.edits)} failed:\n"
                            "Empty old_string is not supported. Use write_file to create new files.",
                            len(params.edits),
                        )
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
                        return ToolResult.error(
                            self._format_atomic_failure(error_msg, len(params.edits))
                        )

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

                    return ToolResult.error(
                        self._format_atomic_failure(error_msg, len(params.edits))
                    )

                if occurrences != edit.expected_replacements:
                    tool_context.set_metadata("error_type", "edit_file.error_replacements_mismatch")
                    return ToolResult.error(
                        self._format_atomic_failure(
                            f"Edit {i+1}/{len(params.edits)} failed:\n"
                            f"Expected {edit.expected_replacements} replacement(s) but found {occurrences}.\n"
                            "Adjust expected_replacements or refine old_string.",
                            len(params.edits),
                        )
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

                """
                Track applied edit
                每项替换报告字符变化；整份文件的字节大小在全部编辑完成后统一统计。
                例：「中文」替换为 abcd，字符数增加 2，但 UTF-8 字节减少 2；此处只报告前者。
                """
                applied_edits.append({
                    'index': i + 1,
                    'replacements': edit.expected_replacements,
                    'character_change': len(working_content) - len(before_edit)
                })

            # Check if any changes were made
            if working_content == original_content:
                # Include warnings even when no changes were made
                msg = "No changes made. All edits were no-ops or skipped."
                if ai_warnings:
                    msg += "\n\n" + "\n\n".join(ai_warnings)
                msg += "\n" + format_file_change_metrics(
                    FileChangeMetrics(original_snapshot.metrics, original_snapshot.metrics),
                )
                return ToolResult(content=msg)

            # applied_edits 只含实际执行项，且上面已确认实际次数等于请求次数。
            # 每项均唯一才允许版本变化；任一多次替换仍要求原版本未变。
            is_valid, error_message = await horizon.validate_file_not_modified(
                file_path, allow_changed=all(edit['replacements'] == 1 for edit in applied_edits),
            )
            if not is_valid:
                tool_context.set_metadata("error_type", "edit_file.error_file_modified")
                return ToolResult.error(
                    "Atomic multi-edit was not written.\n"
                    f"This call contained {len(params.edits)} edits for one file. "
                    "The file changed after validation and before the single write, "
                    "so none of the edits from this call were applied.\n\n"
                    f"Reason:\n{error_message}\n\n"
                    "Read the current file, update the complete edits list, and retry. "
                    "Do not assume partial success."
                )

            # Write the final result with file versioning (triggers events and updates timestamp)
            async with self._file_versioning_context(tool_context, file_path):
                write_started = True
                working_content = await self._write_file(file_path, working_content)

            # Syntax check
            syntax_result = await SyntaxChecker.check_syntax(str(file_path), working_content)
            if not syntax_result.is_valid:
                # Add syntax errors to AI warnings instead of rolling back
                errors_str = "\n".join(syntax_result.errors)
                ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

            """
            Calculate stats
            所有替换完成后统一比较 original_content 与最终 working_content。
            不把每步中间版本重复计为最终变化，也不为摘要和用量反馈分别再比较全文。
            """
            stats = DiffGenerator.calculate_change_stats(
                original_content, working_content, old_size=original_snapshot.metrics.byte_count,
            )

            # Generate summary diff for LLM (ToolResult content)
            summary_diff = DiffGenerator.generate_summary_diff(str(file_path.name), stats)

            # Generate full diff for user display (get_tool_detail)
            full_diff = DiffGenerator.generate_unified_diff(
                original_content,
                working_content,
                str(file_path.name)
            )

            # Format output
            absolute_path = file_path.resolve()
            output = f"File updated: {absolute_path}\n"
            output += f"Applied {len(applied_edits)} edit(s) successfully\n\n"

            # Summary of each edit
            for edit_info in applied_edits:
                output += f"  Edit {edit_info['index']}: {edit_info['replacements']} replacement(s)"
                if edit_info['character_change'] != 0:
                    sign = '+' if edit_info['character_change'] > 0 else ''
                    output += f" ({sign}{edit_info['character_change']} characters)"
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

            # 原摘要继续提供全部行数／字节事实；计数只追加 Token，不替代原有信息。
            output += "\n" + format_file_change_metrics(
                FileChangeMetrics(original_snapshot.metrics, measure_text(working_content, stats['new_size'])),
                include_bytes=False,
            )

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
                    "added_lines": stats["added_lines"],
                    "deleted_lines": stats["deleted_lines"],
                    "modified_lines": stats["modified_lines"],
                    "diff": full_diff,  # Store full diff for get_tool_detail
                    "file_path": str(file_path),
                    "total_edits": len(applied_edits)
                }
            )

        except Exception as e:
            logger.exception(f"Failed to execute multi-edit: {e}")
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            if write_started:
                return ToolResult.error(
                    "The multi-edit write did not complete normally. "
                    "The final file state is unknown. No automatic retry was performed.\n\n"
                    "Read the file before retrying and decide whether any edits still need to be applied."
                )
            return ToolResult.error(
                self._format_atomic_failure(
                    "The tool encountered an unexpected error before writing the file.",
                    len(params.edits) if 'params' in locals() else 0,
                )
            )

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
                fix_result = PunctuationMatcher.try_auto_fix_punctuation(
                    edit.old_string,
                    working_content
                )

                if fix_result:
                    # Auto-fix succeeded, update edit.old_string and store warning
                    logger.info(f"Auto-fixed punctuation in edit {i+1} old_string during validation: '{edit.old_string[:50]}...' -> '{fix_result.actual[:50]}...'")
                    edit.old_string = fix_result.actual
                    # Store the warning for later use in execute phase
                    setattr(edit, '_punctuation_fix_warning', fix_result.warning)
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

    async def _read_file(self, file_path: Path) -> FileTextSnapshot:
        """Read file content"""
        return await read_text_snapshot(file_path)

    async def _write_file(self, file_path: Path, content: str) -> str:
        """Write file content"""
        if content and not content.endswith('\n'):
            content += '\n'

        await async_write_text(file_path, content)
        return content

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

        report = ToolDetail(
            type=DisplayType.MD,  # Use Markdown display type
            data=await self._build_file_content(
                file_path=file_path,
                file_name=f"{file_name}.diff",
                content=markdown_content
            )
        )

        return ToolDetailFactory.create_operation_result_detail(
            [ToolDetailFactory.create_file_result_item(
                file_path, self.base_dir, OperationResultStatus.SUCCESS,
                changes=OperationResultChanges(
                    added_lines=int(result.extra_info.get("added_lines", 0)),
                    deleted_lines=int(result.extra_info.get("deleted_lines", 0)),
                    modified_lines=int(result.extra_info.get("modified_lines", 0)),
                ),
            )],
            report=report, stage="edit",
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
