"""AI 视频生成并添加到画布工具（任务列表版）

每个 task 独立指定 prompt / name / width / height，
有几个 task 就生成几个视频，并发执行。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.design.tools.base_generate_canvas_elements import (
    BaseGenerateCanvasElements,
    ElementDetail,
    PlaceholderUpdate,
    TaskExecutionResult,
    TaskPlaceholderInfo,
)
from app.tools.generate_video import (
    DEFAULT_POLL_INTERVAL_SECONDS,
    DEFAULT_POLL_TIMEOUT_SECONDS,
    GenerateVideo,
    GenerateVideoParams,
)
from app.utils.async_file_utils import async_mkdir
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
class VideoPlaceholderUpdate(PlaceholderUpdate):
    """视频元素的占位符更新内容

    Attributes:
        src: 视频文件相对路径
        poster: 封面图相对路径
        generateVideoRequest: 生成时使用的参数记录
        errorMessage: 失败时的错误信息
        width: 实际视频宽度
        height: 实际视频高度
    """

    src: Optional[str] = None
    poster: Optional[str] = None
    generateVideoRequest: Optional[Dict[str, Any]] = None
    errorMessage: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None


class VideoTaskSpec(BaseModel):
    """单个视频生成任务"""

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(
        ...,
        description="""<!--zh: 视频生成提示词。建议包含主体、动作、镜头语言、光线和风格。-->
Video generation prompt. Include subject, action, camera language, lighting, and style for best results."""
    )
    name: str = Field(
        ...,
        description="""<!--zh: 画布元素名称，应反映具体内容，不要用大类或编号替代。-->
Canvas element label. Must reflect the specific content of this video — not a generic category or numbered slot."""
    )
    width: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素宽度。若未显式传 size，且 width/height 与当前模型 featured generation.sizes 中某个尺寸完全匹配，工具会自动推导对应的视频生成分辨率与宽高比；否则它只作为画布尺寸使用。-->
Video element width on canvas. If size is not explicitly provided and width/height exactly matches a featured generation.sizes entry, the tool infers the corresponding video generation resolution and aspect ratio; otherwise it is only used for canvas layout."""
    )
    height: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素高度。与 width 一起可用于从 featured generation.sizes 自动匹配视频生成尺寸。-->
Video element height on canvas. Together with width it can auto-match a video generation size from featured generation.sizes."""
    )
    size: str = Field(
        "",
        description="""<!--zh: 视频生成尺寸，可选。优先使用 featured generation.sizes.value 中声明的值，例如 1920x1080。它只影响底层视频生成，不影响画布元素排版尺寸。-->
Video generation size, optional. Prefer values declared in featured generation.sizes.value, e.g. 1920x1080. It only affects underlying video generation, not canvas layout size."""
    )
    aspect_ratio: str = Field("", description="<!--zh: 视频宽高比，可选-->Video aspect ratio, optional")
    reference_image_paths: List[str] = Field(
        default_factory=list,
        description="<!--zh: 参考图路径或 URL-->Reference image paths or URLs"
    )
    frame_start_path: str = Field("", description="<!--zh: 起始帧路径或 URL-->Start frame path or URL")
    frame_end_path: str = Field("", description="<!--zh: 结束帧路径或 URL-->End frame path or URL")
    duration_seconds: Optional[int] = Field(default=None, description="<!--zh: 视频时长（秒），可选-->Video duration in seconds, optional")
    resolution: str = Field("", description="<!--zh: 视频分辨率，可选-->Video resolution, optional")
    fps: Optional[int] = Field(default=None, description="<!--zh: 视频帧率，可选-->Video FPS, optional")
    seed: Optional[int] = Field(default=None, description="<!--zh: 随机种子，可选-->Random seed, optional")
    watermark: Optional[bool] = Field(default=None, description="<!--zh: 是否保留水印，可选-->Keep watermark, optional")
    extensions: Dict[str, Any] = Field(
        default_factory=dict,
        description="<!--zh: 透传扩展参数-->Pass-through extension config"
    )
    element_id: Optional[str] = Field(
        None,
        description="""<!--zh: 可选。传入时复用画布上已有的元素（如上次生成失败的占位符），工具直接在该元素上重新生成并更新，不新建占位符。不传时新建占位符。-->
Optional. When provided, the tool reuses an existing canvas element (e.g. a failed placeholder from a previous attempt) and regenerates in place without creating a new placeholder. Omit to create a new element."""
    )

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("prompt 不能为空")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name 不能为空")
        return v


class GenerateCanvasVideosParams(BaseToolParams):
    """generate_canvas_videos 工具参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）-->
