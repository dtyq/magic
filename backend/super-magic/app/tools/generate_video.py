"""通用模式视频生成工具。

画布视频按 ``canvas-manager`` Skill 的正式流程生成；本工具只负责创建普通视频任务。
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import aiofiles
import aiohttp
from pydantic import Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.path_manager import PathManager
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.tool.tool_result import VideoToolResult
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams
from app.tools.media_utils.presigned_url import generate_presigned_url
from app.tools.video_generation_utils import VideoAudioPolicyResolver, normalize_provider_asset_uri
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_mkdir, async_replace, async_unlink

DEFAULT_OUTPUT_PATH = "videos"
MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024


class GenerateVideoParams(BaseToolParams):
    action: Literal["estimate_points", "generate"] = Field(
        "generate",
        description="""<!--zh: 操作类型：estimate_points 仅预估积分，generate 创建视频。-->
Action: estimate_points only estimates points, and generate creates a video task.""",
    )
    prompt: str = Field(
        "",
        description="""<!--zh: 生成时必填的视频提示词，应清晰描述画面、动作、镜头，以及用户要求时的音频要求。-->
Required for generation. Clearly describe the visuals, motion, camera, and audio requirements when requested.""",
    )
    model_id: str = Field(
        "",
        description="""<!--zh: 视频模型 ID；用户未明确指定时省略，使用当前会话模型。-->
Video model ID. Omit unless explicitly requested; the current session model is used.""",
    )
    video_name: str = Field(
        "",
        description="""<!--zh: 输出文件名（不含扩展名），使用用户所用的语言描述视频内容。-->
Output file stem without extension. Describe the video content in the user's language.""",
    )
    output_path: str = Field(
        DEFAULT_OUTPUT_PATH,
        description="""<!--zh: 工作区内的相对保存目录；通常省略并使用默认 videos。-->
Workspace-relative save directory. Usually omit it and use the default videos directory.""",
    )
    input_mode: str = Field(
        "",
        description="""<!--zh: 模型输入模式；用户未明确指定时省略，由工具根据参考素材选择。-->
Model input mode. Omit unless explicitly requested; the tool infers it from reference media.""",
    )
    task: str = Field(
        "generate",
        description="""<!--zh: 视频任务类型；用户未明确指定时保留默认值。-->
Video task type. Keep the default unless explicitly requested.""",
    )
    reference_image_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考图片的工作区路径或 URL；用户提供参考图片时传入。-->
Workspace paths or URLs of reference images. Provide when the user supplies image references.""",
    )
    reference_video_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考视频的工作区路径或 URL；用户提供参考视频时传入。-->
Workspace paths or URLs of reference videos. Provide when the user supplies video references.""",
    )
    reference_audio_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考音频的工作区路径或 URL；用户提供参考音频时传入。-->
Workspace paths or URLs of reference audio. Provide when the user supplies audio references.""",
    )
    frame_start_path: str = Field(
        "",
        description="""<!--zh: 首帧图片的工作区路径或 URL；需要限定视频起始画面时传入。-->
Workspace path or URL of the first frame. Provide when the opening frame must be constrained.""",
    )
    frame_end_path: str = Field(
        "",
        description="""<!--zh: 尾帧图片的工作区路径或 URL；需要限定视频结束画面时传入。-->
Workspace path or URL of the last frame. Provide when the ending frame must be constrained.""",
    )
    size: str = Field(
        "",
        description="""<!--zh: 模型支持的视频尺寸（如 1366x768）；用户未明确指定时省略。-->
Model-supported video dimensions, such as 1366x768. Omit unless explicitly requested.""",
    )
    duration_seconds: Optional[int] = Field(
        None,
        description="""<!--zh: 视频时长（秒）；用户未明确指定时省略，由模型使用默认值。-->
Video duration in seconds. Omit unless explicitly requested; the model default is used.""",
    )
    aspect_ratio: str = Field(
        "",
        description="""<!--zh: 视频宽高比（如 16:9）；用户未明确指定时省略。-->
