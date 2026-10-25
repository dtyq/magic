"""管理工具只复用既有反馈，不重写应用层的执行状态。"""

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import CanvasToolDetailBuilder
from app.tools.canvas.presentation.batch_status import canvas_result_remark, summarize_tool_result
from app.tools.core import BaseToolParams
from app.tools.core.base_tool import BaseTool


class CanvasManagementTool(BaseTool[BaseToolParams]):
    """Shared presentation for Canvas management tools."""

    @staticmethod
    def error_text(code: str) -> str:
        key = f"canvas.management_error.{code}"
        text = i18n.translate(key, category="tool.messages")
        return (
            text if text != key else i18n.translate("canvas.management_error.INTERNAL_ERROR", category="tool.messages")
        )

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, object] | None = None,
    ) -> dict[str, str]:
        return {
            "action": i18n.translate(self.name, category="tool.actions"),
            "remark": canvas_result_remark(summarize_tool_result(result)),
        }

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: dict[str, object] | None = None,
    ) -> ToolDetail:
        data = result.data or {}
        # 快照、路径、身份和确认记录用于执行；详情只投影业务结果，不制造 partial 项。
        fields = {key: data[key] for key in ("project_path", "stage", "matched", "has_more") if key in data}
        if "stage" in fields:
            fields["stage"] = CanvasToolDetailBuilder.status_value(fields["stage"])
        if "has_more" in fields:
            fields["has_more"] = CanvasToolDetailBuilder.boolean_value(fields["has_more"])
        values = data.get("items", data.get("elements", []))
        rows = [
            {key: row[key] for key in ("name", "status", "file_name", "target_file_name", "error_code") if key in row}
            for row in values
        ]
        fields["items" if "items" in data else "elements"] = rows
        file_rows = (
            [
                {key: file[key] for key in ("file_name", "status", "error_code") if key in file}
                for file in data.get("files", [])
            ]
            if data.get("stage") != "prepared"
            else []
        )
        for row in [*rows, *file_rows]:
            if row.get("error_code"):
                code = str(row.pop("error_code"))
                row["error"] = self.error_text(code)
        if not result.ok:
            code = str(data.get("error_code") or "OPERATION_INCOMPLETE")
            fields["error"] = self.error_text(code)
        visible = ToolResult(content="", ok=result.ok, data=fields)
        inputs = {
            key: value
            for key, value in (arguments or {}).items()
            if key in {"project_path", "operation", "mode", "stage"}
        }
        builder = CanvasToolDetailBuilder(self.name, self.name, visible, inputs)
        for row in [*rows, *file_rows]:
            builder.add_item(row)
        return builder.build()
