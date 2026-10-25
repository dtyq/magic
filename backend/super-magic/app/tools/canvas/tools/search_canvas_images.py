"""搜索并导入 Canvas 图片工具。"""

from typing import Any

from pydantic import ConfigDict, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.presentation import CanvasToolDetailBuilder, batch_tool_result, canvas_remark, error_result
from app.tools.canvas.production.contracts import ImageSearchTask
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("search_canvas_image_candidates", min_timeout=600)


class SearchImageTaskInput(BaseToolParams):
    """单个 Canvas 图片搜索任务。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    requirement_explanation: str | None = None
    expected_aspect_ratio: str | None = None
    count: int = Field(3, ge=1, le=20)


@tool(name="search_canvas_image_candidates", code_mode_only=True)
class SearchCanvasImages(BaseTool[BaseToolParams]):
    """搜索、下载并物化 imported Image Content。"""

    name = "search_canvas_image_candidates"
    feedback_action_key = "canvas.search_import_reference_images"

    class Params(BaseToolParams):
        """图片搜索参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        topic_id: str = Field(..., min_length=1)
        tasks: list[SearchImageTaskInput] = Field(..., min_length=1)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None) -> dict[str, str]:
        """生成图片搜索前的用户反馈。"""
        args = arguments or {}
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": canvas_remark("canvas.search_reference_images_pending", topic=args.get("topic_id") or "-"),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: dict[str, Any] | None = None) -> dict[str, str]:
        """生成图片搜索后的用户反馈。"""
        data = result.data or {}
        imported = sum(int(item.get("imported_count") or 0) for item in data.get("items", []))
        failed = sum(int(item.get("failed_count") or 0) for item in data.get("items", []))
        if imported and failed:
            remark = canvas_remark(
                "canvas.search_reference_images_partial",
                imported=imported,
                failed=failed,
            )
        elif imported:
            remark = canvas_remark("canvas.search_reference_images_result", total=imported)
        else:
            remark = i18n.translate("canvas.operation_failed", category="tool.messages")
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None) -> ToolDetail | None:
        """生成图片搜索详情卡片。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "image_search", result, arguments)
        builder.add_field("topic", data.get("topic_id") or builder.arguments.get("topic_id") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "imported": item.get("imported_count", 0),
                    "failed": item.get("failed_count", 0),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """执行图片搜索和逐项物化。"""
        try:
            data = await _application(tool_context).search_images(
                params.project_path,
                params.topic_id,
                [
                    ImageSearchTask(
                        item_ref=item.item_ref,
                        name=item.name,
                        query=item.query,
                        requirement_explanation=item.requirement_explanation,
                        expected_aspect_ratio=item.expected_aspect_ratio,
                        count=item.count,
                    )
                    for item in params.tasks
                ],
                tool_context,
            )
            imported = sum(item.imported_count for item in data.items)
            summary = "Canvas image search completed." if imported else "Canvas image search failed."
            if any(item.status == "partial" for item in data.items):
                summary = "Canvas image search partially completed."
            lines = [summary, f"- Topic: {params.topic_id}"]
            created_ids: list[str] = []
            for item in data.items:
                lines.append(
                    f"- item_ref={item.item_ref} | status={item.status} | "
                    f"imported={item.imported_count} | failed={item.failed_count}"
                )
                created_ids.extend(
                    value.element_id
                    for value in item.items
                    if value.element_id
                )
                if item.error:
                    lines.append(f"  Reason: {item.error}")
            if created_ids:
                lines.append(f"- Created Element IDs: {', '.join(created_ids)}")
            lines.append("Next: review the imported candidates with query_canvas_element_details. Retry only a failed search item if the user requests it.")
            return batch_tool_result(content="\n".join(lines), data=data.to_dict())
        except Exception as error:
            return error_result(error)
