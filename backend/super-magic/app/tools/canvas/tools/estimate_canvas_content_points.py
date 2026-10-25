"""预估 Canvas 内容产出积分工具。"""

from typing import Any, Literal

from pydantic import ConfigDict, Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import ToolDetail
from app.i18n import i18n
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.presentation import CanvasToolDetailBuilder, canvas_remark, error_result
from app.tools.canvas.production.contracts import VideoPointEstimateItem
from app.tools.canvas.tools.add_canvas_elements import VideoInputMode
from app.tools.canvas.tools.support import _application
from app.tools.core import BaseToolParams, tool
from app.tools.core.base_tool import BaseTool
from app.tools.snippet_timeout_registry import SdkSnippetTimeoutRegistry

SdkSnippetTimeoutRegistry.register("estimate_canvas_content_points", min_timeout=600)


class VideoPointEstimateItemInput(BaseToolParams):
    """单个视频积分预估项。"""

    model_config = ConfigDict(extra="forbid")

    item_ref: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    model_id: str | None = None
    name: str | None = Field(
        None,
        min_length=1,
        description="视频输出名称，应与后续生成请求保持一致；系统会追加短唯一值。",
    )
    size: str | None = None
    reference_images: list[str] = Field(default_factory=list)
    reference_image_paths: list[str] = Field(default_factory=list)
    reference_video_paths: list[str] = Field(default_factory=list)
    reference_audio_paths: list[str] = Field(default_factory=list)
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

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_reference_images(cls, values: Any) -> Any:
        """把旧版 reference_image_paths 兼容归一化到 reference_images。"""
        if not isinstance(values, dict):
            return values
        normalized = dict(values)
        if not normalized.get("reference_images") and normalized.get("reference_image_paths"):
            normalized["reference_images"] = normalized["reference_image_paths"]
        return normalized

    def to_parameters(self) -> GenerationParameters:
        """转换为不包含开放扩展字典的生成参数。"""
        return GenerationParameters(
            prompt=self.prompt,
            model_id=self.model_id,
            name=self.name,
            size=self.size,
            reference_images=tuple(self.reference_images),
            reference_image_paths=tuple(self.reference_image_paths),
            reference_video_paths=tuple(self.reference_video_paths),
            reference_audio_paths=tuple(self.reference_audio_paths),
            frame_start_path=self.frame_start_path,
            frame_end_path=self.frame_end_path,
            input_mode=self.input_mode,
            task=self.task,
            duration_seconds=self.duration_seconds,
            aspect_ratio=self.aspect_ratio,
            resolution=self.resolution,
            fps=self.fps,
            seed=self.seed,
            watermark=self.watermark,
            draft=self.draft,
        )


@tool(name="estimate_canvas_content_points", code_mode_only=True)
class EstimateCanvasContentPoints(BaseTool[BaseToolParams]):
    """对支持计费的内容产出规则执行无副作用积分预估。"""

    name = "estimate_canvas_content_points"
    feedback_action_key = "canvas.estimate_video_points"

    class Params(BaseToolParams):
        """批量积分预估参数。"""

        model_config = ConfigDict(extra="forbid")

        project_path: str = Field(..., min_length=1, description="Workspace-relative Canvas project path.")
        production_rule: Literal["video_generation"] = "video_generation"
        items: list[VideoPointEstimateItemInput] = Field(..., min_length=1)

    params_class = Params

    async def get_before_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, arguments: dict[str, Any] | None = None) -> dict[str, str]:
        """生成积分预估前的用户反馈。"""
        args = arguments or {}
        return {
            "action": i18n.translate(self.feedback_action_key, category="tool.actions"),
            "remark": canvas_remark("canvas.estimate_video_pending", total=len(args.get("items") or [])),
            "tool_name": tool_name,
        }

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: dict[str, Any] | None = None) -> dict[str, str]:
        """生成积分预估后的用户反馈。"""
        # 保留积分预估工具自身的成功、失败和不可用状态 remark。
        result.use_custom_remark = True
        data = result.data or {}
        items = data.get("items", []) if isinstance(data, dict) else []
        statuses = {
            str(item.get("status") or "").casefold()
            for item in items
            if isinstance(item, dict)
        }
        reasons = " ".join(
            str(item.get("reason") or "") for item in items if isinstance(item, dict)
        ).casefold()
        has_start_frame = any(
            isinstance(item, dict) and item.get("frame_start_path")
            for item in (arguments or {}).get("items", [])
        )
        reference_unavailable = any(
            marker in reasons
            for marker in (
                "引用文件不存在",
                "reference file",
                "asset_not_found",
                "code=14000",
            )
        )
        if has_start_frame and reference_unavailable:
            remark = i18n.translate(
                "canvas.estimate_video_failed_first_frame",
                category="tool.messages",
            )
        elif "failed" in statuses or (not items and not result.ok):
            remark = i18n.translate("canvas.estimate_video_failed", category="tool.messages")
        elif data.get("can_continue"):
            remark = canvas_remark("canvas.estimate_video_result", points=data.get("total_points", 0))
        else:
            remark = canvas_remark("canvas.estimate_video_unavailable")
        return {"action": i18n.translate(self.feedback_action_key, category="tool.actions"), "remark": remark}

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict[str, Any] | None = None) -> ToolDetail | None:
        """生成积分预估详情卡片。"""
        data = result.data or {}
        builder = CanvasToolDetailBuilder(self.name, "content_point_estimate", result, arguments)
        builder.add_field("rule", data.get("production_rule") or builder.arguments.get("production_rule") or "-")
        for item in data.get("items", []):
            builder.add_item(
                {
                    "item_ref": item.get("item_ref", "-"),
                    "status": item.get("status", "-"),
                    "points": item.get("points", "-"),
                }
            )
        return builder.build()

    async def execute(self, tool_context: ToolContext, params: Params) -> ToolResult:
        """执行积分预估并返回估算凭证。"""
        try:
            result = await _application(tool_context).estimate_content_points(
                params.project_path,
                params.production_rule,
                [VideoPointEstimateItem(item.item_ref, item.to_parameters()) for item in params.items],
                tool_context,
            )
            if result.can_continue:
                lines = ["Video generation point estimate completed.", f"- Rule: {params.production_rule}"]
                for item in result.items:
                    lines.append(f"- item_ref={item.item_ref}: {item.points} points")
                lines.extend([
                    f"- Total video generation points: {result.total_points}",
                    f"- Estimate ID: {result.estimate_id}",
                    "Next: ask the user to confirm the parameters and estimated points. After confirmation, submit video generation with the same frozen parameters. The estimate ID is informational and is not required by the generation tool.",
                ])
            else:
                lines = ["Video generation point estimate is unavailable.", f"- Rule: {params.production_rule}"]
                for item in result.items:
                    lines.append(f"- item_ref={item.item_ref} | status={item.status} | reason={item.reason or '-'}")
                lines.append("Next: ask the user whether to revise or cancel. Do not submit generation automatically.")
            return ToolResult(
                content="\n".join(lines),
                ok=result.can_continue,
                data=result.to_dict(),
            )
        except Exception as error:
            return error_result(error)