Video aspect ratio, such as 16:9. Omit unless explicitly requested.""",
    )
    resolution: str = Field(
        "",
        description="""<!--zh: 视频分辨率；用户未明确指定时省略。-->
Video resolution. Omit unless explicitly requested.""",
    )
    fps: Optional[int] = Field(
        None,
        description="""<!--zh: 视频帧率；用户未明确指定时省略。-->
Video frame rate. Omit unless explicitly requested.""",
    )
    seed: Optional[int] = Field(
        None,
        description="""<!--zh: 随机种子；用户未明确指定时省略。-->
Random seed. Omit unless explicitly requested.""",
    )
    watermark: Optional[bool] = Field(
        None,
        description="""<!--zh: 是否添加水印；用户未明确指定时省略。-->
Whether to add a watermark. Omit unless explicitly requested.""",
    )
    audio_policy: Optional[Literal["auto", "generate", "mute"]] = Field(
        None,
        description="""<!--zh: 视频音频策略：auto 使用模型默认行为，generate 请求生成音频，mute 要求最终视频无音频。-->
Audio policy: auto uses the model default, generate requests generated audio, and mute requires a silent final video.""",
    )
    extensions: Dict[str, Any] = Field(
        default_factory=dict,
        description="""<!--zh: 透传给视频接口的扩展配置；仅在明确需要时填写。-->
Extension settings passed through to the video API. Provide only when needed.""",
    )
    override: bool = Field(
        False,
        description="""<!--zh: 是否覆盖同名视频文件；默认不覆盖。-->
