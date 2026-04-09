"""生成视频并添加到画布工具"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.design.constants import DEFAULT_ELEMENT_SPACING
from app.tools.design.tools.base_design_tool import BaseDesignTool
from app.tools.design.tools.batch_create_canvas_elements import BatchCreateCanvasElements, ElementCreationSpec
from app.tools.generate_video import (
    DEFAULT_POLL_INTERVAL_SECONDS,
    DEFAULT_POLL_TIMEOUT_SECONDS,
    GenerateVideo,
    GenerateVideoParams,
)
from app.utils.video_logger import get_video_logger

logger = get_video_logger(__name__)


def _format_tool_context_for_log(tool_context: Optional[ToolContext]) -> str:
    if tool_context is None:
        return "tool_context=none agent_context=missing"

    agent_context = tool_context.get_extension("agent_context")
    return (
        f"tool_context=present agent_context={'present' if agent_context else 'missing'} "
        f"tool_name={getattr(tool_context, 'tool_name', '') or ''} "
        f"tool_call_id={getattr(tool_context, 'tool_call_id', '') or ''}"
    )


@dataclass
class VideoCanvasGenerationResult:
    index: int
    success: bool
    status: str
    operation_id: str
    metadata: Dict[str, Any]
    timed_out: bool = False
    saved_video_relative_path: Optional[str] = None
    saved_poster_relative_path: Optional[str] = None
    error_message: Optional[str] = None
    raw_error_message: Optional[str] = None


class GenerateVideosToCanvasParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目相对路径（包含 magic.project.js 的目录）-->
Design project relative path (folder containing magic.project.js)"""
    )
    prompts: List[str] = Field(
        ...,
        description="""<!--zh: 视频生成提示词列表。每个 prompt 对应一个视频元素-->
Video generation prompts. Each prompt generates one video element"""
    )
    name: str = Field(
        ...,
        description="""<!--zh: 元素名称。多视频时自动追加 _1、_2 序号-->
Element name. For multiple videos, numeric suffixes are added automatically"""
    )
    width: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素宽度。若未显式传 size，且 width/height 与当前模型 featured generation.sizes 中某个尺寸完全匹配，
