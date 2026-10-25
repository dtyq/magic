"""重试 Canvas Content 生成工具。"""

from typing import Any, Literal

from pydantic import ConfigDict, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import GenerationParametersOverride, RetryContentCommand
from app.tools.canvas.presentation import (
    CanvasToolDetailBuilder,
    batch_tool_result,
    canvas_remark,
    canvas_result_remark,
    error_result,
    items_content,
    summarize_items,
    summarize_tool_result,
)
from app.tools.canvas.tools.add_canvas_elements import VideoInputMode
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy
from app.tools.canvas.tools.support import _application, resolve_element_types
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("retry_canvas_content_generation", min_timeout=600)


class GenerationOverrideInput(BaseToolParams):
    """失败生成重试允许覆盖的确定参数。"""

    model_config = ConfigDict(extra="forbid")

    prompt: str | None = Field(None, min_length=1)
    model_id: str | None = None
    name: str | None = None
    size: str | None = None
    reference_images: list[str] | None = None
    reference_image_paths: list[str] | None = None
    reference_video_paths: list[str] | None = None
    reference_audio_paths: list[str] | None = None
    frame_start_path: str | None = None
    frame_end_path: str | None = None
    input_mode: VideoInputMode | None = None
    task: Literal["generate", "edit"] | None = None
    duration_seconds: int | None = Field(None, gt=0)
    aspect_ratio: str | None = None
    resolution: str | None = None
    fps: int | None = Field(None, gt=0)
    seed: int | None = None
    watermark: bool | None = None
    draft: bool | None = None
    audio_policy: Literal["auto", "generate", "mute"] | None = Field(
        None,
        alias="audioPolicy",
        description="统一视频音频策略覆盖：auto、generate 或 mute。",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_reference_images(cls, values: Any) -> Any:
        """把旧版 reference_image_paths 兼容归一化到 reference_images。"""
        if not isinstance(values, dict):
            return values
        normalized = dict(values)
        if "reference_images" not in normalized and "reference_image_paths" in normalized:
            normalized["reference_images"] = normalized["reference_image_paths"]
        return normalized

    def to_command(self) -> GenerationParametersOverride:
        """只转换本次明确填写的覆盖字段。"""
        values = self.model_dump(exclude_none=True)
        provided_fields = frozenset(values)
        for field_name in ("reference_images", "reference_image_paths", "reference_video_paths", "reference_audio_paths"):
            if field_name in values:
                values[field_name] = tuple(values[field_name])
        return GenerationParametersOverride(
            prompt=values.get("prompt"),
            model_id=values.get("model_id"),
            name=values.get("name"),
            size=values.get("size"),
            reference_images=values.get("reference_images"),
            reference_image_paths=values.get("reference_image_paths"),
            reference_video_paths=values.get("reference_video_paths"),
            reference_audio_paths=values.get("reference_audio_paths"),
            frame_start_path=values.get("frame_start_path"),
            frame_end_path=values.get("frame_end_path"),
            input_mode=values.get("input_mode"),
            task=values.get("task"),
            duration_seconds=values.get("duration_seconds"),
            aspect_ratio=values.get("aspect_ratio"),
            resolution=values.get("resolution"),
            fps=values.get("fps"),
            seed=values.get("seed"),
            watermark=values.get("watermark"),
            draft=values.get("draft"),
            audio_policy=values.get("audio_policy"),
            _provided_fields=provided_fields,
        )


class RetryContentInput(BaseToolParams):
    """单个失败 Content 重试参数。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    element_id: str = Field(..., min_length=1)
    content_id: str = Field(..., min_length=1)
    generation_override: GenerationOverrideInput | None = None

    def to_command(self) -> RetryContentCommand:
        """转换为应用层失败 Content 重试命令。"""
        return RetryContentCommand(
            item_ref=self.item_ref,
            element_id=self.element_id,
            content_id=self.content_id,
            generation_override=self.generation_override.to_command() if self.generation_override else None,
        )


@tool(name="retry_canvas_content_generation", code_mode_only=True)
class RetryCanvasContentGeneration(BaseTool[BaseToolParams]):
    """<!--zh: 重试失败的 generated Content。-->Retry failed generated Content."""

    name = "retry_canvas_content_generation"
    feedback_action_key = "canvas.retry_generation"

    class Params(BaseToolParams):
        """批量生成重试参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        items: list[RetryContentInput] = Field(..., min_length=1)

    params_class = Params

    @staticmethod
    def _media_action_key(media_types: frozenset[str], fallback: str) -> str:
        """根据重试目标 Element 类型选择图片或视频专用 action。"""
        if media_types == {"image"}:
            return "canvas.retry_image_generation"
        if media_types == {"video"}:
            return "canvas.retry_video_generation"
        return fallback

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None
    ) -> dict[str, str]:
        """生成失败 Content 重试前的受控反馈。"""
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
        remark_key = (
            "canvas.retry_image_pending"
            if media_types == {"image"}
            else "canvas.retry_video_pending"
            if media_types == {"video"}
            else "canvas.retry_pending"
        )
        remark = canvas_remark(remark_key, project_path, total=len(items))
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
        """生成重试结果和失败上限反馈。"""
        batch_status = summarize_tool_result(result)
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
        if not values and not result.ok:
            remark_key = (
                "canvas.retry_image_failed"
                if media_types == {"image"}
                else "canvas.retry_video_failed"
                if media_types == {"video"}
                else "canvas.operation_failed"
            )
            remark = i18n.translate(remark_key, category="tool.messages")
        else:
            limited = sum(1 for item in values if item.get("error_code") == "CONTENT_RETRY_LIMIT_REACHED")
            if batch_status.status in {"partial", "failed"}:
                remark = canvas_result_remark(batch_status)
            else:
                result_key = (
                    "canvas.retry_image_result"
                    if media_types == {"image"}
                    else "canvas.retry_video_result"
                    if media_types == {"video"}
                    else "canvas.retry_result"
                )
                remark = (
                    canvas_remark(result_key, total=len(values))
                    if result_key != "canvas.retry_result"
                    else canvas_remark("canvas.retry_result", retried=len(values) - limited, limited=limited)
                )
        return {
            "action": i18n.translate(action_key, category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None
    ) -> ToolDetail | None:
        """生成重试工具自己的任务详情。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "content_retry", result, arguments)
        builder.add_field("project_path", data.get("project_path") or builder.arguments.get("project_path") or "-")
        for item in data.get("items", []):
            fields = {
                "item_ref": item.get("item_ref", "-"),
                "status": item.get("status", "-"),
                "element_id": item.get("element_id", "-"),
                "content_id": item.get("content_id", "-"),
                "task_id": item.get("generation_task_id", "-"),
            }
            if item.get("error"):
                fields["error"] = item["error"]
            builder.add_item(fields)
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """在重试上限内复用原 Content ID。"""
        try:
            application = _application(tool_context)
            commands = [item.to_command() for item in params.items]
            await CanvasAgentWritePolicy.validate_targets(application.repository, params.project_path, commands)
            result = await application.retry_content(
                params.project_path,
                commands,
                tool_context=tool_context,
            )
            result_data = result.to_dict()
            batch_status = summarize_items(result_data.get("items"), fallback_ok=True)
            summary = {
                "succeeded": "Canvas failed Content retry completed.",
                "processing": "Canvas failed Content retry started.",
                "partial": "Canvas failed Content retry partially failed.",
                "failed": "Canvas failed Content retry failed.",
            }.get(batch_status.status, "Canvas failed Content retry completed.")
            return batch_tool_result(
                content=items_content(
                    summary,
                    result_data,
                    "call query_canvas_element_details with the returned element_id values to verify the retried Content",
                ),
                data=result_data,
            )
        except Exception as error:
            return error_result(error)
