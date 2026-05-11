"""AI 视频生成并添加到画布工具（任务列表版）

每个 task 独立指定 prompt / name / width / height，
有几个 task 就生成几个视频，并发执行。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    normalize_video_input_mode_value,
    normalize_video_task_value,
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

    _PARAM_ALIASES: ClassVar[Dict[str, str]] = {
        "duration": "duration_seconds",
        "image": "reference_image_paths",
        "images": "reference_image_paths",
        "reference_images": "reference_image_paths",
        "video": "reference_video_paths",
        "videos": "reference_video_paths",
        "reference_videos": "reference_video_paths",
        "audio": "reference_audio_paths",
        "audios": "reference_audio_paths",
        "reference_audios": "reference_audio_paths",
        "start_frame": "frame_start_path",
        "end_frame": "frame_end_path",
        "inputMode": "input_mode",
        "mode": "input_mode",
    }

    prompt: str = Field(
        ...,
        description="""<!--zh: 视频生成提示词。素材路径不要写在这里；有参考素材时，在 prompt 中按数组顺序写 [image1] / [video1] / [audio1]。-->
Video generation prompt. Do not put asset paths here. When using reference assets, cite them by list order with [image1] / [video1] / [audio1]."""
    )
    name: str = Field(
        ...,
        description="""<!--zh: 画布元素名称，应反映具体内容，不要用大类或编号替代。-->
Canvas element label. Must reflect the specific content of this video — not a generic category or numbered slot."""
    )
    width: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素宽度，必填。它控制画布展示大小，不等同于生成视频真实尺寸。若用户未提供，请优先使用当前视频模型支持的 size/default_size 对应宽度；若已传 size，则同步为 size 的宽度。-->
Video element width on canvas, required. It controls canvas display size, not the generated video's real pixel size. If the user did not provide it, prefer the width from the current video model's supported size/default_size. If size is provided, mirror size width."""
    )
    height: float = Field(
        ...,
        description="""<!--zh: 画布中视频元素高度，必填。它控制画布展示大小，不等同于生成视频真实尺寸。若用户未提供，请优先使用当前视频模型支持的 size/default_size 对应高度；若已传 size，则同步为 size 的高度。-->
Video element height on canvas, required. It controls canvas display size, not the generated video's real pixel size. If the user did not provide it, prefer the height from the current video model's supported size/default_size. If size is provided, mirror size height."""
    )
    size: str = Field(
        "",
        description="""<!--zh: 视频生成尺寸，可选，字段名必须是 size。例如 1280x720、1920x1080、2160x3840。它控制底层视频生成尺寸，不控制画布展示大小。若已传 size，通常不要再传与它比例冲突的 aspect_ratio。-->
Video generation size, optional. The parameter name must be size, e.g. 1280x720, 1920x1080, 2160x3840. It controls the underlying generated video dimensions, not canvas layout size. If size is provided, usually avoid passing a conflicting aspect_ratio."""
    )
    aspect_ratio: str = Field(
        "",
        description="""<!--zh: 生成视频宽高比，可选，例如 16:9、9:16、1:1。它控制生成比例，不控制画布展示大小。若 size 已经明确表达尺寸，除非用户明确要求，否则可以不传 aspect_ratio。-->
Generated video aspect ratio, optional, e.g. 16:9, 9:16, 1:1. It controls generation ratio, not canvas layout size. If size already defines dimensions, omit aspect_ratio unless the user explicitly asks for it."""
    )
    input_mode: str = Field(
        "",
        description="""<!--zh: 视频输入模式，可选。必须使用媒体模型上下文 <mode name="..."> 的精确值，例如 video_edit。不要使用 inputMode，也不要写 video_editing。-->
Video input mode, optional. Use the exact <mode name="..."> value from media model context, e.g. video_edit. Do not use inputMode or video_editing."""
    )
    task: str = Field(
        "generate",
        description="""<!--zh: 视频任务类型，默认 generate。使用 video_edit 模式时必须传 edit。不要写 generater。-->
Video task type, default generate. Use edit with video_edit mode. Do not use generater."""
    )
    reference_image_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考图路径或 URL 列表。字段名必须是 reference_image_paths。prompt 中按顺序用 [image1]、[image2] 引用。-->