工具会自动推导对应的视频生成分辨率与宽高比；否则它只作为画布尺寸使用。-->
Video element width on canvas. If size is not explicitly provided and width/height exactly matches a featured generation.sizes entry,
the tool infers the corresponding video generation resolution and aspect ratio; otherwise it is only used for canvas layout."""
    )
    height: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素高度。与 width 一起可用于从 featured generation.sizes 自动匹配视频生成尺寸。-->
Video element height on canvas. Together with width it can auto-match a video generation size from featured generation.sizes."""
    )
    model_id: str = Field("", description="<!--zh: 可选视频模型 ID-->Optional video model ID")
    output_path: str = Field("videos", description="<!--zh: 保留参数，设计生视频固定写入项目内 videos 目录-->Reserved parameter. Design video output is always written to the project's videos directory")
    reference_image_paths: List[str] = Field(default_factory=list, description="<!--zh: 参考图路径或 URL-->Reference image paths or URLs")
    frame_start_path: str = Field("", description="<!--zh: 起始帧路径或 URL-->Start frame path or URL")
    frame_end_path: str = Field("", description="<!--zh: 结束帧路径或 URL-->End frame path or URL")
    size: str = Field(
        "",
        description="""<!--zh: 视频生成尺寸，可选。优先使用 featured generation.sizes.value 中声明的值，例如 1920x1080。
它只影响底层视频生成，不影响画布元素排版尺寸。-->
Video generation size, optional. Prefer values declared in featured generation.sizes.value, e.g. 1920x1080.
It only affects underlying video generation, not canvas layout size."""
    )
    aspect_ratio: str = Field("", description="<!--zh: 视频宽高比，可选-->Video aspect ratio, optional")
    duration_seconds: Optional[int] = Field(default=None, description="<!--zh: 视频时长，可选-->Video duration, optional")
    resolution: str = Field("", description="<!--zh: 视频分辨率，可选-->Video resolution, optional")
    fps: Optional[int] = Field(default=None, description="<!--zh: 视频帧率，可选-->Video FPS, optional")
    seed: Optional[int] = Field(default=None, description="<!--zh: 随机种子，可选-->Random seed, optional")
    watermark: Optional[bool] = Field(default=None, description="<!--zh: 是否保留水印，可选-->Keep watermark, optional")
    extensions: Dict[str, Any] = Field(default_factory=dict, description="<!--zh: 透传扩展参数-->Pass-through extension config")
    override: bool = Field(False, description="<!--zh: 是否覆盖已有文件-->Whether to override existing files")
    poll_interval_seconds: int = Field(DEFAULT_POLL_INTERVAL_SECONDS, description="Polling interval in seconds")
    poll_timeout_seconds: int = Field(DEFAULT_POLL_TIMEOUT_SECONDS, description="Polling timeout in seconds")

    @field_validator("prompts")
    @classmethod
    def validate_prompts(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("prompts 不能为空")
        if len(value) > 4:
            raise ValueError("单次最多支持 4 个视频提示词")
        for prompt in value:
            if not prompt or not prompt.strip():
                raise ValueError("prompt 不能为空")
        return value


@tool()
class GenerateVideosToCanvas(BaseDesignTool[GenerateVideosToCanvasParams]):
    """生成视频并自动添加到画布。

    该工具只负责编排设计项目：
    1. 创建占位 video 元素
    2. 调用底层 generate_video
    3. 回填 src/poster/status/generateVideoRequest

    真正的视频生成、轮询、下载和文件通知全部下沉到通用工具，
    这样设计链路才能与当前 generate_canvas_images -> generate_image 的分层方式保持一致。
    """

    def __init__(self, **data):
        super().__init__(**data)
        self._generate_tool = GenerateVideo()
        self._batch_create_tool = BatchCreateCanvasElements()
        from app.tools.design.tools.batch_update_canvas_elements import BatchUpdateCanvasElements
        self._batch_update_tool = BatchUpdateCanvasElements()

    async def execute(self, tool_context: ToolContext, params: GenerateVideosToCanvasParams) -> ToolResult:
        try:
            logger.info(
                "开始执行设计生视频: "
                f"{_format_tool_context_for_log(tool_context)} "
                f"project_path={params.project_path} prompts={len(params.prompts)} name={params.name}"
            )
            project_path, error_result = await self._ensure_project_ready(
                params.project_path,
                require_magic_project_js=True,
            )
            if error_result:
                return error_result
            resolved_output_path = self._resolve_project_output_path(params.project_path)

            video_names = [params.name] if len(params.prompts) == 1 else [f"{params.name}_{idx + 1}" for idx in range(len(params.prompts))]

            placeholder_specs = [
                ElementCreationSpec(
                    element_type="video",
                    name=video_names[idx],
                    width=params.width,
                    height=params.height,
                    properties={"status": "processing"},
                )
                for idx in range(len(params.prompts))
            ]

            from app.tools.design.tools.batch_create_canvas_elements import BatchCreateCanvasElementsParams

            placeholder_result = await self._batch_create_tool.execute(
                tool_context,
                BatchCreateCanvasElementsParams(
                    project_path=params.project_path,
                    elements=placeholder_specs,
                    layout_mode="horizontal",
                    grid_columns=None,
                    spacing=DEFAULT_ELEMENT_SPACING,
                ),
            )
            if not placeholder_result.ok:
                return placeholder_result

            created_placeholders = placeholder_result.extra_info.get("created_elements", [])
            if not created_placeholders:
                return ToolResult.error("未能创建视频占位元素")

            generation_results: List[VideoCanvasGenerationResult] = []
            for idx, prompt in enumerate(params.prompts):
                logger.info(
                    "开始生成设计视频子任务: "
                    f"index={idx} video_name={video_names[idx]} {_format_tool_context_for_log(tool_context)}"
                )
                generate_result = await self._generate_tool.execute_purely(
                    tool_context,
                    GenerateVideoParams(
                        prompt=prompt,
                        model_id=params.model_id,
                        video_name=video_names[idx],
                        output_path=resolved_output_path,
                        reference_image_paths=params.reference_image_paths,
                        frame_start_path=params.frame_start_path,
                        frame_end_path=params.frame_end_path,
                        size=params.size,
                        width=int(params.width) if params.width is not None else None,
                        height=int(params.height) if params.height is not None else None,
                        aspect_ratio=params.aspect_ratio,
                        duration_seconds=params.duration_seconds,
                        resolution=params.resolution,
                        fps=params.fps,
                        seed=params.seed,
                        watermark=params.watermark,
                        extensions=params.extensions,
                        override=params.override,
                        poll_interval_seconds=params.poll_interval_seconds,
                        poll_timeout_seconds=params.poll_timeout_seconds,
                    ),
                )
                extra_info = generate_result.extra_info or {}
                metadata = self._build_generation_metadata(
                    params=params,
                    prompt=prompt,
                    extra_info=extra_info,
                    resolved_output_path=resolved_output_path,
                )

                generation_results.append(
                    VideoCanvasGenerationResult(
                        index=idx,
                        success=generate_result.ok,
                        status=str(extra_info.get("status", "failed")),
                        operation_id=str(extra_info.get("operation_id", "")),
                        metadata=metadata,
                        timed_out=bool(extra_info.get("timed_out")),
                        saved_video_relative_path=extra_info.get("saved_video_relative_path"),
                        saved_poster_relative_path=extra_info.get("saved_poster_relative_path"),
                        error_message=None if generate_result.ok else generate_result.content,
                        raw_error_message=None if generate_result.ok else self._extract_generate_error_message(generate_result),
                    )
                )
                latest_result = generation_results[-1]
                logger.info(
                    "设计视频子任务结束: "
                    f"index={idx} video_name={video_names[idx]} ok={generate_result.ok} "
                    f"status={latest_result.status} operation_id={latest_result.operation_id}"
                )

            from app.tools.design.tools.batch_update_canvas_elements import (
                BatchUpdateCanvasElementsParams,
                ElementUpdate,
            )

            updates: List[ElementUpdate] = []
            completed_count = 0
            processing_count = 0
            failed_count = 0
            pending_operations: List[Dict[str, Any]] = []

            for result in generation_results:
                placeholder = created_placeholders[result.index]
                properties: Dict[str, Any] = {
                    "generateVideoRequest": result.metadata,
                }

                if result.success and result.status == "succeeded":
                    completed_count += 1
                    properties.update(
                        {
                            "src": result.saved_video_relative_path,
                            "poster": result.saved_poster_relative_path,
                            "status": "completed",
                            "errorMessage": None,
                        }
                    )
                    actual_width = self._normalize_canvas_dimension(result.metadata.get("actual_width"))
                    actual_height = self._normalize_canvas_dimension(result.metadata.get("actual_height"))
                    if actual_width is not None and actual_height is not None:
                        properties["width"] = actual_width
                        properties["height"] = actual_height
                elif result.success and result.timed_out:
                    pending_status = result.status or "queued"
                    processing_count += 1
                    properties.update({"status": "processing"})
                    pending_operations.append(
                        {
                            "element_id": placeholder["id"],
                            "element_name": placeholder["name"],
                            "operation_id": result.operation_id,
                            "request_id": result.metadata.get("request_id"),
                            "status": pending_status,
                        }
                    )
                else:
                    failed_count += 1
                    error_message = result.raw_error_message or result.error_message or "视频生成失败"
                    if result.success:
                        error_message = f"视频生成未在预期轮询语义下结束，当前状态={result.status or 'unknown'}"
                    properties.update(
                        {
                            "status": "failed",
                            "errorMessage": error_message,
                        }
                    )

                updates.append(ElementUpdate(element_id=placeholder["id"], properties=properties))

            elements_detail = placeholder_result.extra_info.get("elements", [])
            if updates:
                update_result = await self._batch_update_tool.execute(
                    tool_context,
                    BatchUpdateCanvasElementsParams(project_path=params.project_path, updates=updates),
                )
                if not update_result.ok:
                    logger.warning(f"更新视频占位元素失败: {update_result.content}")
                else:
                    elements_detail = update_result.extra_info.get("elements", elements_detail)
            logger.info(
                "设计生视频执行完成: "
                f"project_path={params.project_path} completed={completed_count} "
                f"processing={processing_count} failed={failed_count}"
            )
            content = self._build_result_content(
                project_path=params.project_path,
                created_placeholders=created_placeholders,
                completed_count=completed_count,
                processing_count=processing_count,
                failed_count=failed_count,
                pending_operations=pending_operations,
            )

            if completed_count == 0 and processing_count == 0 and failed_count == len(created_placeholders):
                failed_elements_desc = "; ".join(
                    f"{elem['name']} (id: {elem['id']})"
                    for elem in created_placeholders
                )
                failed_reasons = self._build_failed_reasons(created_placeholders, generation_results)
                error_content = (
                    f"Video generation failed: all {len(created_placeholders)} video(s) failed to generate. "
                    f"Failed placeholder elements were created in canvas with status=failed: {failed_elements_desc}"
                )
                if failed_reasons:
                    error_content = f"{error_content}. Detailed errors: {'; '.join(failed_reasons)}"
                return ToolResult.error(
                    error_content,
                    extra_info={
                        "error_type": "design.error_unexpected",
                        "project_path": params.project_path,
                        "total_count": len(created_placeholders),
                        "completed_count": completed_count,
                        "processing_count": processing_count,
                        "failed_count": failed_count,
                        "pending_operations": pending_operations,
                        "created_elements": created_placeholders,
                        "elements": elements_detail,
                        "failed_reasons": failed_reasons,
                    },
                )

            return ToolResult(
                content=content,
                extra_info={
                    "project_path": params.project_path,
                    "total_count": len(created_placeholders),
                    "completed_count": completed_count,
                    "processing_count": processing_count,
                    "failed_count": failed_count,
                    "pending_operations": pending_operations,
                    "created_elements": created_placeholders,
                    "elements": elements_detail,
                },
            )
        except Exception as e:
            logger.exception(f"生成视频到画布失败: {e!s}")
            return ToolResult.error(
                f"生成视频到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"},
            )

    @staticmethod
    def _resolve_project_output_path(project_path: str) -> str:
        # 设计生视频与设计生图保持一致，目录由工具固定决定，不允许模型参与。
        return (Path(project_path) / "videos").as_posix()

    @staticmethod
    def _build_generation_metadata(
        params: GenerateVideosToCanvasParams,
        prompt: str,
        extra_info: Dict[str, Any],
        resolved_output_path: str,
    ) -> Dict[str, Any]:
        metadata = dict(extra_info.get("metadata") or {})
        fallback_metadata = {
            "model_id": params.model_id,
            "prompt": prompt,
            "operation_id": extra_info.get("operation_id", ""),
            "request_id": extra_info.get("request_id", ""),
            "size": params.size or None,
            "requested_width": int(params.width) if params.width is not None else None,
            "requested_height": int(params.height) if params.height is not None else None,
            "aspect_ratio": params.aspect_ratio or None,
            "duration_seconds": params.duration_seconds,
            "resolution": params.resolution or None,
            "fps": params.fps,
            "seed": params.seed,
            "watermark": params.watermark,
            "reference_images": list(params.reference_image_paths),
            "frames": [
                item
                for item in (
                    {"role": "start", "uri": params.frame_start_path} if params.frame_start_path else None,
                    {"role": "end", "uri": params.frame_end_path} if params.frame_end_path else None,
                )
                if item is not None
            ],
            "file_dir": resolved_output_path,
        }
        metadata["file_dir"] = resolved_output_path
        for key, value in fallback_metadata.items():
            if key == "file_dir":
                continue
            if GenerateVideosToCanvas._should_fill_generation_metadata(metadata.get(key), value):
                metadata[key] = value
        return metadata

    @staticmethod
    def _should_fill_generation_metadata(existing_value: Any, fallback_value: Any) -> bool:
        if fallback_value is None:
            return existing_value is None
        if isinstance(existing_value, str):
            return not existing_value.strip()
        if isinstance(existing_value, (list, dict)):
            return not existing_value
        return existing_value is None

    @staticmethod
    def _normalize_canvas_dimension(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            normalized = float(value)
        except (TypeError, ValueError):
            return None
        if normalized <= 0:
            return None
        return normalized

    @staticmethod
    def _build_result_content(
        project_path: str,
        created_placeholders: List[Dict[str, Any]],
        completed_count: int,
        processing_count: int,
        failed_count: int,
        pending_operations: List[Dict[str, Any]],
    ) -> str:
        lines = [
            "Generated Videos and Added to Canvas:",
            f"- Completed: {completed_count}",
            f"- Processing: {processing_count}",
            f"- Failed: {failed_count}",
            f"- Project: {project_path}",
        ]
        if created_placeholders:
            lines.append("")
            lines.append("Created Elements:")
            for elem in created_placeholders:
                lines.append(f"- {elem['name']} (id: {elem['id']}) at ({elem['x']:.0f}, {elem['y']:.0f})")
        if pending_operations:
            lines.extend(
                [
                    "",
                    "These video tasks were polled until timeout and are still in progress.",
                    "If the user explicitly asks to check progress later, use query_video_generation. Do not switch to generate_canvas_images unless the user explicitly asks for a static image result.",
                    "Pending Operations:",
                ]
            )
            for operation in pending_operations:
                lines.append(
                    f"- {operation['element_name']} (element_id: {operation['element_id']}), operation_id: {operation['operation_id']}, "
                    f"request_id: {operation.get('request_id') or 'N/A'}, status: {operation['status']}"
                )
        return "\n".join(lines)

    @staticmethod
    def _build_failed_reasons(
        created_placeholders: List[Dict[str, Any]],
        generation_results: List[VideoCanvasGenerationResult],
    ) -> List[str]:
        failed_reasons: List[str] = []
        for result in generation_results:
            if result.success:
                continue

            placeholder = created_placeholders[result.index]
            error_message = (result.raw_error_message or result.error_message or "视频生成失败").strip()
            failed_reasons.append(
                f"{placeholder['name']} (id: {placeholder['id']}): {error_message}"
            )
        return failed_reasons

    @staticmethod
    def _extract_generate_error_message(result: ToolResult) -> str:
        extra_info = result.extra_info or {}
        raw_error = extra_info.get("raw_error")
        if isinstance(raw_error, str) and raw_error.strip():
            return raw_error.strip()
        return (result.content or "视频生成失败").strip()

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict[str, str]:
        if not result.ok:
            return self._handle_design_tool_error(
                result,
                default_action_code="generate_videos_to_canvas",
                default_success_message_code="generate_videos_to_canvas.exception",
            )

        extra_info = result.extra_info or {}
        completed_count = extra_info.get("completed_count", 0)
        processing_count = extra_info.get("processing_count", 0)
        failed_count = extra_info.get("failed_count", 0)
        remark = i18n.translate(
            "generate_videos_to_canvas.summary",
            category="tool.messages",
            completed=completed_count,
            processing=processing_count,
            failed=failed_count,
        )
        return {
            "action": i18n.translate("generate_videos_to_canvas", category="tool.actions"),
            "remark": remark,
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        if not result.ok:
            return None

        try:
            from app.core.entity.message.server_message import DesignElementContent

            extra_info = result.extra_info or {}
            return ToolDetail(
                type=DisplayType.DESIGN,
                data=DesignElementContent(
                    type="element",
                    project_path=extra_info.get("project_path", ""),
                    elements=extra_info.get("elements", []),
                ),
            )
        except Exception as e:
            logger.error(f"生成设计视频工具详情失败: {e!s}")
            return None
