"""初始化 Canvas 工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import CanvasToolDetailBuilder, canvas_remark, error_result
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


@tool(name="initialize_canvas", code_mode_only=True)
class InitializeCanvas(BaseTool[BaseToolParams]):
    """<!--zh: 初始化 Canvas 项目。-->Initialize a Canvas project."""

    name = "initialize_canvas"
    feedback_action_key = "canvas.initialize"

    class Params(BaseToolParams):
        """Canvas 项目初始化参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成初始化前的项目级反馈。"""
        project_path = (arguments or {}).get("project_path", "")
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": canvas_remark("canvas.initialize_pending", project_path),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        """生成初始化后的创建状态反馈。"""
        project_path = (arguments or {}).get("project_path", "")
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            code = "canvas.initialize_created" if (result.data or {}).get("created") else "canvas.initialize_existing"
            remark = canvas_remark(code, project_path)
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成初始化工具自己的详情卡片。"""
        data = result.data or {}
        project_path = data.get("project_path") or (arguments or {}).get("project_path") or "-"
        builder = CanvasToolDetailBuilder(self.name, "initialization", result, arguments)
        builder.add_field("project_path", project_path)
        builder.add_field("state", "created" if data.get("created") else "already existed")
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """初始化项目并返回工作区相对路径。"""
        try:
            result = await _application(tool_context).initialize(params.project_path)
            state = "created" if result["created"] else "already existed"
            return ToolResult(
                content=f"Canvas project {state}.\n- Project path: {params.project_path}",
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
