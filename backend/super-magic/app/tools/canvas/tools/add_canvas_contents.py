"""追加 Canvas Content 工具。"""

from functools import partial
from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import AddContentCommand
from app.tools.canvas.presentation import (
    CanvasGenerationFeedback,
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    canvas_result_remark,
    error_result,
    items_content,
    summarize_tool_result,
)
from app.tools.canvas.tools.add_canvas_elements import ContentInput
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("add_canvas_contents", min_timeout=600)


class AddContentInput(BaseToolParams):
    """单个追加 Content 参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_id: str = Field(..., min_length=1)
    content: ContentInput

    def to_command(self) -> AddContentCommand:
        """转换为应用层追加 Content 命令。"""
        return AddContentCommand(
            item_ref=self.item_ref,
            element_id=self.element_id,
            content=self.content.to_command(),
        )


@tool(name="add_canvas_contents", code_mode_only=True)
class AddCanvasContents(BaseTool[BaseToolParams]):
    """<!--zh: 向已有 Element 追加 Content。-->Add Content versions to existing Elements."""

    name = "add_canvas_contents"
    feedback_action_key = "add_canvas_contents"

    class Params(BaseToolParams):
        """批量追加 Content 参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[AddContentInput] = Field(..., min_length=1)

    params_class = Params

    @staticmethod
    def _operation_action_key(arguments: dict[str, Any], fallback: str) -> str:
        """根据追加 Content 的类型选择 Storyboard 或 Video Edit 专用 action。"""
        content_types = {
            item.get("content", {}).get("content_type")
            for item in arguments.get("items", [])
            if isinstance(item, dict) and isinstance(item.get("content"), dict)
        }
        if content_types == {"storyboard"}:
            return "canvas.create_storyboard"
        if content_types == {"video-edit"}:
            return "canvas.create_video_edit"
        return fallback

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成追加 Content 前的来源反馈。"""
        args = arguments or {}
        generation_summary = CanvasGenerationFeedback.from_arguments(args)
        if CanvasGenerationFeedback.is_pure_generated_batch(args):
            return {
                "action": i18n.translate(
                    CanvasGenerationFeedback.action_key(generation_summary, pending=True),
                    category="tool.actions",
                ),
                "remark": CanvasGenerationFeedback.remark(
                    generation_summary,
                    pending=True,
                    names=CanvasGenerationFeedback.item_names(args),
                ),
                "tool_name": tool_name,
            }
        items = args.get("items") or []
        sources = {
            str(item.get("content", {}).get("source"))
            for item in items
            if isinstance(item, dict) and isinstance(item.get("content"), dict)
        }
        action_key = "canvas.add_generated_content" if sources == {"generated"} else (
            "canvas.import_content" if sources == {"imported"} else self.feedback_action_key
        )
        action_key = self._operation_action_key(args, action_key)
        project_path = args.get("project_path", "")
        remark = canvas_remark("canvas.add_contents_pending", project_path, total=len(items))
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
        """生成追加 Content 后的逐项反馈。"""
        # 保留 Canvas 工具自身按结果状态生成的 remark，避免失败时被通用文案覆盖。
        result.use_custom_remark = True
        generation_summary = CanvasGenerationFeedback.from_arguments(arguments)
        batch_status = summarize_tool_result(result)
        values = (result.data or {}).get("items", [])
        if CanvasGenerationFeedback.is_pure_generated_batch(arguments):
            generation_summary = CanvasGenerationFeedback.from_result(result, arguments)
            if not values and not result.ok:
                return {
                    "action": i18n.translate(
                        CanvasGenerationFeedback.action_key(generation_summary),
                        category="tool.actions",
                    ),
                    "remark": CanvasGenerationFeedback.failure_remark(
                        generation_summary,
                        CanvasGenerationFeedback.item_names(arguments),
                    ),
                }
            return {
                "action": i18n.translate(
                    CanvasGenerationFeedback.action_key(generation_summary),
                    category="tool.actions",
                ),
                "remark": CanvasGenerationFeedback.remark_for_result(result, arguments),
            }
        else:
            if not values and not result.ok:
                remark = i18n.translate("canvas.operation_failed", category="tool.messages")
            else:
                remark = canvas_result_remark(batch_status)
        args = arguments or {}
        sources = {
            str(item.get("content", {}).get("source"))
            for item in args.get("items", [])
            if isinstance(item, dict) and isinstance(item.get("content"), dict)
        }
        action_key = "canvas.add_generated_content" if sources == {"generated"} else (
            "canvas.import_content" if sources == {"imported"} else self.feedback_action_key
        )
        action_key = self._operation_action_key(args, action_key)
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成追加 Content 自己的版本详情。"""
        data = result.data or {}
        generation_summary = CanvasGenerationFeedback.from_result(result, arguments)
        is_generation_batch = (
            CanvasGenerationFeedback.is_pure_generated_batch(arguments) and generation_summary.is_supported
        )
        if is_generation_batch:
            operation_detail = CanvasGenerationFeedback.operation_result_detail(result, arguments)
            if operation_detail is not None:
                return operation_detail
        title_key = (
            CanvasGenerationFeedback.detail_title_key(generation_summary)
            if is_generation_batch
            else "content_versions_added"
        )
        builder = CanvasToolDetailBuilder(self.name, title_key, result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        if is_generation_batch:
            builder.add_field("media_type", generation_summary.media_label())
            for media_type in generation_summary.media_types:
                counts = generation_summary.by_type[media_type]
                builder.add_item(
                    {
                        "media_type": CanvasGenerationFeedback.media_label_for_type(media_type),
                        "total": counts.total,
                        "completed": counts.completed,
                        "processing": counts.processing,
                        "failed": counts.failed,
                    }
                )
        for item in data.get("items", []):
            media_type = CanvasGenerationFeedback.media_type_for_item(item, arguments)
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "element_id": item.get("element_id", "-"),
                    "content_id": item.get("content_id", "-"),
                    **({"asset_path": item["asset_path"]} if item.get("asset_path") else {}),
                    **({"media_type": CanvasGenerationFeedback.media_label_for_type(media_type)} if media_type else {}),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """追加 Content 版本，不覆盖已有版本。"""
        try:
            application = _application(tool_context)
            commands = [item.to_command() for item in params.items]
            await CanvasAgentWritePolicy.validate_targets(application.repository, params.project_path, commands)
            result = await application.add_contents(
                params.project_path,
                commands,
                tool_context=tool_context,
                on_placeholders_created=partial(
                    CanvasGenerationFeedback.report_placeholders, self, tool_context, params.model_dump(),
                ),
            )
            return batch_tool_result(
                content=items_content(
                    "Canvas Content version operation result.",
                    result.to_dict(),
                    "call query_canvas_element_details with the returned element_id values to verify the Content versions",
                ),
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