Reference image path or URL list. Must be reference_image_paths. Cite by list order in prompt as [image1], [image2], etc."""
    )
    reference_video_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考视频路径或 URL 列表。字段名必须是 reference_video_paths。prompt 中按顺序用 [video1]、[video2] 引用。-->
Reference video path or URL list. Must be reference_video_paths. Cite by list order in prompt as [video1], [video2], etc."""
    )
    reference_audio_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考音频路径或 URL 列表。字段名必须是 reference_audio_paths。prompt 中按顺序用 [audio1]、[audio2] 引用。-->
Reference audio path or URL list. Must be reference_audio_paths. Cite by list order in prompt as [audio1], [audio2], etc."""
    )
    frame_start_path: str = Field(
        "",
        description="""<!--zh: 起始帧图片路径或 URL。字段名必须是 frame_start_path。不要使用 start_frame。-->
Start frame image path or URL. The parameter name must be frame_start_path. Do not use start_frame."""
    )
    frame_end_path: str = Field(
        "",
        description="""<!--zh: 结束帧图片路径或 URL。字段名必须是 frame_end_path。不要使用 end_frame。-->
End frame image path or URL. The parameter name must be frame_end_path. Do not use end_frame."""
    )
    duration_seconds: Optional[int] = Field(
        default=None,
        description="""<!--zh: 视频时长（秒），可选。字段名必须是 duration_seconds。不要使用 duration。示例：4 秒传 duration_seconds=4。-->
Video duration in seconds, optional. The parameter name must be duration_seconds. Do not use duration. Example: pass duration_seconds=4 for a 4-second video."""
    )
    resolution: str = Field(
        "",
        description="""<!--zh: 视频清晰度档位，可选，字段名必须是 resolution。常见值：720p、1080p、4k。不要把 1280x720 这种尺寸传到 resolution；尺寸请用 size。-->
Video quality/resolution tier, optional. The parameter name must be resolution. Common values: 720p, 1080p, 4k. Do not pass dimensions like 1280x720 here; use size for dimensions."""
    )
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

    @model_validator(mode="before")
    @classmethod
    def normalize_common_parameter_aliases(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        extensions = normalized.get("extensions")
        if isinstance(extensions, dict):
            normalized_extensions = dict(extensions)
            for alias in ("inputMode", "input_mode"):
                if "input_mode" not in normalized and alias in normalized_extensions:
                    normalized["input_mode"] = normalized_extensions.pop(alias)
                    break
            if "task" not in normalized and "task" in normalized_extensions:
                normalized["task"] = normalized_extensions.pop("task")
            normalized["extensions"] = normalized_extensions

        for alias, field_name in cls._PARAM_ALIASES.items():
            if alias not in normalized:
                continue

            alias_value = normalized.pop(alias)
            if field_name in normalized:
                continue

            if field_name.endswith("_paths") and isinstance(alias_value, str):
                normalized[field_name] = [alias_value]
                continue

            normalized[field_name] = alias_value

        return normalized

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

    @field_validator("input_mode", mode="before")
    @classmethod
    def normalize_input_mode(cls, value: Any) -> str:
        return normalize_video_input_mode_value(value)

    @field_validator("task", mode="before")
    @classmethod
    def normalize_task(cls, value: Any) -> str:
        return normalize_video_task_value(value)

    @model_validator(mode="after")
    def validate_reference_tokens(self) -> "VideoTaskSpec":
        missing_tokens = []
        missing_tokens.extend(self._missing_reference_tokens("image", len(self.reference_image_paths)))
        missing_tokens.extend(self._missing_reference_tokens("video", len(self.reference_video_paths)))
        missing_tokens.extend(self._missing_reference_tokens("audio", len(self.reference_audio_paths)))
        if missing_tokens:
            raise ValueError(
                "When using reference assets, the prompt must include reference tokens by list order: "
                f"{', '.join(missing_tokens)}. "
                "Example: White long-haired kitten [image1] peeks out of the black box, "
                "black short-haired kitten [image2] jumps out of the white box."
            )
        return self

    def _missing_reference_tokens(self, token_type: str, reference_count: int) -> List[str]:
        if reference_count <= 0:
            return []

        missing_tokens = []
        for index in range(1, reference_count + 1):
            token = f"[{token_type}{index}]"
            if re.search(re.escape(token), self.prompt, flags=re.IGNORECASE) is None:
                missing_tokens.append(token)
        return missing_tokens


class GenerateCanvasVideosParams(BaseToolParams):
    """generate_canvas_videos 工具参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 设计项目的相对路径（包含 magic.project.js 的文件夹）-->
