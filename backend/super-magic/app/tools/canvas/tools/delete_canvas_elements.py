"""显式范围、真人确认的画布删除入口。"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Literal

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.canvas.application.delete_elements_service import DeleteCanvasTarget, DeleteElementsService
from app.tools.canvas.presentation import error_result
from app.tools.canvas.presentation.batch_status import SUCCESS_STATUSES, summarize_items
from app.tools.canvas.tools.management_tool import CanvasManagementTool
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool


def _is_incomplete(item: Mapping[str, object]) -> bool:
    return item.get("status", "prepared") not in SUCCESS_STATUSES or item.get("metadata_cleanup_complete") is False


# 完整说明：agents/skills/canvas-manager/references/element-management.md。
@tool(name="delete_canvas_elements", code_mode_only=True)
class DeleteCanvasElements(CanvasManagementTool):
    """Prepare or remove exact Canvas targets and their selected versions."""

    name = "delete_canvas_elements"

    class Params(BaseToolParams):
        model_config = ConfigDict(extra="forbid")
        project_path: str = Field(min_length=1)
        targets: list[DeleteCanvasTarget] = Field(min_length=1)
        mode: Literal["remove", "remove_with_files"] = "remove"
        stage: Literal["prepare", "execute"] = "prepare"

    params_class = Params

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        try:
            result = await DeleteElementsService(_application(tool_context).repository, tool_context).run(
                params.project_path,
                params.targets,
                params.mode,
                params.stage,
            )
            complete = bool(result.get("complete", True))
            summary = summarize_items(result["items"], fallback_ok=complete)
            lines = [f"Canvas deletion stage: {result['stage']}; mode={params.mode}; complete={complete}."]
            if result["stage"] == "prepared":
                lines.append(f"Prepared targets: {summary.total}. No changes were made.")
                lines.append(f"Affected connections: {', '.join(result['connection_ids']) or 'none'}.")
            else:
                lines.append(
                    f"Element outcomes: total={summary.total}; succeeded={summary.succeeded}; "
                    f"partial={summary.partial}; failed={summary.failed}; processing={summary.processing}."
                )
            files = result.get("files", [])
            file_summary = summarize_items(files)
            if files:
                if result["stage"] == "prepared":
                    lines.append(f"Prepared files: {file_summary.total}. No files were deleted.")
                else:
                    lines.append(
                        f"File outcomes: total={file_summary.total}; succeeded={file_summary.succeeded}; "
                        f"partial={file_summary.partial}; failed={file_summary.failed}."
                    )

            # 未完成项先于成功明细，防止模型只读取前段时丢掉失败原因。
            for label, incomplete in (("Incomplete outcomes", True), ("Prepared outcomes" if result["stage"] == "prepared" else "Completed outcomes", False)):
                items = [item for item in result["items"] if _is_incomplete(item) == incomplete]
                file_items = [file for file in files if _is_incomplete(file) == incomplete]
                if not items and not file_items:
                    continue
                lines.append(f"{label}:")
                for item in items:
                    lines.append(
                        f"- element_id={item['element_id']} | name={item['name']} | scope={item['scope']} | "
                        f"status={item.get('status', 'prepared')} | error_code={item.get('error_code') or 'none'} | "
                        f"reason={item.get('reason') or 'none'}"
                    )
                    lines.append(
                        f"  affected_elements={', '.join(item['descendant_ids']) or 'none'} | "
                        f"affected_contents={', '.join(item['content_ids']) or 'none'} | "
                        f"removed_contents={', '.join(item.get('removed_content_ids', [])) or 'none'}"
                    )
                    if item.get("metadata_cleanup_complete") is False:
                        lines.append("  The Canvas target was removed, but its user detail metadata could not be cleaned up.")
                for file in file_items:
                    lines.append(
                        f"- file_id={file['file_id']} | file_name={file['file_name']} | shared={file['shared']} | "
                        f"status={file.get('status', 'prepared')} | error={file.get('error') or 'none'}"
                    )
            if result["stage"] == "prepared":
                lines.append(
                    "No changes were made. Ask the user to confirm this exact scope with ordinary ask_user questions XML; execute only after explicit agreement."
                )
            lines.append(
                "Removing a generating placeholder does not cancel provider generation or refund charges. Restoring a recycled file does not restore Canvas Elements or connections."
            )
            return ToolResult(content="\n".join(lines), ok=complete, data=result)
        except Exception as error:
            return error_result(error)