Relative path to the design project (folder containing magic.project.js)"""
    )
    tasks: List[VideoTaskSpec] = Field(
        ...,
        description="""<!--zh: 视频生成任务列表，每个 task 生成一个视频，最多 4 个。每个 task 独立指定 prompt / name / width / height，其他参数可选。-->
Video generation task list. Each task produces one video. Maximum 4 tasks per call. Each task independently specifies prompt, name, width, and height; other parameters are optional."""
    )
    model_id: str = Field("", description="<!--zh: 可选视频模型 ID，所有任务共用-->Optional video model ID, shared across all tasks")
    override: bool = Field(False, description="<!--zh: 是否覆盖已有文件-->Whether to override existing files")
    poll_interval_seconds: int = Field(DEFAULT_POLL_INTERVAL_SECONDS, description="Polling interval in seconds")
    poll_timeout_seconds: int = Field(DEFAULT_POLL_TIMEOUT_SECONDS, description="Polling timeout in seconds")

    @field_validator("tasks")
    @classmethod
    def validate_tasks(cls, v: List[VideoTaskSpec]) -> List[VideoTaskSpec]:
        if not v or len(v) == 0:
            raise ValueError("tasks 不能为空列表，至少需要一个任务")
        if len(v) > 4:
            raise ValueError("tasks 最多支持 4 个")
        return v


@tool()
class GenerateCanvasVideos(BaseGenerateCanvasElements[GenerateCanvasVideosParams]):
    """<!--zh: 按任务列表生成 AI 视频并自动添加到画布。每个 task 独立指定提示词和画布尺寸，有几个 task 就生成几个视频，并发执行。-->
    Generate AI videos and automatically add them to the canvas, one video per task. Each task independently specifies its prompt and canvas dimensions; all tasks run concurrently.
    """

    # 视频每行最多 4 个（与任务上限一致）
    _max_elements_per_row: int = 4

    def __init__(self, **data):
        super().__init__(**data)
        self._generate_tool = GenerateVideo()
        # 全局参数缓存，在 execute() 中写入，供 _prepare_task_kwargs / _execute_task_item 读取
        self._model_id: str = ""
        self._override: bool = False
        self._poll_interval_seconds: int = DEFAULT_POLL_INTERVAL_SECONDS
        self._poll_timeout_seconds: int = DEFAULT_POLL_TIMEOUT_SECONDS

    async def execute(self, tool_context: ToolContext, params: GenerateCanvasVideosParams) -> ToolResult:
        try:
            logger.info(
                f"开始执行设计生视频: {_format_tool_context_for_log(tool_context)} "
                f"project_path={params.project_path} tasks={len(params.tasks)}"
            )
            # 缓存全局参数（单事件循环语义下安全）
            self._model_id = params.model_id
            self._override = params.override
            self._poll_interval_seconds = params.poll_interval_seconds
            self._poll_timeout_seconds = params.poll_timeout_seconds
            return await self._run_generate_flow(tool_context, params.project_path, params.tasks)
        except Exception as e:
            logger.exception(f"generate_canvas_videos 失败: {e!s}")
            return ToolResult.error(
                f"生成视频到画布失败: {e!s}",
                extra_info={"error_type": "design.error_unexpected"},
            )

    # ------------------------------------------------------------------
    # 实现抽象接口
    # ------------------------------------------------------------------

    def _get_task_placeholder_info(self, task: VideoTaskSpec, idx: int) -> TaskPlaceholderInfo:
        return TaskPlaceholderInfo(
            name=task.name,
            width=float(task.width),
            height=float(task.height),
            element_type="video",
        )

    async def _execute_task_item(
        self,
        idx: int,
        task: VideoTaskSpec,
        placeholder: ElementDetail,
        tool_context: ToolContext,
        project_path: Path,
        resolved_output_path: str = "",
        _relative_project_path: str = "",
        **kwargs: Any,
    ) -> TaskExecutionResult:
        logger.info(
            f"开始生成设计视频子任务: index={idx} name={task.name} "
            f"{_format_tool_context_for_log(tool_context)}"
        )

        generate_result = await self._generate_tool.execute_purely(
            tool_context,
            GenerateVideoParams(
                prompt=task.prompt,
                model_id=self._model_id,
                video_name=task.name,
                output_path=resolved_output_path,
                reference_image_paths=task.reference_image_paths,
                frame_start_path=task.frame_start_path,
                frame_end_path=task.frame_end_path,
                size=task.size,
                width=int(task.width) if task.width is not None else None,
                height=int(task.height) if task.height is not None else None,
                aspect_ratio=task.aspect_ratio,
                duration_seconds=task.duration_seconds,
                resolution=task.resolution,
                fps=task.fps,
                seed=task.seed,
                watermark=task.watermark,
                extensions=task.extensions,
                override=self._override,
                poll_interval_seconds=self._poll_interval_seconds,
                poll_timeout_seconds=self._poll_timeout_seconds,
            ),
        )

        extra_info = generate_result.extra_info or {}
        status = str(extra_info.get("status", "failed"))
        metadata = self._build_generation_metadata(task, extra_info, resolved_output_path)

        logger.info(
            f"设计视频子任务结束: index={idx} name={task.name} "
            f"ok={generate_result.ok} status={status}"
        )

        # 生成成功且已完成
        if generate_result.ok and status == "succeeded":
            actual_width = self._normalize_canvas_dimension(metadata.get("actual_width"))
            actual_height = self._normalize_canvas_dimension(metadata.get("actual_height"))
            # generate_video 返回的路径是工作区相对路径，前端需要项目相对路径
            rel_proj = _relative_project_path or str(project_path.name)
            video_src = self._to_project_relative(extra_info.get("saved_video_relative_path"), rel_proj)
            poster_src = self._to_project_relative(extra_info.get("saved_poster_relative_path"), rel_proj)
            update = VideoPlaceholderUpdate(
                status="completed",
                src=video_src,
                poster=poster_src,
                generateVideoRequest=metadata,
                width=actual_width,
                height=actual_height,
                errorMessage=None,
            )
            return TaskExecutionResult(index=idx, success=True, placeholder_update=update)

        # 生成成功但轮询超时，视频仍在处理中
        if generate_result.ok and extra_info.get("timed_out"):
            pending_status = status or "queued"
            update = VideoPlaceholderUpdate(
                status="processing",
                generateVideoRequest=metadata,
            )
            return TaskExecutionResult(
                index=idx,
                success=True,
                placeholder_update=update,
                metadata={
                    "is_processing": True,
                    "element_id": placeholder.id,
                    "element_name": task.name,
                    "operation_id": str(extra_info.get("operation_id", "")),
                    "request_id": str(metadata.get("request_id", "")),
                    "pending_status": pending_status,
                },
            )

        # 失败
        error_message = self._extract_generate_error_message(generate_result)
        if generate_result.ok:
            error_message = f"视频生成未在预期轮询语义下结束，当前状态={status or 'unknown'}"
        update = VideoPlaceholderUpdate(
            status="failed",
            generateVideoRequest=metadata,
            errorMessage=error_message,
        )
        return TaskExecutionResult(index=idx, success=False, placeholder_update=update)

    # ------------------------------------------------------------------
    # 覆盖钩子
    # ------------------------------------------------------------------

    async def _prepare_task_kwargs(
        self,
        tool_context: ToolContext,
        project_path: Path,
    ) -> Dict[str, Any]:
        workspace_path = Path(tool_context.base_dir).resolve()
        relative_project_path = project_path.relative_to(workspace_path)
        resolved_output_path = str(relative_project_path / "videos")
        await async_mkdir(project_path / "videos", parents=True, exist_ok=True)
        return {
            "resolved_output_path": resolved_output_path,
            "_relative_project_path": str(relative_project_path),
        }

    def _to_project_relative(self, workspace_rel_path: Optional[str], relative_project_path: str) -> Optional[str]:
        """将工作区相对路径转为项目相对路径。

        generate_video 返回的路径是工作区相对的（如 project/videos/a.mp4），
        前端 resolveCanvasFileBlobUrl 以项目目录为根解析，需要去掉项目前缀（如 videos/a.mp4）。
        """
        if not workspace_rel_path:
            return workspace_rel_path
        try:
            return str(Path(workspace_rel_path).relative_to(relative_project_path))
        except ValueError:
            return workspace_rel_path

    def _build_result_content(
        self,
        project_path: Path,
        tasks: List[Any],
        placeholders: List[ElementDetail],
        task_results: List[TaskExecutionResult],
    ) -> str:
        completed_results = [r for r in task_results if r.is_success and not r.metadata.get("is_processing")]
        pending_results = [r for r in task_results if r.metadata.get("is_processing")]
        failed_results = [r for r in task_results if r.is_failed]

        lines = [
            "Generated Videos and Added to Canvas:",
            f"- Completed: {len(completed_results)}",
            f"- Processing: {len(pending_results)}",
            f"- Failed: {len(failed_results)}",
            f"- Project: {project_path}",
        ]

        if completed_results:
            lines.append("")
            lines.append("Completed Elements:")
            for r in completed_results:
                p = placeholders[r.index]
                lines.append(f"- {p.name} (id: {p.id})")

        if pending_results:
            lines.extend([
                "",
                "These video tasks were polled until timeout and are still in progress.",
                "If the user explicitly asks to check progress later, use query_video_generation. "
                "Do not switch to generate_canvas_images unless the user explicitly asks for a static image result.",
                "Pending Operations:",
            ])
            for r in pending_results:
                m = r.metadata
                lines.append(
                    f"- {m['element_name']} (element_id: {m['element_id']}), "
                    f"operation_id: {m['operation_id']}, "
                    f"request_id: {m.get('request_id') or 'N/A'}, "
                    f"status: {m['pending_status']}"
                )

        if failed_results:
            lines.append("")
            lines.append("Failed Elements (pass element_id to retry in place):")
            for r in failed_results:
                p = placeholders[r.index]
                lines.append(f'- {p.name} (element_id: "{p.id}")')

        return "\n".join(lines)

    def _collect_extra_info(
        self,
        tasks: List[Any],
        placeholders: List[ElementDetail],
        task_results: List[TaskExecutionResult],
    ) -> Dict[str, Any]:
        pending_operations = [
            {
                "element_id": r.metadata["element_id"],
                "element_name": r.metadata["element_name"],
                "operation_id": r.metadata["operation_id"],
                "request_id": r.metadata.get("request_id"),
                "status": r.metadata["pending_status"],
            }
            for r in task_results
            if r.metadata.get("is_processing")
        ]
        completed_count = sum(1 for r in task_results if r.is_success and not r.metadata.get("is_processing"))
        processing_count = len(pending_operations)
        failed_count = sum(1 for r in task_results if r.is_failed)
        return {
            "completed_count": completed_count,
            "processing_count": processing_count,
            "failed_count": failed_count,
            "pending_operations": pending_operations,
        }

    # ------------------------------------------------------------------
    # 私有辅助
    # ------------------------------------------------------------------

    def _build_generation_metadata(
        self,
        task: VideoTaskSpec,
        extra_info: Dict[str, Any],
        resolved_output_path: str,
    ) -> Dict[str, Any]:
        metadata = dict(extra_info.get("metadata") or {})
        fallback_metadata = {
            "model_id": self._model_id,
            "prompt": task.prompt,
            "operation_id": extra_info.get("operation_id", ""),
            "request_id": extra_info.get("request_id", ""),
            "size": task.size or None,
            "requested_width": int(task.width) if task.width is not None else None,
            "requested_height": int(task.height) if task.height is not None else None,
            "aspect_ratio": task.aspect_ratio or None,
            "duration_seconds": task.duration_seconds,
            "resolution": task.resolution or None,
            "fps": task.fps,
            "seed": task.seed,
            "watermark": task.watermark,
            "reference_images": list(task.reference_image_paths),
            "frames": [
                item
                for item in (
                    {"role": "start", "uri": task.frame_start_path} if task.frame_start_path else None,
                    {"role": "end", "uri": task.frame_end_path} if task.frame_end_path else None,
                )
                if item is not None
            ],
            "file_dir": resolved_output_path,
        }
        metadata["file_dir"] = resolved_output_path
        for key, value in fallback_metadata.items():
            if key == "file_dir":
                continue
            if self._should_fill_generation_metadata(metadata.get(key), value):
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
    def _extract_generate_error_message(result: ToolResult) -> str:
        extra_info = result.extra_info or {}
        raw_error = extra_info.get("raw_error")
        if isinstance(raw_error, str) and raw_error.strip():
            return raw_error.strip()
        return (result.content or "视频生成失败").strip()

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        extra_info = result.extra_info or {}
        return i18n.translate(
            "generate_canvas_videos.summary",
            category="tool.messages",
            completed=extra_info.get("completed_count", 0),
            processing=extra_info.get("processing_count", 0),
            failed=extra_info.get("failed_count", 0),
        )

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
                default_action_code="generate_canvas_videos",
                default_success_message_code="generate_canvas_videos.exception",
            )
        return {
            "action": i18n.translate("generate_canvas_videos", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
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
