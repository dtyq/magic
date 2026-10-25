"""选择 Canvas 主 Content 工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import SelectMainContentCommand
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    error_result,
    items_content,
)
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application, resolve_element_types
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool


class MainContentInput(BaseToolParams):
    """单个主 Content 选择参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_id: str = Field(..., min_length=1)
    content_id: str = Field(..., min_length=1)

    def to_command(self) -> SelectMainContentCommand:
        """转换为应用层主 Content 选择命令。"""
        return SelectMainContentCommand(self.item_ref, self.element_id, self.content_id)


@tool(name="select_canvas_main_content", code_mode_only=True)
class SelectCanvasMainContent(BaseTool[BaseToolParams]):
    """<!--zh: 显式选择 Element 的主 Content。-->Select the main Content for Elements."""

    name = "select_canvas_main_content"
    feedback_action_key = "canvas.select_main"

    class Params(BaseToolParams):
        """批量选择主 Content 参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[MainContentInput] = Field(..., min_length=1)

    params_class = Params

    @staticmethod
    def _media_action_key(media_types: frozenset[str], fallback: str) -> str:
        """根据目标 Element 类型选择图片或视频主版本文案。"""
        if media_types == {"image"}:
            return "canvas.select_image_main"
        if media_types == {"video"}:
            return "canvas.select_video_main"
        return fallback

    @staticmethod
    def _media_remark_key(media_types: frozenset[str], phase: str) -> str:
        """根据目标 Element 类型选择主版本操作的阶段文案。"""
        if media_types == {"image"}:
            return f"canvas.select_image_main_{phase}"
        if media_types == {"video"}:
            return f"canvas.select_video_main_{phase}"
        return f"canvas.select_main_{phase}"

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成主 Content 切换前的明确目标反馈。"""
        args = arguments or {}
        items = args.get("items") or []
        project_path = args.get("project_path", "")
        element_ids = [
            str(item.get("element_id"))
            for item in items
            if isinstance(item, dict) and item.get("element_id")
        ]
        media_types = await resolve_element_types(tool_context, project_path, element_ids)
        action_key = self._media_action_key(media_types, self.feedback_action_key)
        remark = canvas_remark(
            self._media_remark_key(media_types, "pending"),
            project_path,
            total=len(items),
        )
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
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
        """生成主 Content 切换后的结果反馈。"""
        values = (result.data or {}).get("items", [])
        args = arguments or {}
        project_path = str(args.get("project_path") or "")
        element_ids = [
            str(item.get("element_id"))
            for item in values
            if isinstance(item, dict) and item.get("element_id")
        ] or [
            str(item.get("element_id"))
            for item in args.get("items", [])
            if isinstance(item, dict) and item.get("element_id")
        ]
        media_types = await resolve_element_types(tool_context, project_path, element_ids)
        action_key = self._media_action_key(media_types, self.feedback_action_key)
        if not result.ok:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        else:
            remark = canvas_remark(
                self._media_remark_key(media_types, "result"),
                total=len(values),
            )
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成主 Content 选择自己的指针变更详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "main_content_selection", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "element_id": item.get("element_id", "-"),
                    "main_content_id": item.get("main_content_id", "-"),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """只修改明确选择的 main Content 指针。"""
        try:
            application = _application(tool_context)
            commands = [item.to_command() for item in params.items]
            await CanvasAgentWritePolicy.validate_targets(application.repository, params.project_path, commands)
            result = await application.select_main(
                params.project_path,
                commands,
            )
            return batch_tool_result(
                content=items_content(
                    "Canvas main Content selected successfully.",
                    result.to_dict(),
                    "call query_canvas_element_details with the returned element_id values to verify the main Content selection",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
