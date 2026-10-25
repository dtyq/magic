"""Locate replacement ranges in one file snapshot before generating large edits."""

from __future__ import annotations

import asyncio
import os
from typing import Any

from pydantic import Field

from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.token_estimator import num_tokens_from_string, truncate_text_by_token
from app.core.context.agent_context import AgentContext
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import DisplayType, OperationResultStatus, ToolDetail
from app.i18n import i18n
from app.service.html_app_memory_service import is_html_app_memory_path
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.file_edit_store import FileEditRangeRecord, FileEditStore
from app.tools.utils.file_change_stats import read_text_snapshot
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists
from app.utils.line_number_handler import LineNumberHandler
from app.utils.replace_range_resolver import ContextRange, RangeMatchError, resolve_replace_range, validate_non_overlapping_ranges

logger = get_logger(__name__)


class FileRangeParams(BaseToolParams):
    replace_start: str = Field(
        ...,
        description="Start anchor copied from the file, included in the range; empty selects from the file start",
    )
    replace_end: str = Field(
        ...,
        description="End anchor copied from the file, included in the range; empty selects through the file end. Both anchors cannot be empty",
    )


class FindFileRangesParams(BaseToolParams):
    file_path: str = Field(..., description="Path of the file to inspect")
    ranges: list[FileRangeParams] = Field(
        ..., min_length=1,
        description="Non-overlapping ranges to locate together in one file snapshot; use a one-item list for a single range",
    )