Relative path to the design project (folder containing magic.project.js)"""
    )
    tasks: List[VideoTaskSpec] = Field(
        ...,
        description="""<!--zh: 视频生成任务列表，每个 task 生成一个视频，最多 4 个。每个 task 必须包含 prompt / name / width / height。width/height 是画布展示尺寸；若用户未指定，请优先使用当前视频模型支持的 size/default_size，或同步已传入的 size。其他字段必须使用本 schema 中的精确字段名。常见正确字段：duration_seconds（不是 duration）、reference_image_paths（不是 images/image）、reference_video_paths（不是 videos/video）、frame_start_path（不是 start_frame）、frame_end_path（不是 end_frame）。使用参考素材时，prompt 必须用 [image1] / [video1] / [audio1] 按数组顺序绑定素材。示例：tasks=[{"prompt":"白色长毛小猫 [image1] 从黑色箱子里探头钻出，黑色短毛小猫 [image2] 从白色箱子里跳出来，橘色虎斑小猫 [image3] 从黄色箱子里爬出。","name":"三色箱子猫咪跳出","width":1280,"height":720,"duration_seconds":4,"resolution":"720p","reference_image_paths":["images/cat1.png","images/cat2.png","images/cat3.png"]}]-->
Video generation task list. Each task produces one video. Maximum 4 tasks per call. Each task must include prompt, name, width, and height. width/height are canvas display dimensions. If the user did not specify them, prefer the current video model's supported size/default_size, or mirror the provided size. Optional fields must use the exact schema names: duration_seconds (not duration), reference_image_paths (not images/image), reference_video_paths (not videos/video), frame_start_path (not start_frame), frame_end_path (not end_frame). When using reference assets, the prompt must bind them by list order with [image1] / [video1] / [audio1]. Example: tasks=[{"prompt":"White long-haired kitten [image1] peeks out of the black box, black short-haired kitten [image2] jumps out of the white box, orange tabby kitten [image3] climbs out of the yellow box.","name":"three_color_box_cats","width":1280,"height":720,"duration_seconds":4,"resolution":"720p","reference_image_paths":["images/cat1.png","images/cat2.png","images/cat3.png"]}]"""
    )
    model_id: str = Field("", description="<!--zh: 可选视频模型 ID，所有任务共用-->Optional video model ID, shared across all tasks")
    override: bool = Field(False, description="<!--zh: 是否覆盖已有文件-->Whether to override existing files")
    poll_interval_seconds: int = Field(DEFAULT_POLL_INTERVAL_SECONDS, description="Polling interval in seconds")
    poll_timeout_seconds: int = Field(DEFAULT_POLL_TIMEOUT_SECONDS, description="Polling timeout in seconds")

    @model_validator(mode="before")
    @classmethod
    def validate_task_canvas_dimensions(cls, value: Any) -> Any:
        if not isinstance(value, dict):
            return value

        tasks = value.get("tasks")
        if not isinstance(tasks, list):
            return value

        missing_fields = []
        for index, task in enumerate(tasks):
            if not isinstance(task, dict):
                continue
            if task.get("width") in (None, ""):
                missing_fields.append(f"tasks.{index}.width")
            if task.get("height") in (None, ""):
                missing_fields.append(f"tasks.{index}.height")

        if missing_fields:
            raise ValueError(
                "generate_canvas_videos requires width and height for every task because they define "
                "the video element's canvas display size. Missing fields: "
                f"{', '.join(missing_fields)}. "
                "Choose width/height from the current video model's supported size/default_size. "
                "If size is provided, mirror it into width/height for canvas layout unless the user asks otherwise."
            )

        return value

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> str | None:
        if error_type == "extra_forbidden" and field_name == "tasks":
            return (
                "generate_canvas_videos 的 tasks 中存在未定义参数。"
                "请只使用 task schema 里的精确字段名：prompt, name, width, height, size, aspect_ratio, input_mode, task, "
                "reference_image_paths, reference_video_paths, reference_audio_paths, frame_start_path, "
                "frame_end_path, duration_seconds, resolution, fps, seed, watermark, extensions, element_id。"
                "常见改名：duration -> duration_seconds；images/image/reference_images -> reference_image_paths；"
                "videos/video/reference_videos -> reference_video_paths；start_frame -> frame_start_path；"
                "end_frame -> frame_end_path。"
                "正确示例：tasks=[{'prompt':'白色长毛小猫 [image1] 从黑色箱子里探头钻出，"
                "黑色短毛小猫 [image2] 从白色箱子里跳出来，橘色虎斑小猫 [image3] 从黄色箱子里爬出。', "
                "'name':'三色箱子猫咪跳出', "
                "'width':1280, 'height':720, 'duration_seconds':4, 'resolution':'720p', "
                "'reference_image_paths':['images/cat1.png','images/cat2.png','images/cat3.png']}]."
            )
        return None

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

        generate_params = GenerateVideoParams(
            prompt=task.prompt,
            model_id=self._model_id,
            input_mode=task.input_mode,
            task=task.task,
            video_name=task.name,
            output_path=resolved_output_path,
            reference_image_paths=task.reference_image_paths,
            reference_video_paths=task.reference_video_paths,
            reference_audio_paths=task.reference_audio_paths,
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
        )
        logger.info(
            f"设计视频子任务下发普通视频工具: index={idx} name={task.name} "
            f"output_path={resolved_output_path} "
            f"reference_image_count={len(generate_params.reference_image_paths)} "
            f"reference_video_count={len(generate_params.reference_video_paths)} "
            f"reference_audio_count={len(generate_params.reference_audio_paths)} "
            f"has_frame_start={bool(generate_params.frame_start_path)} "
            f"has_frame_end={bool(generate_params.frame_end_path)} "
            f"duration_seconds={generate_params.duration_seconds} "
            f"task={generate_params.task or ''} input_mode={generate_params.input_mode or ''} "
            f"resolution={generate_params.resolution or ''} size={generate_params.size or ''} "
            f"aspect_ratio={generate_params.aspect_ratio or ''}"
        )

        generate_result = await self._generate_tool.execute_purely(
            tool_context,
            generate_params,
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

    def _build_created_element_dict(
        self,
        placeholder: ElementDetail,
        task_result: TaskExecutionResult,
    ) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "id": placeholder.id,
            "type": placeholder.type,
            "name": placeholder.name,
            "width": placeholder.width,
            "height": placeholder.height,
        }
        if task_result.is_success:
            update = task_result.placeholder_update
            if isinstance(update, VideoPlaceholderUpdate):
                if update.src:
                    d["src"] = update.src
                if update.poster:
                    d["poster"] = update.poster
        return d

    async def _prepare_task_kwargs(
        self,
        tool_context: ToolContext,
        project_path: Path,
    ) -> Dict[str, Any]:
        workspace_path = Path(self.base_dir)
        relative_project_path = project_path.relative_to(workspace_path)
        resolved_output_path = str(relative_project_path / "videos")
        await async_mkdir(project_path / "videos", parents=True, exist_ok=True)
        return {
            "resolved_output_path": resolved_output_path,
            "_relative_project_path": str(relative_project_path),
        }

    def _to_project_relative(self, workspace_rel_path: Optional[str], relative_project_path: str) -> Optional[str]:
        """将工作区相对路径转为以 ./ 开头的项目相对路径。

        generate_video 返回的路径是工作区相对的（如 project/videos/a.mp4），
        新协议约定：项目相对路径统一以 ./ 开头，与 workspace 相对路径（无 ./ 前缀）区分。
        """
        if not workspace_rel_path:
            return workspace_rel_path
        try:
            return "./" + str(Path(workspace_rel_path).relative_to(relative_project_path))
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
            "task": task.task,
            "input_mode": task.input_mode or None,
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
            "reference_videos": list(task.reference_video_paths),
            "reference_audios": list(task.reference_audio_paths),
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
