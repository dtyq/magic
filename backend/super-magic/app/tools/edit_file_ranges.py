"""Apply replacements to ranges from one unchanged file snapshot."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.syntax_checker import SyntaxChecker
from app.core.context.agent_context import AgentContext
from app.core.entity.factory.tool_detail_factory import ToolDetailFactory
from app.core.entity.message.server_message import DisplayType, ToolDetail, OperationResultChanges, OperationResultStatus
from app.i18n import i18n
from app.service.html_app_memory_service import is_html_app_memory_path
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.file_edit_store import FileEditRangeRecord, FileEditStore
from app.tools.utils.file_change_stats import FileChangeMetrics, FileTextSnapshot, format_file_change_metrics, measure_text, read_text_snapshot
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_write_text
from app.utils.diff_generator import DiffGenerator
from app.utils.line_number_handler import LineNumberHandler
from app.utils.replace_range_resolver import ContextRange, RangeMatchError, validate_non_overlapping_ranges

logger = get_logger(__name__)


class FileRangeEditParams(BaseToolParams):
    range_id: str = Field(..., description="Single-use 8-character ID returned by find_file_ranges")
    new_string: str | None = Field(default=None, description="Replacement text, including the selected boundary anchors; an empty string deletes the range")
    replacement_id: str | None = Field(default=None, description="Saved text from an earlier failed edit in this context and file; use instead of new_string")

    @model_validator(mode="after")
    def validate_replacement_input(self) -> "FileRangeEditParams":
        if (self.new_string is None) == (self.replacement_id is None):
            raise ValueError("Provide exactly one of new_string or replacement_id for each edit.")
        return self


class EditFileRangesParams(BaseToolParams):
    edits: list[FileRangeEditParams] = Field(
        ..., min_length=1,
        description="All intended replacements for one file and one snapshot, committed together; use a one-item list for a single edit",
    )


@dataclass(frozen=True, slots=True)
class PreparedRangeEdit:
    record: FileEditRangeRecord
    new_string: str
    replacement_id: str | None


@tool()
class EditFileRanges(AbstractFileTool[EditFileRangesParams], WorkspaceTool[EditFileRangesParams]):
    """Apply located ranges together in one file write."""

    def get_prompt_hint(self) -> str:
        return """\
