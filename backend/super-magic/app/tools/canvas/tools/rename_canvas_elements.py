"""共享画布标题和各版本文件名的明确命名入口。"""

from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.canvas.application.commands.rename_commands import BatchNaming, RenameElement
from app.tools.canvas.application.rename_elements_service import RenameElementsService
from app.tools.canvas.presentation import error_result
from app.tools.canvas.tools.management_tool import CanvasManagementTool
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool


# 完整说明：agents/skills/canvas-manager/references/naming.md。
@tool(name="rename_canvas_elements", code_mode_only=True)
class RenameCanvasElements(CanvasManagementTool):
    """Rename Canvas titles and Workspace image filenames."""

    name = "rename_canvas_elements"

    class Params(BaseToolParams):
        model_config = ConfigDict(extra="forbid")
        project_path: str = Field(min_length=1)
        items: list[RenameElement] = Field(default_factory=list)
        batch_naming: BatchNaming | None = None
        stage: Literal["prepare", "execute", "recover"] = "prepare"
        recovery_tool_call_id: str | None = Field(
            default=None,
            description="Execution call ID returned by an incomplete rename; used only for stage=recover.",
        )

    params_class = Params

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        try:
            result = await RenameElementsService(_application(tool_context).repository, tool_context).run(
                params.project_path,
                params.items,
                params.stage,
                params.recovery_tool_call_id,
                params.batch_naming,
            )
            lines = [f"Canvas rename stage: {result['stage']}."]
            for item in result.get("items", []):
                if item.get("content_id") and "file_name" not in item:
                    lines.append(
                        f"- element_id={item['element_id']} | content_id={item['content_id']} | status={item['status']} | no completed file to rename."
                    )
                elif "file_name" in item:
                    lines.append(
                        f"- file_id={item['file_id']} | {item['file_name']} -> {item['target_file_name']} | status={item.get('status', 'prepared')}"
                    )
                else:
                    lines.append(
                        f"- element_id={item['element_id']} | canvas_title={item.get('previous_title')} -> {item.get('name')} | status={item.get('status', 'prepared')}"
                    )
                if item.get("error"):
                    lines.append(str(item["error"]))
                if item.get("reason"):
                    lines.append(str(item["reason"]))
            for item in result.get("skipped", []):
                lines.append(f"- content_id={item['content_id']} skipped: no completed file yet.")
            if result["stage"] == "prepared":
                lines.append(
                    "No changes were made. For batch filenames, confirm the exact before/after list using ordinary ask_user questions XML; execute only after explicit agreement."
                )
            if result.get("complete") is False and result.get("recovery_tool_call_id"):
                lines.append(
                    f"For incomplete file outcomes, use stage=recover, recovery_tool_call_id={result['recovery_tool_call_id']}. This only checks file identity and repairs references; it never repeats file writes."
                )
            return ToolResult(content="\n".join(lines), ok=result.get("complete", True), data=result)
        except Exception as error:
            return error_result(error)