@tool()
class FindFileRanges(AbstractFileTool[FindFileRangesParams], WorkspaceTool[FindFileRangesParams]):
    """Locate file ranges before generating large replacements."""

    def get_prompt_hint(self) -> str:
        return """\
Copy anchors exactly from the file. All ranges are located in the same snapshot.
If any range is missing, ambiguous, or overlaps another, no usable IDs are returned and no file is changed.
On success, submit all intended changes together to edit_file_ranges as edits containing range_id and new_string.
Each ID is single-use and belongs to this AgentContext; file changes, restart, or context reset require a new lookup.
Use edit_file for short edits and multi_edit_file for multiple short edits.
"""

    async def execute(self, tool_context: ToolContext, params: FindFileRangesParams) -> ToolResult:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        records: list[FileEditRangeRecord] = []
        published = False
        try:
            resolved = self.resolve_path_fuzzy(params.file_path)
            file_path = resolved.path
            tool_context.set_metadata("file_path", str(file_path))
            warnings: list[str] = [resolved.warning] if resolved.warning else []
            if is_html_app_memory_path(file_path):
                return ToolResult.error("MICRO-APP.md is managed by update_html_app_memory.", data={"error_code": "write_forbidden"})
            if not await async_exists(file_path):
                tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
                return ToolResult.error(f"File does not exist: {file_path}. No file changes were made.", data={"error_code": "file_unavailable"})

            snapshot = await read_text_snapshot(file_path)
            matched: list[ContextRange] = []
            for index, requested in enumerate(params.ranges):
                if context.is_interruption_requested():
                    raise asyncio.CancelledError
                self._strip_line_number_prefixes(requested, warnings)
                try:
                    resolution = resolve_replace_range(snapshot.content, requested.replace_start, requested.replace_end)
                except ValueError as error:
                    tool_context.set_metadata("error_type", "edit_file.error_match_failed")
                    return ToolResult.error(
                        f"Range {index + 1} lookup failed: {error}\nNo usable range IDs were created. No file changes were made. Correct the anchors and retry the complete ranges list.",
                        data={"error_code": error.code if isinstance(error, RangeMatchError) else "range_match_failed", "input_index": index},
                    )
                matched.append(resolution.matched_range)
                warnings.extend(resolution.warnings)
            try:
                validate_non_overlapping_ranges(matched)
            except RangeMatchError as error:
                tool_context.set_metadata("error_type", "edit_file.error_conflict_detected")
                return ToolResult.error(f"{error}\nNo usable range IDs were created. No file changes were made.", data={"error_code": error.code})

            # 所有范围先定位并检查，再发布编号；同一批不能混用不同文件快照。
            items: list[dict[str, object]] = []
            selected_previews: list[str] = []
            remaining_preview_tokens = self._preview_limit()
            for index, selected in enumerate(matched):
                if context.is_interruption_requested():
                    raise asyncio.CancelledError
                record = await FileEditStore.create_range(
                    context, file_path=file_path, start_index=selected.start_index,
                    end_index=selected.end_index, start_line=selected.start_line,
                    end_line=selected.end_line, source_content=snapshot.content,
                )
                records.append(record)
                selected_previews.append(truncate_text_by_token(
                    snapshot.content[selected.start_index:selected.end_index], remaining_preview_tokens,
                )[0] if remaining_preview_tokens > 0 else "")
                preview, truncated = (
                    self._preview(snapshot.content, selected.start_index, selected.end_index, remaining_preview_tokens)
                    if remaining_preview_tokens > 0 else ("", True)
                )
                remaining_preview_tokens = max(0, remaining_preview_tokens - num_tokens_from_string(preview))
                items.append({
                    "input_index": index, "range_id": record.range_id,
                    "start_line": record.start_line, "end_line": record.end_line,
                    "character_count": selected.end_index - selected.start_index,
                    "preview": preview, "preview_truncated": truncated,
                })
            await self.get_horizon(tool_context).record_file_observation(
                file_path, tool_name="find_file_ranges",
                metadata={"file_edit_range_ids": [record.range_id for record in records]},
            )
            output = [f"Found {len(items)} non-overlapping ranges in {file_path}. No file changes were made."]
            for item in items:
                output.append(f"Range {int(item['input_index']) + 1}: range_id={item['range_id']}, lines {item['start_line']}-{item['end_line']}, {item['character_count']} characters.")
                if item["preview"]:
                    output.append(str(item["preview"]))
                if item["preview_truncated"]:
                    output.append("Preview is incomplete or omitted; read the relevant content if needed before rewriting.")
            output.append("Submit all intended replacements together to edit_file_ranges. IDs are single-use and valid only in the current AgentContext and unchanged file snapshot.")
            output.extend(warnings)
            result = ToolResult(
                content="\n\n".join(output),
                data={"file_path": str(file_path), "ranges": items},
                extra_info={"file_path": str(file_path), "selected_previews": selected_previews},
            )
            published = True
            return result
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.exception("Failed to find file ranges: %s", error)
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return ToolResult.error("Range lookup could not be completed. No usable IDs were returned and no file changes were made. Retry find_file_ranges.", data={"error_code": "storage_unavailable"})
        finally:
            if not published:
                for record in records:
                    try:
                        await FileEditStore.discard_range(context, record)
                    except Exception as error:
                        logger.warning("Could not clean unpublished range %s: %s", record.range_id, error)

    @staticmethod
    def _preview_limit() -> int:
        value = config.get("file_edit.range_preview_max_tokens")
        if isinstance(value, bool) or value is None:
            raise ValueError("Missing file_edit.range_preview_max_tokens configuration.")
        limit = int(value)
        if limit <= 0:
            raise ValueError("file_edit.range_preview_max_tokens must be greater than zero.")
        return limit

    @classmethod
    def _preview(cls, content: str, start_index: int, end_index: int, token_limit: int) -> tuple[str, bool]:
        selected = content[start_index:end_index]
        if not selected:
            return "(empty range)", False
        context_lines = cls._context_line_limit()
        before_start = start_index
        for _ in range(context_lines):
            previous_break = content.rfind("\n", 0, max(0, before_start - 1))
            before_start = 0 if previous_break < 0 else previous_break + 1
        after_end = end_index
        for _ in range(context_lines):
            next_break = content.find("\n", after_end)
            after_end = len(content) if next_break < 0 else next_break + 1
        before = content[before_start:start_index]
        after = content[end_index:after_end]
        parts = []
        if before:
            parts.append(f"Context before:\n{before}")
        parts.append(f"Selected range:\n{selected}")
        if after:
            parts.append(f"Context after:\n{after}")
        preview, truncated = truncate_text_by_token("\n\n".join(parts), token_limit)
        return preview, truncated

    @staticmethod
    def _context_line_limit() -> int:
        value = config.get("file_edit.range_preview_context_lines")
        if isinstance(value, bool) or value is None:
            raise ValueError("Missing file_edit.range_preview_context_lines configuration.")
        limit = int(value)
        if limit < 0:
            raise ValueError("file_edit.range_preview_context_lines must be non-negative.")
        return limit

    @staticmethod
    def _strip_line_number_prefixes(params: FileRangeParams, warnings: list[str]) -> None:
        start, had_start, _ = LineNumberHandler.detect_and_strip(params.replace_start)
        if had_start:
            params.replace_start = start
            warnings.append("Line-number prefixes were removed from replace_start.")
        end, had_end, _ = LineNumberHandler.detect_and_strip(params.replace_end)
        if had_end:
            params.replace_end = end
            warnings.append("Line-number prefixes were removed from replace_end.")

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult,
        arguments: dict[str, Any] | None = None,
    ) -> ToolDetail | None:
        file_path = str(tool_context.get_metadata("file_path") or "")
        file_name = os.path.basename(file_path)
        ranges = result.data.get("ranges", []) if result.ok else []
        message = (
            i18n.translate("find_file_ranges.located", category="tool.messages", count=len(ranges))
            if result.ok else i18n.translate(
                str(tool_context.get_metadata("error_type") or "find_file_ranges.error"), category="tool.messages",
            )
        )
        failed_index = result.data.get("input_index")
        if not result.ok and isinstance(failed_index, int):
            message = i18n.translate("find_file_ranges.failed_location", category="tool.messages", index=failed_index + 1)
        lines = [f"## {file_name}", message, i18n.translate("find_file_ranges.not_modified", category="tool.messages")]
        for index, item in enumerate(ranges):
            lines.append(i18n.translate("find_file_ranges.location", category="tool.messages", index=index + 1, start=item["start_line"], end=item["end_line"]))
            # 用户报告只保留真实选中片段，不能透传编号、绝对路径或模型调用指导。
            preview = str(result.extra_info["selected_previews"][index])
            if preview:
                lines.append("\n    " + preview.replace("\n", "\n    "))
            if item["preview_truncated"]:
                lines.append(i18n.translate("find_file_ranges.preview_truncated", category="tool.messages"))
        report = ToolDetail(
            type=DisplayType.MD,
            data=await self._build_file_content(file_path, f"{file_name or 'file'}.ranges.md", "\n\n".join(lines)),
        )
        if not file_path:
            return report
        return ToolDetailFactory.create_operation_result_detail(
            [ToolDetailFactory.create_file_result_item(
                file_path, self.base_dir,
                OperationResultStatus.SUCCESS if result.ok else OperationResultStatus.ERROR,
                message=message,
                description=i18n.translate("find_file_ranges.not_modified", category="tool.messages"),
            )], report=report, stage="find",
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        result.use_custom_remark = True
        return {
            "action": i18n.translate("find_file_ranges", category="tool.actions"),
            "remark": os.path.basename(str(tool_context.get_metadata("file_path") or "")) if result.ok else i18n.translate("find_file_ranges.error", category="tool.messages"),
        }