Call find_file_ranges first, then submit all intended changes for that file together in edits.
Each edit uses range_id and exactly one of new_string or replacement_id; IDs must share one unchanged file snapshot and must not overlap.
All validation completes before writing. If validation fails, none of this call's edits are written.
IDs are single-use and expire after file changes, restart, or context reset.
On a stale snapshot, find the ranges again and use any returned replacement_id for its corresponding new range.
If a write fails with unknown final state, read the file before deciding how to recover; do not blindly repeat the batch.
Use edit_file for short edits and multi_edit_file for multiple short edits.
"""

    async def execute(self, tool_context: ToolContext, params: EditFileRangesParams) -> ToolResult:
        try:
            return await self._execute(tool_context, params)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.exception("Failed before range batch write: %s", error)
            tool_context.set_metadata("error_type", "edit_file.error_unexpected")
            return self._error(
                "The range batch could not be prepared. No edits from this call were written. Read the file and retry find_file_ranges.",
                error_code="preparation_failed",
                file_path=str(tool_context.get_metadata("file_path") or ""),
            )

    async def _prepare_edits(
        self, context: AgentContext, tool_context: ToolContext, params: EditFileRangesParams,
    ) -> list[PreparedRangeEdit] | ToolResult:
        prepared: list[PreparedRangeEdit] = []
        seen: set[str] = set()
        for index, requested in enumerate(params.edits):
            if context.is_interruption_requested():
                raise asyncio.CancelledError
            if requested.range_id in seen:
                return self._error(f"Edit {index + 1} repeats a range_id. No edits were written.", error_code="range_duplicate")
            seen.add(requested.range_id)
            record = await FileEditStore.get_range(context, requested.range_id)
            if record is None or record.state != "ready":
                tool_context.set_metadata("error_type", "edit_file.error_range_unavailable")
                return self._error(
                    f"Edit {index + 1}: range_id is unavailable, already used, or belongs to another context. No edits were written. Find the ranges again.",
                    error_code="range_unavailable",
                    file_path=str(tool_context.get_metadata("file_path") or ""),
                )
            if prepared and (
                record.file_path != prepared[0].record.file_path
                or record.source_digest != prepared[0].record.source_digest
            ):
                return self._error("All edits must belong to one file and one snapshot. No edits were written.", error_code="range_conflict")
            tool_context.set_metadata("file_path", record.file_path)
            if requested.replacement_id is not None:
                replacement = await FileEditStore.get_replacement(context, requested.replacement_id)
                if replacement is None or replacement.file_path != record.file_path:
                    tool_context.set_metadata("error_type", "edit_file.error_replacement_unavailable")
                    return self._error(f"Edit {index + 1}: replacement_id is unavailable or belongs to another file. No edits were written.", error_code="replacement_unavailable", file_path=record.file_path)
                new_string = replacement.value
            else:
                new_string, _, _ = LineNumberHandler.detect_and_strip(requested.new_string or "")
            prepared.append(PreparedRangeEdit(record, new_string, requested.replacement_id))
        try:
            validate_non_overlapping_ranges([
                ContextRange(edit.record.start_index, edit.record.end_index, edit.record.start_line, edit.record.end_line)
                for edit in prepared
            ])
        except RangeMatchError as error:
            tool_context.set_metadata("error_type", "edit_file.error_conflict_detected")
            return self._error(f"{error}\nNo edits were written.", error_code=error.code, file_path=prepared[0].record.file_path)
        return prepared

    async def _execute(self, tool_context: ToolContext, params: EditFileRangesParams) -> ToolResult:
        context = tool_context.get_extension_typed("agent_context", AgentContext)
        prepared = await self._prepare_edits(context, tool_context, params)
        if isinstance(prepared, ToolResult):
            return prepared
        file_path = Path(prepared[0].record.file_path)
        if is_html_app_memory_path(file_path):
            return self._error("MICRO-APP.md is managed by update_html_app_memory. No edits were written.", error_code="write_forbidden", file_path=str(file_path))
        if not await async_exists(file_path):
            tool_context.set_metadata("error_type", "edit_file.error_file_not_exist")
            return self._error(f"File does not exist: {file_path}. No edits were written.", error_code="file_unavailable", file_path=str(file_path))

        async with FileEditStore.path_lock(file_path, context.get_interruption_event()):
            # Reload while holding the path lock so parallel calls cannot apply one range twice.
            for edit in prepared:
                current = await FileEditStore.get_range(context, edit.record.range_id)
                if current is None or current.state != "ready":
                    tool_context.set_metadata("error_type", "edit_file.error_range_unavailable")
                    return self._error("A submitted range is no longer available. No edits were written. Find the ranges again.", error_code="range_unavailable", file_path=str(file_path))
            original_snapshot = await read_text_snapshot(file_path)
            source_digest = prepared[0].record.source_digest
            if FileEditStore.content_digest(original_snapshot.content) != source_digest:
                return await self._stale_result(context, tool_context, prepared)
            original_content = original_snapshot.content
            if any(not 0 <= edit.record.start_index <= edit.record.end_index <= len(original_content) for edit in prepared):
                return self._error("A saved range is outside the current file. No edits were written.", error_code="range_unavailable", file_path=str(file_path))
            # 例：先改后面的议程，再改前面的时间；所有位置都基于同一快照，长度变化不影响其他项。
            new_content = original_content
            for edit in sorted(prepared, key=lambda item: item.record.start_index, reverse=True):
                new_content = new_content[:edit.record.start_index] + edit.new_string + new_content[edit.record.end_index:]
            write_started = write_completed = False
            try:
                for edit in prepared:
                    await FileEditStore.set_range_state(context, edit.record, "applying")
                if context.is_interruption_requested():
                    raise asyncio.CancelledError
                if new_content != original_content:
                    current_snapshot = await read_text_snapshot(file_path)
                    if FileEditStore.content_digest(current_snapshot.content) != source_digest:
                        return await self._stale_result(context, tool_context, prepared)
                    async with self._file_versioning_context(tool_context, file_path):
                        if context.is_interruption_requested():
                            raise asyncio.CancelledError
                        write_started = True
                        new_content = await self._write_file(file_path, new_content)
                        write_completed = True
                for edit in prepared:
                    await FileEditStore.set_range_state(context, edit.record, "applied")
                for replacement_id in {edit.replacement_id for edit in prepared if edit.replacement_id is not None}:
                    await FileEditStore.consume_replacement(replacement_id)
            except asyncio.CancelledError:
                await self._finish_failed_edits(context, prepared, write_started)
                raise
            except Exception as error:
                logger.exception("Range batch commit failed: %s", error)
                await self._finish_failed_edits(context, prepared, write_started)
                tool_context.set_metadata("error_type", "edit_file_ranges.write_completed" if write_completed else "edit_file_ranges.write_unknown" if write_started else "edit_file.error_unexpected")
                return self._error(
                    "The file was updated, but recording completion failed. Do not repeat this batch." if write_completed
                    else "A file write was attempted and the final state is unknown. Read the actual file before recovery; do not repeat this batch." if write_started
                    else "Batch preparation failed. No edits from this call were written.",
                    error_code="completion_failed" if write_completed else "write_failed" if write_started else "preparation_failed",
                    file_path=str(file_path), write_status="completed" if write_completed else "unknown" if write_started else "not_started",
                )
        if new_content == original_content:
            return ToolResult(
                content="No changes made. All replacements already match the selected ranges. All submitted IDs have been consumed.",
                data={"status": "unchanged", "file_path": str(file_path), "edits": [{"range_id": edit.record.range_id, "status": "unchanged"} for edit in prepared]},
                extra_info={"file_path": str(file_path), "range_count": len(prepared)},
            )
        try:
            return await self._build_success_result(file_path=file_path, edits=prepared, original_snapshot=original_snapshot, new_content=new_content)
        except Exception as error:
            logger.exception("Range batch updated but result generation failed: %s", error)
            tool_context.set_metadata("error_type", "edit_file_ranges.write_completed")
            return self._error("All submitted ranges were written, but change reporting failed. Do not repeat this batch.", error_code="report_failed", file_path=str(file_path), write_status="completed")

    @staticmethod
    async def _finish_failed_edits(context: AgentContext, edits: list[PreparedRangeEdit], write_started: bool) -> None:
        # 写入前失败可重用位置；尝试写入后位置失效，解除活动保护，避免旧编号长期滞留。
        for edit in edits:
            try:
                await FileEditStore.set_range_state(context, edit.record, "invalid" if write_started else "ready")
            except Exception as error:
                logger.warning("Could not finalize failed range %s: %s", edit.record.range_id, error)

    async def _stale_result(self, context: AgentContext, tool_context: ToolContext, edits: list[PreparedRangeEdit]) -> ToolResult:
        recovery: list[dict[str, str]] = []
        for edit in edits:
            await FileEditStore.set_range_state(context, edit.record, "invalid")
            item = {"range_id": edit.record.range_id, "status": "not_applied"}
            try:
                item["replacement_id"] = edit.replacement_id or await FileEditStore.save_replacement(
                    context, file_path=Path(edit.record.file_path), value=edit.new_string,
                )
            except Exception as error:
                logger.warning("Could not save replacement for %s: %s", edit.record.range_id, error)
            recovery.append(item)
        tool_context.set_metadata("error_type", "edit_file_ranges.file_changed")
        saved = "\n".join(f"range_id={item['range_id']}: replacement_id={item['replacement_id']}" if "replacement_id" in item else f"range_id={item['range_id']}: replacement text could not be saved; regenerate it" for item in recovery)
        return self._error(
            "The file changed after range lookup. No edits from this call were written. Find all intended ranges again and reuse each available replacement_id for its corresponding new range.\n" + saved,
            error_code="range_stale", file_path=edits[0].record.file_path, edits=recovery,
        )

    async def _build_success_result(
        self,
        *,
        file_path: Path,
        edits: list[PreparedRangeEdit],
        original_snapshot: FileTextSnapshot,
        new_content: str,
    ) -> ToolResult:
        ai_warnings: list[str] = []
        syntax_result = await SyntaxChecker.check_syntax(str(file_path), new_content)
        if not syntax_result.is_valid:
            errors_str = "\n".join(syntax_result.errors)
            ai_warnings.append(f"WARNING: Syntax errors detected in the modified file:\n{errors_str}")

        stats = DiffGenerator.calculate_change_stats(
            original_snapshot.content,
            new_content,
            old_size=original_snapshot.metrics.byte_count,
        )
        summary_diff = DiffGenerator.generate_summary_diff(str(file_path.name), stats)
        full_diff = DiffGenerator.generate_unified_diff(
            original_snapshot.content,
            new_content,
            str(file_path.name),
        )
        output = f"File updated: {file_path.resolve()}\nApplied {len(edits)} ranges in one file write. All submitted range IDs have been consumed.\n"
        if stats["added_lines"] > 0:
            output += f"Lines added: +{stats['added_lines']}\n"
        if stats["deleted_lines"] > 0:
            output += f"Lines deleted: -{stats['deleted_lines']}\n"
        if stats["modified_lines"] > 0:
            output += f"Lines modified: ~{stats['modified_lines']}\n"
        if stats["size_change"] != 0:
            sign = "+" if stats["size_change"] > 0 else ""
            output += f"Size change: {sign}{stats['size_change']} bytes ({stats['old_size']}→{stats['new_size']})\n"
        if summary_diff:
            output += f"\n--- Change Summary ---\n{summary_diff}"
        output += "\n" + format_file_change_metrics(
            FileChangeMetrics(original_snapshot.metrics, measure_text(new_content, stats["new_size"])),
            include_bytes=False,
        )
        if ai_warnings:
            output += "\n\n" + "\n\n".join(ai_warnings)
        return ToolResult(
            content=output,
            data={"status": "applied", "file_path": str(file_path), "edits": [
                {"range_id": edit.record.range_id, "status": "applied"} for edit in edits
            ]},
            extra_info={"diff": full_diff, "file_path": str(file_path), "range_count": len(edits),
                "added_lines": stats["added_lines"], "deleted_lines": stats["deleted_lines"], "modified_lines": stats["modified_lines"]},
        )

    @staticmethod
    def _error(
        message: str, *, error_code: str, file_path: str = "",
        write_status: Literal["not_started", "unknown", "completed"] = "not_started",
        edits: list[dict[str, str]] | None = None,
    ) -> ToolResult:
        data: dict[str, object] = {"error_code": error_code, "write_status": write_status}
        if file_path:
            data["file_path"] = file_path
        if edits is not None:
            data["edits"] = edits
        return ToolResult.error(message, data=data, extra_info={"file_path": file_path})

    async def _write_file(self, file_path: Path, content: str) -> str:
        if content and not content.endswith("\n"):
            content += "\n"
        await async_write_text(file_path, content)
        return content

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult,
        arguments: dict[str, Any] | None = None,
    ) -> ToolDetail | None:
        file_path = str((result.extra_info or {}).get("file_path") or tool_context.get_metadata("file_path") or "")
        file_name = os.path.basename(file_path)
        count = int((result.extra_info or {}).get("range_count", 0))
        message = (
            i18n.translate("edit_file_ranges.unchanged" if result.data.get("status") == "unchanged" else "edit_file_ranges.applied", category="tool.messages", count=count)
            if result.ok else i18n.translate(str(tool_context.get_metadata("error_type") or "edit_file.error_unexpected"), category="tool.messages")
        )
        diff = str((result.extra_info or {}).get("diff") or "")
        content = f"## {file_name}\n\n{message}"
        if diff:
            content += f"\n\n\x60\x60\x60diff\n{diff}\n\x60\x60\x60"
        elif not result.ok:
            content += "\n\n" + i18n.translate(
                "edit_file_ranges.not_modified" if result.data.get("write_status") == "not_started"
                else "edit_file_ranges.write_completed" if result.data.get("write_status") == "completed"
                else "edit_file_ranges.write_unknown",
                category="tool.messages",
            )
        report = ToolDetail(type=DisplayType.MD, data=await self._build_file_content(file_path, f"{file_name or 'file'}.diff", content))
        if not file_path:
            return report
        info = result.extra_info or {}
        changes = OperationResultChanges(
            added_lines=int(info["added_lines"]), deleted_lines=int(info["deleted_lines"]),
            modified_lines=int(info["modified_lines"]),
        ) if diff and result.ok else None
        return ToolDetailFactory.create_operation_result_detail(
            [ToolDetailFactory.create_file_result_item(
                file_path, self.base_dir, OperationResultStatus.SUCCESS if result.ok else OperationResultStatus.ERROR,
                message=message, changes=changes,
            )], report=report, stage="edit",
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, result: ToolResult,
        execution_time: float, arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        result.use_custom_remark = True
        return {
            "action": i18n.translate("edit_file_ranges", category="tool.actions"),
            "remark": os.path.basename(str((result.extra_info or {}).get("file_path") or tool_context.get_metadata("file_path") or ""))
            if result.ok else i18n.translate(str(tool_context.get_metadata("error_type") or "edit_file.error_unexpected"), category="tool.messages"),
        }