Whether to overwrite an existing video with the same name. Defaults to false.""",
    )
    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values
        normalized = dict(values)
        task = str(normalized.get("task") or "").strip().lower()
        if task in {"text_to_video", "image_to_video"}:
            normalized["task"] = "generate"
        mode = str(normalized.get("input_mode") or "").strip().lower()
        if mode in {"text", "text_only", "text_to_video", "text_prompt"}:
            normalized["input_mode"] = "standard"
        elif mode == "image_to_video":
            normalized["input_mode"] = ""
        return normalized

    @field_validator("duration_seconds", "fps", "seed", mode="before")
    @classmethod
    def normalize_optional_int(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and value.strip().lower() in {"", "none", "null"}):
            return None
        if isinstance(value, str):
            try:
                return int(value.strip())
            except ValueError as exc:
                raise ValueError(f"Value must be an integer: {value}") from exc
        return value

    @field_validator("duration_seconds")
    @classmethod
    def validate_duration_seconds(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("Duration must be greater than 0")
        return value

    @field_validator("watermark", mode="before")
    @classmethod
    def normalize_optional_bool(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and value.strip().lower() in {"", "none", "null"}):
            return None
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1"}:
                return True
            if normalized in {"false", "0"}:
                return False
            raise ValueError(f"Value must be true or false: {value}")
        return value

    @model_validator(mode="after")
    def validate_action_fields(self):
        if self.action in {"estimate_points", "generate"} and not self.prompt.strip():
            raise ValueError(f"The {self.action} action requires prompt")
        return self


class GenerateVideo(AbstractFileTool[GenerateVideoParams], WorkspaceTool[GenerateVideoParams]):
    """Create regular video generation tasks in general mode."""

    _is_tool = False

    # Internal service helper; intentionally excluded from tool discovery.
    _is_tool = False

    def __init__(self, **data: Any):
        data.setdefault("base_dir", PathManager.get_workspace_dir())
        super().__init__(**data)
        self._magic_service_client: Optional[MagicServiceClient] = None

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
**调用时机**：仅用于通用模式生成普通视频。

**关键规则**
- 用户未明确指定时，省略 model_id、input_mode、task、size、resolution、fps、seed、watermark，由工具按当前模型选择
- output_path 通常省略，使用默认 videos 目录
- 用户明确忽略附件或引用素材时，不分析素材、不调用素材理解工具，也不传任何参考素材字段，按纯文本请求处理

**Prompt 写法**
- Prompt 是可执行的视频创意简报，至少明确主体、动作、场景、镜头、光线、风格、节奏，以及用户要求时的音频要求
- 需要控制音频时只使用统一参数 audio_policy=auto、generate 或 mute，不要在 prompt 或 extensions 中传 sound、generateAudio、audio 等供应商字段；普通工具仅支持模型原生静音，需合成静音时改用 Canvas Video Edit
- 不要把“未声明音频能力”解释为“不支持音频”；只有能力明确标记为不支持时才向用户报告限制。用户要求旁白、对白、配音、音乐或音效时，应保留原文并尝试 audio_policy=generate；如果用户要求录制真人声音，应区分为录音入口或音频素材能力
- 用户需求模糊时扩写为完整描述；用户已有完整 prompt 时保留原文，只补充必要信息
- 用户要求旁白或对白、配音、音乐或音效时，必须逐字保留，不得概括、改写或遗漏；注明说话人、语言、声音特征、出现时机，以及口型同步和对应动作

**参考素材**
- 用户提供图片、视频、音频或首尾帧时，传入对应字段，并在 prompt 中说明各素材的用途

**确认与风险**
- 用户未明确要求立即生成或跳过确认时，先用 action="estimate_points"；向用户完整逐字复制 Final Prompt（旁白和对白不可概括），再展示主要参数和预计积分，结束当前轮并等待用户确认。确认后再用 action="generate"
- 用户明确要求立即生成或跳过确认时，可直接使用 action="generate"
- 积分预估失败时，不得直接生成；使用 ask_user 提供选项：“在无积分预估的情况下继续”和“修改或取消”，结束当前轮等待用户选择
- 涉及 IP、真人、色情、政治、暴力等风险内容，或需要提供多个方向时，必须先调用 ask_user；至少提供“保留原始要求继续尝试”和“风险降低调整”，不得用普通文本代替 ask_user，也不得强制改写

**失败处理**
- 生成失败不得改用生图或其他工具替代，也不自动重试

**异步任务**
- action="generate" 只创建一次任务；必须保留返回的 operation_id，之后调用 get_video 等待或查询同一任务，不得再次 generate
- get_video 被用户中断后，可继续使用同一个 operation_id 再次调用

**语言规则**
- prompt、video_name 使用用户所用的语言
-->
**When to call**: Use only for regular video generation in general mode.

Video generation and revisions may consume points or money. After a successful video, let the user review it; do not regenerate or revise it because of your own aesthetic judgment. Follow the core user-confirmation rule for any additional video call.

**Key rules**
- Unless explicitly specified, omit model_id, input_mode, task, size, resolution, fps, seed, and watermark; let the tool choose for the current model
- Usually omit output_path and use the default videos directory
- If the user explicitly ignores attachments or reference media, do not analyze them, call media-understanding tools, or pass reference fields; handle the request as text-only

**Prompt writing**
- Treat the prompt as an executable video brief covering at least subject, action, scene, camera, lighting, style, pacing, and audio requirements when requested
- Do not interpret an undeclared audio capability as unsupported. Report an audio limitation only when the model explicitly declares audio output unsupported. For requested narration, dialogue, voice-over, music, or sound effects, preserve the request and try audio_policy=generate; distinguish generated voice from recording the user's real voice
- Expand vague requests into a complete description; when the user provides a complete or detailed prompt, preserve their wording and add only necessary details
- Preserve requested narration, dialogue, voice-over, music, or sound effects verbatim; never summarize, rewrite, or omit them. Specify speaker, language, voice characteristics, timing, lip sync, and matching actions

**Reference media**
- When the user provides images, videos, audio, or first/last frames, pass the corresponding fields and explain each reference's role in the prompt

**Confirmation and risk**
- Unless the user explicitly requests immediate generation or skips confirmation, call action="estimate_points" first. In the user-facing response, copy the complete Final Prompt verbatim—never summarize narration or dialogue—then show the main parameters and estimated points, end the current turn and wait for confirmation. Use action="generate" only after confirmation
- Generate immediately only when the user explicitly requests it or asks to skip confirmation
- If estimation fails, do not generate directly. Use ask_user to offer “continue without an estimate” and “revise or cancel”, then end the current turn and wait for the user's choice
- For IP, real-person, sexual, political, violent, or other multi-choice situations, call ask_user first. Offer at least “keep the original request and attempt it as written” and “apply a risk-reducing adjustment”; do not replace ask_user with plain text or force a rewrite

**Failure handling**
- Do not substitute image generation or another tool, and do not retry automatically

**Asynchronous tasks**
- action="generate" creates the task once. Preserve the returned operation_id and call get_video to wait for or query that task; never call generate again
- If get_video is interrupted by the user, call it again later with the same operation_id

**Language rules**
- Write prompt and video_name in the same language the user is using
"""

    async def execute(self, tool_context: ToolContext, params: GenerateVideoParams) -> VideoToolResult:
        return await self.execute_purely(tool_context, params)

    async def execute_purely(self, tool_context: ToolContext, params: GenerateVideoParams) -> VideoToolResult:
        try:
            operation_id = ""
            request_id = str(uuid.uuid4())
            if params.action == "estimate_points":
                payload = await self._build_payload(tool_context, params)
                estimate = await self._get_magic_service_client().estimate_video_points(
                    payload,
                    request_id=request_id,
                )
                points = self._read_estimated_points(estimate)
                generation = payload.get("generation") or {}
                data = {
                    "points": points,
                    "prompt": params.prompt,
                    "model_id": payload.get("model_id"),
                    "input_mode": payload.get("input_mode"),
                    "generation": generation,
                }
                return VideoToolResult(
                    ok=True,
                    content=(
                        f"Video points estimated: {points} points. "
                        "MANDATORY: In the user-facing response, copy the complete "
                        "Final Prompt verbatim. Do not summarize narration or dialogue. "
                        f"<final_prompt>{params.prompt}</final_prompt> "
                        f"Main parameters: model_id={payload.get('model_id')}, "
                        f"input_mode={payload.get('input_mode')}, generation={generation}. "
                        "End this turn and wait for user confirmation before generation."
                    ),
                    videos=[],
                    data=data,
                )
            payload = await self._build_payload(tool_context, params)
            created = await self._get_magic_service_client().create_video(
                payload,
                request_id=request_id,
            )
            operation_id = str(
                created.get("id") or created.get("operation_id") or ""
            ).strip()
            if not operation_id:
                raise ValueError("Video API response is missing operation_id")
            status = self._status(created) or "unknown"
            data = self._operation_data(created, operation_id, status)
            return VideoToolResult(
                ok=True,
                content=(
                    f"Video task created successfully. Task ID: {operation_id}. "
                    f"Current status: {status}. Continue with get_video using this task ID."
                ),
                videos=[],
                data=data,
                extra_info={"operation_id": operation_id, "status": status},
            )
        except Exception as exc:
            extra = {"error": str(exc)}
            if operation_id:
                extra["operation_id"] = operation_id
            if params.action == "estimate_points":
                estimate_error = {
                    "error_code": "estimate_failed",
                    "points_deducted": False,
                }
                extra.update(estimate_error)
                return VideoToolResult(
                    ok=False,
                    content=(
                        f"Point estimation failed: {exc}; use the ask_user tool to explain "
                        "this specific reason and offer three options: continue without point "
                        "estimation, revise the request, or cancel; do not generate until the "
                        "user chooses."
                    ),
                    videos=[],
                    data=estimate_error,
                    extra_info=extra,
                )
            content, error_code = self._exception_content(exc, params.action)
            extra["error_code"] = error_code
            extra["points_deducted"] = False
            status = "unknown"
            data = {
                "operation": None,
                "operation_id": operation_id or None,
                "status": status,
                "error_code": error_code,
                "points_deducted": False,
            }
            extra["status"] = status
            return VideoToolResult(
                ok=False,
                content=content,
                videos=[],
                data=data,
                extra_info=extra,
            )

    async def _build_payload(
        self, tool_context: Optional[ToolContext], params: GenerateVideoParams
    ) -> Dict[str, Any]:
        model_id, config = self._resolve_model_config(tool_context, params.model_id)
        input_mode = params.input_mode or self._infer_input_mode(params, config)
        self._validate_input_mode(input_mode, params.task, params, config)
        generation = self._build_generation(params, config, model_id)
        payload: Dict[str, Any] = {
            "model_id": model_id,
            "task": params.task,
            "input_mode": input_mode,
            "prompt": params.prompt,
        }
        inputs: Dict[str, Any] = {}
        for key, values in (
            ("reference_images", params.reference_image_paths),
            ("reference_videos", params.reference_video_paths),
            ("reference_audios", params.reference_audio_paths),
        ):
            if values:
                inputs[key] = [{"uri": await self._resolve_input_uri(value)} for value in values]
        frames = []
        if params.frame_start_path:
            frames.append({"role": "start", "uri": await self._resolve_input_uri(params.frame_start_path)})
        if params.frame_end_path:
            frames.append({"role": "end", "uri": await self._resolve_input_uri(params.frame_end_path)})
        if frames:
            inputs["frames"] = frames
        if inputs:
            payload["inputs"] = inputs
        if generation:
            payload["generation"] = generation
        if params.extensions:
            payload["extensions"] = params.extensions
        business_params = self._business_params()
        if business_params:
            payload["business_params"] = business_params
        return payload

    @staticmethod
    def _resolve_model_config(
        tool_context: Optional[ToolContext], requested_model: str
    ) -> tuple[str, Dict[str, Any]]:
        model_context = None
        if tool_context is not None:
            agent_context = tool_context.get_extension("agent_context")
            model_context = getattr(agent_context, "model_context", None) if agent_context else None
        context_model = getattr(model_context, "video_model_id", None) if model_context else None
        video_spec = getattr(model_context, "video", None) if model_context else None
        config = getattr(video_spec, "video_generation_config", None) or {}
        requested = requested_model.strip()
        if requested and context_model and requested.casefold() != str(context_model).casefold():
            raise ValueError(f"The current session video model is {context_model}; use it or omit model_id")
        model_id = context_model or requested
        if not model_id:
            raise ValueError("No video model is available in the current session")
        if not isinstance(config, dict) or not config:
            raise ValueError(f"Video model {model_id} is missing generation capability configuration")
        return str(model_id), config

    @staticmethod
    def _infer_input_mode(
        params: GenerateVideoParams, config: Dict[str, Any]
    ) -> str:
        if params.task == "edit":
            return "video_edit"
        modes = config.get("input_modes") or {}
        if not isinstance(modes, dict):
            raise ValueError("The current video model has no available input modes")
        required = set()
        if params.frame_start_path or params.frame_end_path:
            required.add("frames")
        if params.reference_image_paths:
            required.add("reference_images")
        if params.reference_video_paths:
            required.add("reference_videos")
        if params.reference_audio_paths:
            required.add("reference_audios")
        if not required:
            if "standard" in modes:
                return "standard"
            raise ValueError("The current video model does not support text-to-video generation")
        preferred = []
        if "frames" in required:
            preferred.append("keyframe_guided")
        elif required == {"reference_images"}:
            preferred.append("image_reference")
        elif "reference_videos" in required or "reference_audios" in required:
            preferred.append("omni_reference")
        preferred.extend(name for name in modes if name not in preferred)
        for name in preferred:
            mode = modes.get(name)
            supported = set(mode.get("supported_fields") or []) if isinstance(mode, dict) else set()
            if required.issubset(supported):
                return name
        fields = ", ".join(sorted(required)) or "纯文本"
        raise ValueError(f"The current video model has no input mode supporting: {fields}")

    @staticmethod
    def _validate_input_mode(
        mode: str, task: str, params: GenerateVideoParams, config: Dict[str, Any]
    ) -> None:
        modes = config.get("input_modes") or {}
        mode_config = modes.get(mode) if isinstance(modes, dict) else None
        if not isinstance(mode_config, dict):
            raise ValueError(f"The current video model does not support input mode: {mode}")
        expected_task = mode_config.get("task")
        if expected_task and task != expected_task:
            raise ValueError(f"Input mode {mode} only supports task={expected_task}")
        provided = set()
        if params.reference_image_paths:
            provided.add("reference_images")
        if params.reference_video_paths:
            provided.add("reference_videos")
        if params.reference_audio_paths:
            provided.add("reference_audios")
        if params.frame_start_path or params.frame_end_path:
            provided.add("frames")
        supported = set(mode_config.get("supported_fields") or [])
        unsupported = provided - supported
        if unsupported:
            raise ValueError(f"Input mode {mode} does not support: {', '.join(sorted(unsupported))}")
        GenerateVideo._validate_input_constraints(params, config)

    @staticmethod
    def _validate_input_constraints(
        params: GenerateVideoParams, config: Dict[str, Any]
    ) -> None:
        constraints = config.get("constraints") or {}
        counts = {
            "reference_images": len(params.reference_image_paths),
            "reference_videos": len(params.reference_video_paths),
            "reference_audios": len(params.reference_audio_paths),
        }
        for key, count in counts.items():
            maximum = constraints.get(f"{key}_max_count")
            if isinstance(maximum, int) and count > maximum:
                raise ValueError(f"{key} supports at most {maximum} items")
        if (
            params.reference_audio_paths
            and constraints.get("reference_audios_require_image_or_video") is True
            and not (params.reference_image_paths or params.reference_video_paths)
        ):
            raise ValueError("Reference audio must be used with a reference image or video")
        if (
            constraints.get("frames_and_reference_media_mutually_exclusive") is True
            and (params.frame_start_path or params.frame_end_path)
            and any(counts.values())
        ):
            raise ValueError("Start/end frames cannot be used with reference media")

    @staticmethod
    def _build_generation(
        params: GenerateVideoParams,
        config: Dict[str, Any],
        model_id: str = "",
    ) -> Dict[str, Any]:
        capability = config.get("generation") or {}
        sizes = capability.get("sizes") or []
        if not isinstance(sizes, list) or not sizes:
            raise ValueError("The current video model has no available video sizes")
        selected = None
        if params.size:
            selected = next((item for item in sizes if isinstance(item, dict) and item.get("value") == params.size), None)
            if selected is None:
                legal = [item.get("value") for item in sizes if isinstance(item, dict) and item.get("value")]
                raise ValueError(f"The current video model does not support size {params.size}; valid values: {', '.join(legal)}")
            if params.aspect_ratio and params.aspect_ratio != selected.get("label"):
                raise ValueError(
                    f"Size {params.size} requires aspect ratio {selected.get('label')}; "
                    f"it conflicts with specified value {params.aspect_ratio}"
                )
            if params.resolution and params.resolution != selected.get("resolution"):
                raise ValueError(
                    f"Size {params.size} requires resolution {selected.get('resolution')}; "
                    f"it conflicts with specified value {params.resolution}"
                )
        else:
            candidates = [item for item in sizes if isinstance(item, dict)]
            if params.aspect_ratio:
                candidates = [item for item in candidates if item.get("label") == params.aspect_ratio]
            if params.resolution:
                candidates = [item for item in candidates if item.get("resolution") == params.resolution]
            selected = candidates[0] if candidates else None
            if selected is None:
                raise ValueError("No valid size matches the requested video parameters")
        duration = (
            params.duration_seconds
            if params.duration_seconds is not None
            else capability.get("default_duration_seconds")
        )
        GenerateVideo._validate_choice("时长", duration, capability.get("durations"))
        aspect_ratio = params.aspect_ratio or selected.get("label")
        resolution = params.resolution or selected.get("resolution")
        GenerateVideo._validate_choice("宽高比", aspect_ratio, capability.get("aspect_ratios"))
        GenerateVideo._validate_choice("分辨率", resolution, capability.get("resolutions"))
        if params.watermark is not None and capability.get("supports_watermark") is False:
            raise ValueError("The current video model does not support watermark")
        GenerateVideo._validate_audio_policy(params.audio_policy, capability, model_id)
        return {
            key: value
            for key, value in (
                ("size", selected.get("value")),
                ("duration_seconds", duration),
                ("aspect_ratio", aspect_ratio),
                ("resolution", resolution),
                ("fps", params.fps),
                ("seed", params.seed),
                ("watermark", params.watermark),
                (
                    "generate_audio",
                    VideoAudioPolicyResolver.to_legacy_generate_audio(
                        params.audio_policy,
                        model_id,
                    ),
                ),
            )
            if value is not None and value != ""
        }

    @staticmethod
    def _validate_audio_policy(
        policy: Optional[str], capability: Dict[str, Any], model_id: str = ""
    ) -> None:
        """校验统一音频策略，避免普通视频工具误产出不符合要求的结果。"""
        if policy is None or policy == "auto":
            return
        if policy == "generate" and capability.get("supports_generate_audio") is False:
            raise ValueError("The current video model does not support generated audio")
        if policy != "mute":
            return
        if VideoAudioPolicyResolver.strategy(model_id) == "native":
            return
        raise ValueError("Silent output for this model requires Canvas Video Edit composition")

    @staticmethod
    def _validate_choice(name: str, value: Any, choices: Any) -> None:
        if value is not None and isinstance(choices, list) and choices and value not in choices:
            raise ValueError(f"The current video model does not support {name} {value}; valid values: {', '.join(map(str, choices))}")

    def _get_magic_service_client(self) -> MagicServiceClient:
        if self._magic_service_client is None:
            self._magic_service_client = MagicServiceClient()
        return self._magic_service_client

    async def _resolve_input_uri(self, value: str) -> str:
        normalized_provider_uri = normalize_provider_asset_uri(value)
        if normalized_provider_uri is not None:
            # Provider 素材 URI 不属于工作区文件，必须原样透传给视频服务。
            return normalized_provider_uri
        if value.startswith(("http://", "https://")):
            return value
        path = self.resolve_path(value)
        if not await async_exists(str(path)):
            raise ValueError(f"Reference asset does not exist: {value}")
        return await generate_presigned_url(str(path))

    @staticmethod
    def _business_params() -> Dict[str, str]:
        if not MetadataUtil.is_initialized():
            return {}
        project_id = MetadataUtil.get_metadata().get("project_id")
        return {"project_id": project_id.strip()} if isinstance(project_id, str) and project_id.strip() else {}

    async def _download_video(self, tool_context: ToolContext, url: str, output_path: str, video_name: str, override: bool):
        save_dir = self.resolve_path(output_path or DEFAULT_OUTPUT_PATH)
        await async_mkdir(save_dir, parents=True, exist_ok=True)
        target = save_dir / f"{video_name}.mp4"
        if not override:
            index = 1
            while await async_exists(str(target)):
                target = save_dir / f"{video_name}_{index}.mp4"
                index += 1
        temporary = target.with_name(f".{target.name}.{uuid.uuid4().hex}.part")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=600) as response:
                    if response.status >= 400:
                        raise ValueError(f"Video download failed: HTTP {response.status}")
                    async with aiofiles.open(temporary, "wb") as file:
                        downloaded = 0
                        async for chunk in response.content.iter_chunked(1024 * 1024):
                            downloaded += len(chunk)
                            if downloaded > MAX_DOWNLOAD_BYTES:
                                raise ValueError("Video file is too large")
                            await file.write(chunk)
            async with self._file_versioning_context(
                tool_context, target, track_in_horizon=False
            ):
                await async_replace(temporary, target)
        except Exception:
            if await async_exists(temporary):
                await async_unlink(temporary)
            raise
        return str(target), str(target.relative_to(Path(self.base_dir)))

    @staticmethod
    def _status(operation: Dict[str, Any]) -> str:
        return str(operation.get("status", "")).strip().lower()

    @staticmethod
    def _read_estimated_points(response: Dict[str, Any]) -> int | float:
        points = response.get("points")
        if isinstance(points, bool) or not isinstance(points, (int, float)) or points < 0:
            raise ValueError("Video point estimate is missing valid points")
        return points

    @staticmethod
    def _error_message(operation: Dict[str, Any]) -> str:
        error = operation.get("error") if isinstance(operation, dict) else None
        if isinstance(error, dict):
            return str(error.get("message") or error.get("detail") or "")
        return str(error or operation.get("message") or "") if isinstance(operation, dict) else ""

    @staticmethod
    def _operation_data(
        operation: Dict[str, Any], operation_id: str, status: str
    ) -> Dict[str, Any]:
        return {
            "operation": operation,
            "operation_id": operation_id,
            "status": status,
        }

    @classmethod
    def _operation_failure_result(
        cls, operation: Dict[str, Any], operation_id: str, status: str
    ) -> VideoToolResult:
        error_code = cls._error_code(operation) or status
        reason = cls._error_message(operation)
        restricted = cls._is_content_restricted(error_code, reason)
        if restricted:
            content = (
                "Video generation was restricted by content policy; use ask_user to offer "
                "the original request or a risk-reduced adjustment; Failure does not deduct points."
            )
        elif status == "canceled":
            content = "Video generation was canceled; Failure does not deduct points."
        else:
            detail = f": {reason}" if reason else ""
            content = f"Video generation failed{detail}; Failure does not deduct points."
        data = cls._operation_data(operation, operation_id, status)
        data.update({"error_code": error_code, "points_deducted": False})
        extra = {
            "operation_id": operation_id,
            "status": status,
            "error_code": error_code,
            "points_deducted": False,
        }
        return VideoToolResult(
            ok=False,
            content=content,
            videos=[],
            data=data,
            extra_info=extra,
        )

    @staticmethod
    def _error_code(operation: Dict[str, Any]) -> str:
        error = operation.get("error") if isinstance(operation, dict) else None
        if isinstance(error, dict):
            return str(error.get("code") or "").strip()
        return ""

    @staticmethod
    def _is_content_restricted(error_code: str, message: str) -> bool:
        text = f"{error_code} {message}".casefold()
        return any(word in text for word in ("content", "policy", "blocked", "safety"))

    @staticmethod
    def _exception_content(exc: Exception, action: str) -> tuple[str, str]:
        if isinstance(exc, ApiError):
            error_code, message = GenerateVideo._api_error_details(exc)
            if GenerateVideo._is_content_restricted(error_code, message):
                return (
                    "Video generation was restricted by content policy; use ask_user "
                    "to offer the original request or a risk-reduced adjustment; "
                    "Failure does not deduct points.",
                    error_code or "content_restricted",
                )
            if exc.status_code == 404 and action == "query":
                return (
                    "Video task was not found. Check the task ID before querying again.",
                    "not_found",
                )
            if exc.status_code is not None and exc.status_code >= 500:
                return (
                    "Video service is temporarily unavailable; try again later without automatically retrying.",
                    "service_unavailable",
                )
        if isinstance(exc, ValueError):
            return f"Video request is invalid: {exc}.", "invalid_request"
        return "Video request failed because the service returned an unexpected error.", "service_error"

    @staticmethod
    def _api_error_details(exc: ApiError) -> tuple[str, str]:
        body = exc.response_data if isinstance(exc.response_data, dict) else {}
        error = body.get("error")
        if isinstance(error, dict):
            return (
                str(error.get("code") or body.get("code") or "").strip(),
                str(error.get("message") or error.get("detail") or exc.message),
            )
        return str(body.get("code") or "").strip(), str(
            error or body.get("message") or exc.message
        )

    @staticmethod
    def _failure_content(reason: str) -> str:
        return (
            f"Generation failed: {reason}; Failure does not deduct points; do not call "
            "generate_images or another tool, and do not retry automatically."
        )
