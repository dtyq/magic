"""
视频生成工具

该模块对齐 generate_image 的组织方式：
1. 通用视频生成能力统一封装在这里
2. 设计场景只做画布编排，不直接调用 magic-service
3. 默认模型优先从 dynamic_config.video_model 读取，而不是走沙箱 init 顶层字段
"""

from __future__ import annotations

import asyncio
import dataclasses
import json
import mimetypes
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, ClassVar, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import aiofiles
import aiohttp
from pydantic import Field

from agentlang.config.dynamic_config import dynamic_config
from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.path_manager import PathManager
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.file import generate_safe_filename
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.tool.tool_result import VideoToolResult
from app.i18n import i18n
from app.infrastructure.magic_service.config import MagicServiceConfig, MagicServiceConfigLoader
from app.service.media_generation_service import (
    AI_VIDEO_GENERATION_SOURCE,
    generate_presigned_url_for_file,
    notify_generated_media_file,
)
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import async_exists, async_mkdir
from app.utils.video_logger import get_video_logger

logger = get_video_logger(__name__)

DEFAULT_VIDEO_MODEL = "veo-3.1-fast-generate-preview"
DEFAULT_VIDEO_OUTPUT_DIR = "videos"
DEFAULT_POLL_INTERVAL_SECONDS = 10
DEFAULT_POLL_TIMEOUT_SECONDS = 3600
DEFAULT_VIDEO_PROGRESS_ESTIMATE_SECONDS = 600
MAX_VIDEO_DOWNLOAD_BYTES = 500 * 1024 * 1024
VIDEO_PROGRESS_TOOL_NAME = "video_generation_progress"
TERMINAL_VIDEO_STATUSES = {"succeeded", "failed", "canceled"}
LOCAL_INPUT_ERROR_PREFIXES = (
    "本地文件不存在:",
    "无法将本地文件转换为可访问 URL:",
)


def _format_tool_context_for_log(tool_context: Optional[ToolContext]) -> str:
    if tool_context is None:
        return "tool_context=none agent_context=missing"

    agent_context = tool_context.get_extension("agent_context")
    return (
        f"tool_context=present agent_context={'present' if agent_context else 'missing'} "
        f"tool_name={getattr(tool_context, 'tool_name', '') or ''} "
        f"tool_call_id={getattr(tool_context, 'tool_call_id', '') or ''}"
    )


def _build_video_tool_action_and_remark(tool_name: str, result: ToolResult) -> Dict[str, str]:
    action = i18n.translate(tool_name, category="tool.actions")
    if not result.ok:
        return {"action": action, "remark": result.content}

    extra_info = result.extra_info or {}
    if extra_info.get("timed_out"):
        return {"action": action, "remark": f"operation_id={extra_info.get('operation_id')}"}

    return {
        "action": action,
        "remark": extra_info.get("saved_video_relative_path") or result.content,
    }

def _is_dataclass_instance(value: Any) -> bool:
    return dataclasses.is_dataclass(value) and not isinstance(value, type)


def _normalize_video_operation_status(operation: Dict[str, Any]) -> str:
    return str(operation.get("status", "")).strip().lower()


def _summarize_video_request_payload(payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if payload is None:
        return None

    inputs = payload.get("inputs") if isinstance(payload.get("inputs"), dict) else {}
    generation = payload.get("generation") if isinstance(payload.get("generation"), dict) else {}
    reference_images = inputs.get("reference_images")

    return {
        "keys": sorted(payload.keys()),
        "model_id": payload.get("model_id"),
        "prompt_length": len(payload["prompt"]) if isinstance(payload.get("prompt"), str) else None,
        "inputs_keys": sorted(inputs.keys()),
        "reference_image_count": len(reference_images) if isinstance(reference_images, list) else 0,
        "has_frame_start": bool(inputs.get("frame_start")),
        "has_frame_end": bool(inputs.get("frame_end")),
        "generation": generation,
    }


def _summarize_video_response(response_text: str, response_json: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if response_json is None:
        return {
            "body_length": len(response_text),
        }

    output = response_json.get("output") if isinstance(response_json.get("output"), dict) else {}
    error = response_json.get("error")

    return {
        "keys": sorted(response_json.keys()),
        "id": response_json.get("id"),
        "code": response_json.get("code"),
        "status": response_json.get("status"),
        "has_output": bool(output),
        "output_keys": sorted(output.keys()),
        "error_type": type(error).__name__ if error is not None else None,
        "error_count": len(error) if isinstance(error, list) else None,
    }


class GenerateVideoParams(BaseToolParams):
    prompt: str = Field(
        ...,
        description="""<!--zh: 视频生成提示词，需清晰描述主体、动作、镜头语言、光线、风格和时长预期-->
Video generation prompt. Clearly describe the subject, motion, camera language, lighting, style, and duration expectations"""
    )
    model_id: str = Field(
        "",
        description=f"""<!--zh: 视频模型。若为空，则按以下顺序确定：1. dynamic_config.video_model.model_id；2. 默认模型 {DEFAULT_VIDEO_MODEL}。
注意：这里刻意对齐 generate_image 的真实模型链路，不使用沙箱 init 顶层字段。-->
Video model. If empty, use: 1. dynamic_config.video_model.model_id; 2. default model {DEFAULT_VIDEO_MODEL}.
This intentionally follows the same runtime model path as generate_image instead of sandbox init top-level fields."""
    )
    video_name: str = Field(
        "",
        description="""<!--zh: 输出视频文件名（不含扩展名），为空时会根据 prompt 自动生成-->
Output video file name without extension. Auto-generated from prompt if empty"""
    )
    output_path: str = Field(
        DEFAULT_VIDEO_OUTPUT_DIR,
        description="""<!--zh: 输出目录，相对于工作区根目录。默认 videos-->
Output directory relative to workspace root. Default: videos"""
    )
    reference_image_paths: List[str] = Field(
        default_factory=list,
        description="""<!--zh: 参考图片路径或 URL 列表。相对路径会先转可访问 URL，再传给 magic-service-->
Reference image paths or URLs. Relative paths are converted to accessible URLs before calling magic-service"""
    )
    frame_start_path: str = Field(
        "",
        description="""<!--zh: 起始帧图片路径或 URL，可选-->
Start frame image path or URL, optional"""
    )
    frame_end_path: str = Field(
        "",
        description="""<!--zh: 结束帧图片路径或 URL，可选-->
End frame image path or URL, optional"""
    )
    size: str = Field(
        "",
        description="""<!--zh: 生成尺寸，可选。优先使用 featured generation.sizes.value 中声明的值，例如 1920x1080。
如果提供该值，工具会基于当前模型能力自动推导 aspect_ratio / resolution，并校验是否受支持。-->
Generation size, optional. Prefer values declared in featured generation.sizes.value, e.g. 1920x1080.
When provided, the tool infers aspect_ratio / resolution from the current model capability config and validates support."""
    )
    width: Optional[int] = Field(
        default=None,
        description="""<!--zh: 目标生成宽度，可选。若未显式传 size，且 width/height 与 featured generation.sizes 中某个尺寸完全匹配，
工具会自动推导对应的 size / aspect_ratio / resolution。-->
Target generation width, optional. If size is omitted and width/height exactly matches an entry in featured generation.sizes,
the tool infers size / aspect_ratio / resolution automatically."""
    )
    height: Optional[int] = Field(
        default=None,
        description="""<!--zh: 目标生成高度，可选。仅与 width 一起使用，用于从 featured generation.sizes 自动匹配生成尺寸。-->
Target generation height, optional. Use together with width to auto-match a generation size from featured generation.sizes."""
    )
    aspect_ratio: str = Field("", description="<!--zh: 视频宽高比，可选，例如 16:9 / 9:16 / 1:1-->Video aspect ratio, optional")
    duration_seconds: Optional[int] = Field(default=None, description="<!--zh: 视频时长（秒），可选-->Video duration in seconds, optional")
    resolution: str = Field("", description="<!--zh: 视频分辨率，可选，例如 1280x720-->Video resolution, optional")
    fps: Optional[int] = Field(default=None, description="<!--zh: 帧率，可选-->Frames per second, optional")
    seed: Optional[int] = Field(default=None, description="<!--zh: 随机种子，可选-->Random seed, optional")
    watermark: Optional[bool] = Field(default=None, description="<!--zh: 是否保留水印，可选-->Whether to keep watermark, optional")
    extensions: Dict[str, Any] = Field(
        default_factory=dict,
        description="""<!--zh: 透传给 /v1/videos 的扩展配置对象，可选-->
Extension config object passed through to /v1/videos, optional"""
    )
    override: bool = Field(False, description="<!--zh: 是否覆盖已有文件-->Whether to override existing files")
    poll_interval_seconds: int = Field(
        DEFAULT_POLL_INTERVAL_SECONDS,
        description="<!--zh: 轮询间隔（秒），用于查询视频生成任务状态-->Polling interval in seconds for checking video generation job status",
    )
    poll_timeout_seconds: int = Field(
        DEFAULT_POLL_TIMEOUT_SECONDS,
        description="<!--zh: 轮询超时时间（秒）。超过后停止等待并返回超时结果-->Polling timeout in seconds. Stops waiting and returns a timeout result when exceeded",
    )


class QueryVideoGenerationParams(BaseToolParams):
    operation_id: str = Field(..., description="<!--zh: 视频生成任务 ID-->Video generation operation ID")
    request_id: str = Field("", description="<!--zh: 可选 request-id。若已知，传入后可与初次生成请求串联排查日志-->Optional request-id for log correlation")
    video_name: str = Field("", description="<!--zh: 下载时使用的视频文件名（不含扩展名）-->Video file name for download")
    output_path: str = Field(DEFAULT_VIDEO_OUTPUT_DIR, description="<!--zh: 下载目录，相对于工作区-->Download directory relative to workspace")
    project_path: str = Field(
        "",
        description="""<!--zh: 可选设计项目路径。传入后，工具会在任务状态变化时尝试回填对应 video 元素-->
Optional design project path. When provided, the tool tries to backfill the corresponding video element on status changes"""
    )
    element_id: str = Field(
        "",
        description="""<!--zh: 可选画布元素 ID。需与 project_path 一起传入，用于把查询结果回填到指定 video 元素-->
Optional canvas element ID. Use together with project_path to write query results back to the target video element"""
    )
    override: bool = Field(False, description="<!--zh: 是否覆盖已有文件-->Whether to override existing files")
    poll_interval_seconds: int = Field(
        DEFAULT_POLL_INTERVAL_SECONDS,
        description="<!--zh: 轮询间隔（秒），用于查询视频生成任务状态-->Polling interval in seconds for checking video generation job status",
    )
    poll_timeout_seconds: int = Field(
        DEFAULT_POLL_TIMEOUT_SECONDS,
        description="<!--zh: 轮询超时时间（秒）。超过后停止等待并返回超时结果-->Polling timeout in seconds. Stops waiting and returns a timeout result when exceeded",
    )


@tool(name="generate_video")
class GenerateVideo(AbstractFileTool[GenerateVideoParams], WorkspaceTool[GenerateVideoParams]):
    """<!--zh
    生成 AI 视频并保存到工作区

    用于根据文本提示词、参考图或首尾帧生成视频，自动处理任务创建、轮询查询、文件下载和结果元数据保存。

    支持三种常见模式：
    1. 纯文本生视频：仅提供 prompt，生成完整视频内容
    2. 参考图引导生成：提供 reference_image_paths，约束主体风格、构图或视觉元素
    3. 首尾帧控制生成：提供 frame_start_path / frame_end_path，生成带有明确镜头过渡的视频

    关键用法：
    - 文生视频：prompt="黄昏海边，镜头缓慢推进，电影感光影"
    - 图引导视频：prompt="让角色缓慢转身并微笑" + reference_image_paths=["/path/to/ref.png"]
    - 首尾帧过渡：frame_start_path="/path/to/start.png" + frame_end_path="/path/to/end.png"
    - 指定尺寸：优先使用 size="1920x1080"，或提供 width + height 让工具自动匹配

    重要提示：
    - 应在 prompt 中明确描述主体、动作、镜头语言、光线、风格和时长预期
    - 如果用户明确要求宽高比、分辨率、时长或帧率，建议显式传入对应参数
    - size 会优先按当前模型 featured generation.sizes 配置校验；若只传 width/height，工具会尝试自动推导匹配尺寸
    - 默认输出到工作区下的 videos 目录，可通过 output_path 和 video_name 控制保存位置与文件名
    -->
    Generate AI videos and save them to the workspace

    Used to generate videos from text prompts, reference images, or start/end frames, automatically handling job creation, polling, file download, and result metadata persistence.

    Supports three common modes:
    1. Text-to-video: Provide prompt only to generate a full video
    2. Reference-guided generation: Provide reference_image_paths to constrain style, composition, or visual elements
    3. Start/end frame controlled generation: Provide frame_start_path / frame_end_path to create videos with explicit transition control

    Key usage:
    - Text-to-video: prompt="Sunset by the sea, slow push-in camera movement, cinematic lighting"
    - Reference-guided video: prompt="Make the character slowly turn around and smile" + reference_image_paths=["/path/to/ref.png"]
    - Start/end frame transition: frame_start_path="/path/to/start.png" + frame_end_path="/path/to/end.png"
    - Specify size: Prefer size="1920x1080", or provide width + height for automatic matching

    Important tips:
    - The prompt should clearly describe the subject, motion, camera language, lighting, style, and expected duration
    - If the user explicitly requires aspect ratio, resolution, duration, or fps, pass those parameters explicitly
    - size is validated against the current model's featured generation.sizes config first; if only width/height are provided, the tool tries to infer a matching size automatically
    - Output is saved to the workspace `videos` directory by default; use output_path and video_name to control the location and file name
    """

    _DIMENSION_TO_RESOLUTION: ClassVar[Dict[Tuple[int, int], str]] = {
        (480, 854): "480p",
        (720, 1280): "720p",
        (1080, 1920): "1080p",
        (1440, 2560): "2k",
        (2160, 3840): "4k",
    }

    def __init__(self, **data):
        if "base_dir" not in data:
            data["base_dir"] = PathManager.get_workspace_dir()
        super().__init__(**data)
        self._magic_service_config: Optional[MagicServiceConfig] = None

    async def execute(self, tool_context: ToolContext, params: GenerateVideoParams) -> VideoToolResult:
        return await self.execute_purely(tool_context, params)

    async def execute_purely(self, tool_context: ToolContext, params: GenerateVideoParams) -> VideoToolResult:
        try:
            logger.info(
                "开始执行普通视频生成: "
                f"{_format_tool_context_for_log(tool_context)} "
                f"output_path={params.output_path} video_name={params.video_name or ''}"
            )
            model_id = self._resolve_model(params.model_id)
            video_generation_config = self._resolve_video_generation_config(model_id)
            if video_generation_config is None:
                logger.info(f"视频模型 {model_id} 缺少 featured 能力配置，继续按现有兜底逻辑执行")

            request_id = str(uuid.uuid4())
            request_payload, applied_generation, matched_size = await self._build_create_payload(
                params,
                model_id,
                video_generation_config,
            )
            create_response = await self._request_json(
                method="POST",
                path="/videos",
                payload=request_payload,
                request_id=request_id,
            )
            operation_id = str(create_response.get("id", "")).strip()
            if not operation_id:
                raise ValueError("magic-service /v1/videos 响应缺少 operation id")
            logger.info(
                "视频任务创建成功: "
                f"operation_id={operation_id} request_id={request_id} model_id={model_id} "
                f"{_format_tool_context_for_log(tool_context)}"
            )

            file_stem = params.video_name or generate_safe_filename(params.prompt) or operation_id
            operation = await self._wait_for_operation(
                operation_id=operation_id,
                poll_interval_seconds=params.poll_interval_seconds,
                poll_timeout_seconds=params.poll_timeout_seconds,
                initial_response=create_response,
                request_id=request_id,
                tool_context=tool_context,
                progress_payload={
                    "tool_name": getattr(tool_context, "tool_name", self.name),
                    "file_name": file_stem,
                    "project_path": "",
                    "element_id": "",
                },
            )

            metadata = self._build_result_metadata(
                params,
                model_id,
                operation_id,
                request_id,
                applied_generation,
                matched_size,
            )
            logger.info(
                "普通视频生成轮询结束: "
                f"operation_id={operation_id} request_id={request_id} "
                f"status={self._normalize_status(operation) or ''}"
            )
            return await self._build_operation_result(
                tool_context=tool_context,
                operation=operation,
                output_path=params.output_path,
                video_name=file_stem,
                override=params.override,
                metadata=metadata,
                success_message_code="generate_video.success",
                pending_message_code="generate_video.pending",
            )
        except Exception as e:
            logger.exception(f"视频生成失败: {e!s}")
            raw_error = str(e)
            local_input_error_type = self._classify_local_input_error(raw_error)
            if local_input_error_type:
                return VideoToolResult(
                    ok=False,
                    content=raw_error,
                    videos=[],
                    extra_info={
                        "error": raw_error,
                        "raw_error": raw_error,
                        "error_type": local_input_error_type,
                    },
                )
            return VideoToolResult(
                ok=False,
                content=i18n.translate("generate_video.error", category="tool.messages", error=raw_error),
                videos=[],
                extra_info={"error": raw_error},
            )

    @staticmethod
    def _classify_local_input_error(error_message: str) -> str:
        normalized_error = error_message.strip()
        if normalized_error.startswith("本地文件不存在:"):
            return "video.local_input_not_found"
        if normalized_error.startswith("无法将本地文件转换为可访问 URL:"):
            return "video.local_input_url_conversion_failed"
        if any(normalized_error.startswith(prefix) for prefix in LOCAL_INPUT_ERROR_PREFIXES):
            return "video.local_input_error"
        return ""

    @staticmethod
    def _resolve_model(requested_model: str) -> str:
        """解析实际使用的视频模型。

        视频模型故意与图片模型保持同一运行时语义：
        - 优先用户显式传入
        - 其次读取 dynamic_config.video_model.model_id
        - 最后使用默认值
        这样 super-magic-module 只需把 video_model_id 桥接到 dynamic_config，
        无需额外扩展沙箱 init 协议。
        """
        if requested_model and requested_model.strip():
            return requested_model.strip()

        try:
            config_data = dynamic_config.read_dynamic_config()
            if config_data:
                video_model = config_data.get("video_model", {})
                if isinstance(video_model, dict):
                    model_id = video_model.get("model_id")
                    if isinstance(model_id, str) and model_id.strip():
                        model = model_id.strip()
                        logger.info(f"从 dynamic_config.video_model.model_id 获取视频模型: {model}")
                        return model
        except Exception as e:
            logger.debug(f"读取 dynamic_config.video_model 失败，使用默认模型: {e}")

        logger.info(f"未指定视频模型，使用默认模型: {DEFAULT_VIDEO_MODEL}")
        return DEFAULT_VIDEO_MODEL

    @staticmethod
    def _resolve_video_generation_config(model_id: str) -> Optional[Dict[str, Any]]:
        try:
            config_data = dynamic_config.read_dynamic_config()
            if not isinstance(config_data, dict):
                return None

            video_model = config_data.get("video_model")
            if not isinstance(video_model, dict):
                return None

            config_model_id = video_model.get("model_id")
            if isinstance(config_model_id, str) and config_model_id.strip() and config_model_id.strip() != model_id:
                logger.warning(
                    f"dynamic_config.video_model.model_id={config_model_id.strip()} 与当前视频模型 {model_id} 不一致，忽略其 featured 配置"
                )
                return None

            video_generation_config = video_model.get("video_generation_config")
            if isinstance(video_generation_config, dict) and video_generation_config:
                return video_generation_config
        except Exception as e:
            logger.debug(f"读取 dynamic_config.video_model.video_generation_config 失败: {e}")

        return None

    async def _build_create_payload(
        self,
        params: GenerateVideoParams,
        model_id: str,
        video_generation_config: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[Dict[str, Any]]]:
        inputs: Dict[str, Any] = {}
        self._validate_input_support(params, video_generation_config)

        if params.reference_image_paths:
            inputs["reference_images"] = [
                {"uri": await self._resolve_input_uri(path)}
                for path in params.reference_image_paths
            ]

        frames = []
        if params.frame_start_path:
            frames.append({"role": "start", "uri": await self._resolve_input_uri(params.frame_start_path)})
        if params.frame_end_path:
            frames.append({"role": "end", "uri": await self._resolve_input_uri(params.frame_end_path)})
        if frames:
            inputs["frames"] = frames

        generation, matched_size = self._build_generation_payload(params, video_generation_config)

        payload: Dict[str, Any] = {
            "model_id": model_id,
            "task": "generate",
            "prompt": params.prompt,
        }
        if inputs:
            payload["inputs"] = inputs
        if generation:
            payload["generation"] = generation
        if params.extensions:
            payload["extensions"] = params.extensions
        business_params = self._build_business_params_from_metadata()
        if business_params:
            payload["business_params"] = business_params

        return payload, generation, matched_size

    @staticmethod
    def _normalize_video_api_base_url(api_base_url: str) -> str:
        """归一化视频接口基地址。

        视频工具访问 magic-service 时统一走 MagicServiceConfigLoader 的配置链路：
        优先读取 init_client_message 里的 `magic_service_host`，其次回退到
        `MAGIC_API_SERVICE_BASE_URL`。不同环境对该 host 的约定并不完全一致：
        有的环境直接配置到 `https://host/magic-service`，有的环境已经带上
        `https://host/magic-service/v1`，也有环境会配置成
        `https://host/magic-service/v2`。

        视频接口固定挂在 `/v1/videos` 下，因此这里统一把 base URL 归一化到
        `.../v1`：如果 path 末尾已经带有 `/v` 加数字的版本段，就先去掉再追加 `/v1`。
        这样可以避免出现 `/v1/v1/videos`、`/v2/videos`、`/v2/v1/videos`
        这类环境相关的错误路径。这里只处理视频接口，不改 generate_image
        现有图片链路的 URL 约定。
        """
        normalized_url = api_base_url.strip().rstrip("/")
        parsed_url = urlparse(normalized_url)
        normalized_path = parsed_url.path.rstrip("/")
        normalized_path = re.sub(r"/v\d+$", "", normalized_path)
        normalized_path = f"{normalized_path}/v1" if normalized_path else "/v1"

        return parsed_url._replace(path=normalized_path).geturl().rstrip("/")

    def _get_magic_service_config(self) -> MagicServiceConfig:
        if self._magic_service_config is None:
            self._magic_service_config = MagicServiceConfigLoader.load_with_fallback()
        return self._magic_service_config

    async def _request_json(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        request_id: str = "",
    ) -> Dict[str, Any]:
        magic_service_config = self._get_magic_service_config()
        api_base_url = magic_service_config.api_base_url
        if not api_base_url:
            raise ValueError("magic-service API 地址未配置")

        normalized_base_url = self._normalize_video_api_base_url(api_base_url)
        url = f"{normalized_base_url}{path}"
        headers = self._build_api_headers(request_id)
        logger.info(
            f"视频接口请求: method={method} url={url} request_id={request_id} "
            f"payload_summary={json.dumps(_summarize_video_request_payload(payload), ensure_ascii=False)}"
        )

        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=payload, headers=headers, timeout=600) as response:
                response_text = await response.text()
                response_json = None
                decode_error: Optional[json.JSONDecodeError] = None
                if response_text:
                    try:
                        response_json = json.loads(response_text)
                    except json.JSONDecodeError as e:
                        decode_error = e
                        response_json = None
                logger.info(
                    f"视频接口响应: method={method} url={url} request_id={request_id} "
                    f"status={response.status} summary={json.dumps(_summarize_video_response(response_text, response_json), ensure_ascii=False)}"
                )
                if response.status != 200:
                    error_message = self._extract_magic_service_error_message(response_json)
                    if error_message:
                        raise ValueError(error_message)
                    raise ValueError(f"视频接口调用失败，状态码: {response.status}，响应: {response_text}")
                if response_json is None:
                    raise ValueError(f"视频接口响应不是合法 JSON: {decode_error}") from decode_error
                error_message = self._extract_magic_service_error_message(response_json)
                if error_message:
                    raise ValueError(error_message)

                return response_json

    async def _wait_for_operation(
        self,
        operation_id: str,
        poll_interval_seconds: int,
        poll_timeout_seconds: int,
        initial_response: Optional[Dict[str, Any]] = None,
        request_id: str = "",
        tool_context: Optional[ToolContext] = None,
        progress_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        progress_started_at = int(time.time())
        last_progress = 0
        operation = initial_response or await self._request_json("GET", f"/videos/{operation_id}", request_id=request_id)
        status = self._normalize_status(operation)
        if tool_context and progress_payload and status == "succeeded":
            await self._dispatch_task_progress_event(
                tool_context=tool_context,
                operation_id=operation_id,
                operation=operation,
                request_id=request_id,
                progress_started_at=progress_started_at,
                elapsed_seconds=0,
                last_progress=last_progress,
                progress_payload=progress_payload,
            )
        if status in TERMINAL_VIDEO_STATUSES:
            return operation

        if tool_context and progress_payload:
            last_progress = await self._dispatch_task_progress_event(
                tool_context=tool_context,
                operation_id=operation_id,
                operation=operation,
                request_id=request_id,
                progress_started_at=progress_started_at,
                elapsed_seconds=0,
                last_progress=last_progress,
                progress_payload=progress_payload,
            )

        elapsed = 0
        while elapsed < poll_timeout_seconds:
            await asyncio.sleep(poll_interval_seconds)
            elapsed += poll_interval_seconds
            operation = await self._request_json("GET", f"/videos/{operation_id}", request_id=request_id)
            status = self._normalize_status(operation)
            if tool_context and progress_payload and status == "succeeded":
                await self._dispatch_task_progress_event(
                    tool_context=tool_context,
                    operation_id=operation_id,
                    operation=operation,
                    request_id=request_id,
                    progress_started_at=progress_started_at,
                    elapsed_seconds=elapsed,
                    last_progress=last_progress,
                    progress_payload=progress_payload,
                )
            if status in TERMINAL_VIDEO_STATUSES:
                return operation

            if tool_context and progress_payload:
                last_progress = await self._dispatch_task_progress_event(
                    tool_context=tool_context,
                    operation_id=operation_id,
                    operation=operation,
                    request_id=request_id,
                    progress_started_at=progress_started_at,
                    elapsed_seconds=elapsed,
                    last_progress=last_progress,
                    progress_payload=progress_payload,
                )

        operation["timed_out"] = True
        return operation

    async def _dispatch_task_progress_event(
        self,
        tool_context: ToolContext,
        operation_id: str,
        operation: Dict[str, Any],
        request_id: str,
        progress_started_at: int,
        elapsed_seconds: int,
        last_progress: int,
        progress_payload: Dict[str, Any],
    ) -> int:
        agent_context = tool_context.get_extension("agent_context")
        if not agent_context:
            logger.warning(
                "跳过视频进度事件发送: agent_context 缺失 "
                f"operation_id={operation_id} request_id={request_id or ''} "
                f"tool_name={getattr(tool_context, 'tool_name', '') or ''} "
                f"tool_call_id={getattr(tool_context, 'tool_call_id', '') or ''}"
            )
            return last_progress

        status = self._normalize_status(operation) or "queued"
        status_reason = self._extract_progress_status_reason(operation, status)
        progress = self._compute_task_progress(status, elapsed_seconds, last_progress)
        message_key = self._resolve_task_progress_message_key(status)
        correlation_id = self._resolve_progress_correlation_id(tool_context)
        tool_name = VIDEO_PROGRESS_TOOL_NAME
        task_label = i18n.translate(tool_name, category="tool.actions")
        queue = operation.get("queue")
        message = i18n.translate(
            message_key,
            category="tool.messages",
            task_label=task_label,
            percentage=progress,
            status=status,
            status_reason=f"：{status_reason}" if status_reason else "",
        )

        detail_data = {
            "task_type": "video_generation",
            "task_id": operation_id,
            "progress": progress,
            "message": message,
            "provider_status": status,
            "request_id": request_id or None,
            "file_name": progress_payload.get("file_name") or "",
            "queue": queue,
            "started_at": progress_started_at,
            "elapsed_seconds": elapsed_seconds,
            "status_reason": status_reason,
            "operation_id": operation_id,
            "video_status": status,
            "canvas_context": {
                "project_path": progress_payload.get("project_path") or "",
                "element_id": progress_payload.get("element_id") or "",
            },
        }
        progress_arguments = {
            "name": tool_name,
            "correlation_id": correlation_id,
            "action": task_label,
            "detail": {
                "type": "text",
                "data": detail_data,
            },
            "status": "processing",
        }
        event_data = PendingToolCallEventData(
            tool_context=tool_context,
            tool_name=tool_name,
            arguments=progress_arguments,
            tool_instance=self,
            correlation_id=correlation_id,
        )
        logger.info(
            f"准备发送任务进度事件: tool_name={tool_name} operation_id={operation_id} status={status} "
            f"progress={progress} request_id={request_id or ''} correlation_id={correlation_id}"
        )
        agent_context.update_activity_time()
        await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)
        logger.info(
            f"已发送任务进度事件: tool_name={tool_name} operation_id={operation_id} status={status} "
            f"progress={progress} correlation_id={correlation_id}"
        )
        return progress

    @staticmethod
    def _resolve_progress_correlation_id(tool_context: ToolContext) -> str:
        correlation_manager = get_correlation_manager()
        correlation_id = correlation_manager.get_active_correlation_id(EventPairType.TOOL_CALL)
        if correlation_id:
            return correlation_id
        return tool_context.tool_call_id or str(uuid.uuid4())

    @staticmethod
    def _compute_task_progress(status: str, elapsed_seconds: int, last_progress: int) -> int:
        if status == "succeeded":
            return 100
        if status in {"failed", "canceled"}:
            return 0

        estimated_progress = int((elapsed_seconds / DEFAULT_VIDEO_PROGRESS_ESTIMATE_SECONDS) * 80)
        if elapsed_seconds <= 0:
            progress = 1
        elif last_progress < 80:
            progress = max(last_progress, max(1, min(estimated_progress, 80)))
        else:
            progress = min(max(last_progress + 1, 81), 99)

        if progress <= last_progress:
            progress = min(max(last_progress + 1, 1), 99)

        return progress

    def _extract_progress_status_reason(self, operation: Dict[str, Any], status: str) -> Optional[str]:
        queue = operation.get("queue")
        if isinstance(queue, dict):
            for key in ("message", "reason", "status_reason"):
                value = queue.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

        status_reason = operation.get("status_reason")
        if isinstance(status_reason, str) and status_reason.strip():
            return status_reason.strip()

        if status in {"failed", "canceled"}:
            error = operation.get("error")
            if isinstance(error, dict):
                return self._extract_error_message(error, status)

        return None

    @staticmethod
    def _resolve_task_progress_message_key(status: str) -> str:
        if status == "queued":
            return "task_progress.queued_message"
        if status == "succeeded":
            return "task_progress.completed_message"
        if status == "failed":
            return "task_progress.failed_message"
        if status == "canceled":
            return "task_progress.canceled_message"
        return "task_progress.processing_message"

    @staticmethod
    def _normalize_status(operation: Dict[str, Any]) -> str:
        return _normalize_video_operation_status(operation)

    async def wait_for_operation(
        self,
        operation_id: str,
        poll_interval_seconds: int,
        poll_timeout_seconds: int,
        initial_response: Optional[Dict[str, Any]] = None,
        request_id: str = "",
        tool_context: Optional[ToolContext] = None,
        progress_payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self._wait_for_operation(
            operation_id=operation_id,
            poll_interval_seconds=poll_interval_seconds,
            poll_timeout_seconds=poll_timeout_seconds,
            initial_response=initial_response,
            request_id=request_id,
            tool_context=tool_context,
            progress_payload=progress_payload,
        )

    async def _build_operation_result(
        self,
        tool_context: ToolContext,
        operation: Dict[str, Any],
        output_path: str,
        video_name: str,
        override: bool,
        metadata: Dict[str, Any],
        success_message_code: str,
        pending_message_code: str,
    ) -> VideoToolResult:
        operation_id = str(operation.get("id", "")).strip()
        status = self._normalize_status(operation)
        queue = operation.get("queue") or {}
        output = operation.get("output") or {}
        error = operation.get("error") or {}

        if status == "succeeded":
            saved_poster_path: Optional[str] = None
            saved_poster_relative_path: Optional[str] = None
            video_url = output.get("video_url")
            poster_url = output.get("poster_url")
            result_metadata = dict(metadata)

            if not isinstance(video_url, str) or not video_url.strip():
                raise ValueError("视频任务已成功，但响应中缺少 output.video_url")

            saved_video_path, saved_video_relative_path = await self._download_media_file(
                tool_context=tool_context,
                url=video_url.strip(),
                output_path=output_path,
                file_stem=video_name or operation_id,
                default_extension=".mp4",
                override=override,
            )
            actual_width: Optional[int] = None
            actual_height: Optional[int] = None
            try:
                actual_width, actual_height = await self._probe_video_dimensions(saved_video_path)
            except Exception as e:
                logger.warning(
                    f"读取视频真实尺寸失败，降级为保留占位尺寸继续返回成功结果: "
                    f"operation_id={operation_id}, video_path={saved_video_path}, error={e!s}"
                )
            result_metadata.setdefault("actual_width", None)
            result_metadata.setdefault("actual_height", None)
            if actual_width is not None:
                result_metadata["actual_width"] = actual_width
            if actual_height is not None:
                result_metadata["actual_height"] = actual_height

            if isinstance(poster_url, str) and poster_url.strip():
                try:
                    saved_poster_path, saved_poster_relative_path = await self._download_media_file(
                        tool_context=tool_context,
                        url=poster_url.strip(),
                        output_path=output_path,
                        file_stem=f"{video_name or operation_id}_poster",
                        default_extension=".jpg",
                        override=override,
                    )
                except Exception as e:
                    logger.warning(f"下载视频封面失败，降级为无封面继续返回成功结果: operation_id={operation_id}, error={e!s}")

            friendly_path = saved_video_relative_path or Path(saved_video_path).name
            content = i18n.translate(success_message_code, category="tool.messages", file_name=friendly_path)
            return VideoToolResult(
                ok=True,
                content=content,
                videos=[saved_video_path] if saved_video_path else [],
                video_url=saved_video_path,
                extra_info={
                    "operation_id": operation_id,
                    "request_id": metadata.get("request_id"),
                    "status": status,
                    "queue": queue,
                    "saved_video_path": saved_video_path,
                    "saved_video_relative_path": saved_video_relative_path,
                    "saved_poster_path": saved_poster_path,
                    "saved_poster_relative_path": saved_poster_relative_path,
                    "video_url": video_url,
                    "poster_url": poster_url,
                    "poster_download_error": None if saved_poster_path or not poster_url else "poster download failed",
                    "output": output,
                    "metadata": result_metadata,
                },
            )

        if status in {"failed", "canceled"}:
            error_message = self._extract_error_message(error, status)
            content = i18n.translate("generate_video.error", category="tool.messages", error=error_message)
            return VideoToolResult(
                ok=False,
                content=content,
                videos=[],
                extra_info={
                    "operation_id": operation_id,
                    "request_id": metadata.get("request_id"),
                    "status": status,
                    "queue": queue,
                    "error": error,
                    "metadata": metadata,
                },
            )

        content = i18n.translate(pending_message_code, category="tool.messages", operation_id=operation_id, status=status or "queued")
        return VideoToolResult(
            ok=True,
            content=content,
            videos=[],
            extra_info={
                "operation_id": operation_id,
                "request_id": metadata.get("request_id"),
                "status": status or "queued",
                "queue": queue,
                "output": output,
                "timed_out": True,
                "metadata": metadata,
            },
        )

    async def build_operation_result(
        self,
        tool_context: ToolContext,
        operation: Dict[str, Any],
        output_path: str,
        video_name: str,
        override: bool,
        metadata: Dict[str, Any],
        success_message_code: str,
        pending_message_code: str,
    ) -> VideoToolResult:
        return await self._build_operation_result(
            tool_context=tool_context,
            operation=operation,
            output_path=output_path,
            video_name=video_name,
            override=override,
            metadata=metadata,
            success_message_code=success_message_code,
            pending_message_code=pending_message_code,
        )

    async def _resolve_input_uri(self, media_path: str) -> str:
        if media_path.startswith(("http://", "https://")):
            return media_path

        resolved_path = await self._resolve_workspace_file(media_path)
        relative_path = self._relative_to_workspace(resolved_path)
        url = await generate_presigned_url_for_file(relative_path)
        if not url:
            raise ValueError(f"无法将本地文件转换为可访问 URL: {media_path}")
        return url

    async def _resolve_workspace_file(self, media_path: str) -> Path:
        path_obj = Path(media_path)
        candidates = [path_obj]
        if not path_obj.is_absolute():
            candidates.append(Path(self.base_dir) / media_path.lstrip('/'))

        for candidate in candidates:
            if await async_exists(str(candidate)):
                return candidate.resolve()

        raise ValueError(f"本地文件不存在: {media_path}")

    def _relative_to_workspace(self, file_path: Path) -> str:
        workspace = Path(self.base_dir).resolve()
        try:
            return str(file_path.relative_to(workspace))
        except ValueError:
            return file_path.name

    async def _download_media_file(
        self,
        tool_context: ToolContext,
        url: str,
        output_path: str,
        file_stem: str,
        default_extension: str,
        override: bool,
    ) -> Tuple[str, str]:
        if not url.startswith(("http://", "https://")):
            raise ValueError(f"无效的视频下载地址: {url}")

        save_dir = os.path.join(str(self.base_dir), output_path or DEFAULT_VIDEO_OUTPUT_DIR)
        await async_mkdir(save_dir, parents=True, exist_ok=True)

        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=600) as response:
                if response.status != 200:
                    raise ValueError(f"下载媒体文件失败，状态码: {response.status}")

                content_type = response.headers.get("Content-Type", "")
                content_length = response.headers.get("Content-Length")
                if content_length is not None and content_length.isdigit() and int(content_length) > MAX_VIDEO_DOWNLOAD_BYTES:
                    raise ValueError("下载媒体文件失败，文件过大")

                extension = self._guess_extension(url, content_type, default_extension)
                safe_stem = generate_safe_filename(file_stem) or "generated_video"
                save_path = await self._build_target_path(save_dir, safe_stem, extension, override)
                content = await response.read()
                downloaded_size = len(content)
                if downloaded_size > MAX_VIDEO_DOWNLOAD_BYTES:
                    raise ValueError("下载媒体文件失败，文件过大")

                async with self._file_versioning_context(tool_context, save_path, update_timestamp=False) as file_existed_before:
                    try:
                        async with aiofiles.open(save_path, "wb") as f:
                            await f.write(content)
                            await f.flush()
                    except Exception:
                        save_path.unlink(missing_ok=True)
                        raise

                    try:
                        await notify_generated_media_file(
                            file_path=save_path,
                            base_dir=self.base_dir,
                            file_existed=file_existed_before,
                            file_size=downloaded_size,
                            source=AI_VIDEO_GENERATION_SOURCE,
                        )
                    except Exception as e:
                        logger.warning(f"发送视频文件通知失败: {e}")

        relative_path = self._relative_to_workspace(save_path)
        return str(save_path), relative_path

    async def _build_target_path(self, save_dir: str, file_stem: str, extension: str, override: bool) -> Path:
        base_path = self.resolve_path(os.path.join(save_dir, f"{file_stem}{extension}"))

        if override or not await async_exists(str(base_path)):
            return base_path

        counter = 1
        while True:
            candidate = self.resolve_path(os.path.join(save_dir, f"{file_stem}_{counter}{extension}"))
            if not await async_exists(str(candidate)):
                return candidate
            counter += 1

    @staticmethod
    def _guess_extension(url: str, content_type: str, default_extension: str) -> str:
        path_suffix = Path(urlparse(url).path).suffix.lower()
        if path_suffix:
            return path_suffix

        mime_type = content_type.split(";")[0].strip().lower()
        guessed = mimetypes.guess_extension(mime_type) if mime_type else None
        if guessed == ".jpe":
            return ".jpg"
        return guessed or default_extension

    @staticmethod
    def _build_api_headers(request_id: str = "") -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        MetadataUtil.add_magic_and_user_authorization_headers(headers)
        if request_id:
            headers["request-id"] = request_id

        if MetadataUtil.is_initialized():
            metadata = MetadataUtil.get_metadata()
            task_id = metadata.get("super_magic_task_id")
            if task_id:
                headers["Magic-Task-Id"] = task_id
            topic_id = metadata.get("topic_id")
            if topic_id:
                headers["Magic-Topic-Id"] = topic_id
            chat_topic_id = metadata.get("chat_topic_id")
            if chat_topic_id:
                headers["Magic-Chat-Topic-Id"] = chat_topic_id
            language = metadata.get("language")
            if language:
                headers["Magic-Language"] = language

        return headers

    @staticmethod
    def _build_business_params_from_metadata() -> Dict[str, Any]:
        if not MetadataUtil.is_initialized():
            return {}

        metadata = MetadataUtil.get_metadata()
        project_id = metadata.get("project_id")
        if isinstance(project_id, str) and project_id.strip():
            return {"project_id": project_id.strip()}

        return {}

    @staticmethod
    def _build_result_metadata(
        params: GenerateVideoParams,
        model_id: str,
        operation_id: str,
        request_id: str,
        applied_generation: Dict[str, Any],
        matched_size: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        frames = []
        if params.frame_start_path:
            frames.append({"role": "start", "uri": params.frame_start_path})
        if params.frame_end_path:
            frames.append({"role": "end", "uri": params.frame_end_path})

        return {
            "model_id": model_id,
            "prompt": params.prompt,
            "operation_id": operation_id,
            "request_id": request_id,
            "requested_size": params.size or None,
            "requested_width": params.width,
            "requested_height": params.height,
            "aspect_ratio": applied_generation.get("aspect_ratio"),
            "duration_seconds": applied_generation.get("duration_seconds"),
            "resolution": applied_generation.get("resolution"),
            "fps": applied_generation.get("fps"),
            "seed": applied_generation.get("seed"),
            "watermark": applied_generation.get("watermark"),
            "reference_images": params.reference_image_paths,
            "frames": frames,
            "file_dir": params.output_path or DEFAULT_VIDEO_OUTPUT_DIR,
            "extensions": params.extensions,
            "size": matched_size,
            "actual_width": None,
            "actual_height": None,
        }

    async def _probe_video_dimensions(self, video_path: str) -> Tuple[Optional[int], Optional[int]]:
        return await asyncio.to_thread(self._probe_video_dimensions_sync, video_path)

    @staticmethod
    def _probe_video_dimensions_sync(video_path: str) -> Tuple[Optional[int], Optional[int]]:
        from moviepy.video.io.VideoFileClip import VideoFileClip

        clip = None
        try:
            clip = VideoFileClip(video_path, audio=False)
            size = getattr(clip, "size", None)
            if not isinstance(size, (list, tuple)) or len(size) != 2:
                return None, None
            width, height = size
            if width is None or height is None:
                return None, None
            return int(width), int(height)
        finally:
            if clip is not None:
                clip.close()

    def _build_generation_payload(
        self,
        params: GenerateVideoParams,
        video_generation_config: Optional[Dict[str, Any]],
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        generation: Dict[str, Any] = {}
        explicit_size = params.size.strip() if isinstance(params.size, str) else ""
        if explicit_size:
            generation["size"] = explicit_size
        matched_size = self._resolve_requested_generation_size(params, video_generation_config)
        if not explicit_size and matched_size:
            inferred_size = matched_size.get("value")
            if isinstance(inferred_size, str) and inferred_size.strip():
                generation["size"] = inferred_size.strip()

        if params.aspect_ratio:
            generation["aspect_ratio"] = params.aspect_ratio

        if params.duration_seconds is not None:
            generation["duration_seconds"] = params.duration_seconds

        resolution = params.resolution.strip() if isinstance(params.resolution, str) else ""
        if resolution:
            generation["resolution"] = resolution
        elif not explicit_size and matched_size is None:
            inferred_resolution = self._infer_resolution_from_dimensions(
                video_generation_config,
                params.width,
                params.height,
            )
            if inferred_resolution:
                generation["resolution"] = inferred_resolution

        if params.fps is not None:
            generation["fps"] = params.fps
        if params.seed is not None:
            generation["seed"] = params.seed
        if params.watermark is not None:
            generation["watermark"] = params.watermark

        return generation, matched_size

    def _resolve_requested_generation_size(
        self,
        params: GenerateVideoParams,
        video_generation_config: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        explicit_size = params.size.strip() if isinstance(params.size, str) else ""
        if explicit_size:
            matched_size = self._match_generation_size_by_value(video_generation_config, explicit_size)
            if matched_size:
                return matched_size
            supported_sizes = self._list_supported_generation_size_values(video_generation_config)
            if supported_sizes:
                logger.warning(
                    f"视频模型未匹配到 size={explicit_size}，将透传到 magic-service 兜底过滤。"
                    f" 当前 featured 声明支持: {supported_sizes}"
                )
                return None
            logger.info(
                f"视频模型未声明 generation.sizes，保留透传 size={explicit_size}，由 magic-service 侧继续过滤"
            )
            return None

        matched_size = self._match_generation_size_by_dimensions(
            video_generation_config,
            params.width,
            params.height,
        )
        return matched_size

    def _validate_input_support(
        self,
        params: GenerateVideoParams,
        video_generation_config: Optional[Dict[str, Any]],
    ) -> None:
        # 沙箱不再根据 featured video_config 限制视频参数；
        # 统一透传给 magic-service，由后端 provider client / adapter 过滤不支持字段。
        return

    @staticmethod
    def _supports_reference_images(reference_images: Any) -> bool:
        if not isinstance(reference_images, dict):
            return False

        max_count = reference_images.get("max_count")
        if isinstance(max_count, int) and max_count > 0:
            return True

        reference_types = reference_images.get("reference_types")
        if isinstance(reference_types, list) and len(reference_types) > 0:
            return True

        return reference_images.get("style_supported") is True

    def _assert_generation_list_value(
        self,
        video_generation_config: Optional[Dict[str, Any]],
        config_field: str,
        request_field: str,
        value: Any,
    ) -> None:
        return

    def _assert_generation_bool_value(
        self,
        video_generation_config: Optional[Dict[str, Any]],
        config_field: str,
        request_field: str,
    ) -> None:
        return

    def _assert_unsupported_when_featured_present(
        self,
        video_generation_config: Optional[Dict[str, Any]],
        request_field: str,
    ) -> None:
        return

    @staticmethod
    def _get_default_resolution(video_generation_config: Optional[Dict[str, Any]]) -> str:
        if not video_generation_config:
            return ""
        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return ""
        default_resolution = generation.get("default_resolution")
        return default_resolution.strip() if isinstance(default_resolution, str) else ""

    @classmethod
    def _infer_resolution_from_dimensions(
        cls,
        video_generation_config: Optional[Dict[str, Any]],
        width: Optional[int],
        height: Optional[int],
    ) -> str:
        if width is None or height is None:
            return ""

        try:
            smaller, larger = sorted((int(width), int(height)))
            normalized: Tuple[int, int] = (smaller, larger)
        except (TypeError, ValueError):
            return ""

        inferred_resolution = cls._DIMENSION_TO_RESOLUTION.get(normalized)
        if not inferred_resolution:
            return ""

        supported_resolutions = cls._list_supported_generation_resolutions(video_generation_config)
        if supported_resolutions and inferred_resolution not in supported_resolutions:
            return ""

        return inferred_resolution

    @staticmethod
    def _list_supported_generation_resolutions(video_generation_config: Optional[Dict[str, Any]]) -> List[str]:
        if not video_generation_config:
            return []

        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return []

        resolutions = generation.get("resolutions")
        if not isinstance(resolutions, list):
            return []

        values: List[str] = []
        for resolution in resolutions:
            if isinstance(resolution, str) and resolution.strip():
                values.append(resolution.strip())
        return values

    @staticmethod
    def _list_supported_generation_size_values(video_generation_config: Optional[Dict[str, Any]]) -> List[str]:
        if not video_generation_config:
            return []

        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return []

        sizes = generation.get("sizes")
        if not isinstance(sizes, list):
            return []

        values: List[str] = []
        for size in sizes:
            if not isinstance(size, dict):
                continue
            value = size.get("value")
            if isinstance(value, str) and value.strip():
                values.append(value.strip())
        return values

    @staticmethod
    def _match_generation_size_by_value(
        video_generation_config: Optional[Dict[str, Any]],
        size_value: str,
    ) -> Optional[Dict[str, Any]]:
        if not size_value:
            return None

        generation = video_generation_config.get("generation") if isinstance(video_generation_config, dict) else None
        sizes = generation.get("sizes") if isinstance(generation, dict) else None
        if not isinstance(sizes, list):
            return None

        normalized_value = size_value.strip()
        for size in sizes:
            if not isinstance(size, dict):
                continue
            value = size.get("value")
            if isinstance(value, str) and value.strip() == normalized_value:
                return size
        return None

    @staticmethod
    def _match_generation_size_by_dimensions(
        video_generation_config: Optional[Dict[str, Any]],
        width: Optional[int],
        height: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        if width is None or height is None:
            return None

        generation = video_generation_config.get("generation") if isinstance(video_generation_config, dict) else None
        sizes = generation.get("sizes") if isinstance(generation, dict) else None
        if not isinstance(sizes, list):
            return None

        try:
            normalized_width = int(width)
            normalized_height = int(height)
        except (TypeError, ValueError):
            return None

        for size in sizes:
            if not isinstance(size, dict):
                continue
            try:
                size_width = int(size.get("width"))
                size_height = int(size.get("height"))
            except (TypeError, ValueError):
                continue
            if size_width == normalized_width and size_height == normalized_height:
                return size
        return None

    @staticmethod
    def _match_generation_size(
        video_generation_config: Optional[Dict[str, Any]],
        resolution: Optional[str],
        aspect_ratio: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        if not video_generation_config:
            return None

        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return None

        sizes = generation.get("sizes")
        if not isinstance(sizes, list) or len(sizes) == 0:
            return None

        matched_by_resolution = []
        for size in sizes:
            if not isinstance(size, dict):
                continue
            if resolution and size.get("resolution") != resolution:
                continue
            matched_by_resolution.append(size)

        if not matched_by_resolution:
            matched_by_resolution = [size for size in sizes if isinstance(size, dict)]

        if aspect_ratio:
            for size in matched_by_resolution:
                if size.get("label") == aspect_ratio:
                    return size

        return matched_by_resolution[0] if matched_by_resolution else None

    @staticmethod
    def _extract_error_message(error: Dict[str, Any], fallback_status: str) -> str:
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
        return f"视频任务状态为 {fallback_status}"

    @staticmethod
    def _extract_magic_service_error_message(response_json: Any) -> str:
        if not isinstance(response_json, dict):
            return ""

        if "id" in response_json or "status" in response_json:
            return ""

        error_payload = response_json.get("error")
        if isinstance(error_payload, dict):
            return GenerateVideo._format_magic_service_error_detail(error_payload)

        return GenerateVideo._format_magic_service_error_detail(response_json)

    @staticmethod
    def _format_magic_service_error_detail(payload: Dict[str, Any]) -> str:
        message = payload.get("message")
        if not isinstance(message, str) or not message.strip():
            return ""

        details = [message.strip()]
        code = payload.get("code")
        if code not in (None, ""):
            details.append(f"code={code}")
        request_id = payload.get("request_id")
        if isinstance(request_id, str) and request_id.strip():
            details.append(f"request_id={request_id.strip()}")
        support_url = payload.get("support_url")
        if isinstance(support_url, str) and support_url.strip():
            details.append(f"support_url={support_url.strip()}")

        if len(details) == 1:
            return details[0]
        return f"{details[0]} ({', '.join(details[1:])})"

    async def get_after_tool_call_friendly_content(
        self, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> str:
        return result.content

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict[str, str]:
        return _build_video_tool_action_and_remark(self.name, result)


@tool(name="query_video_generation")
class QueryVideoGeneration(AbstractFileTool[QueryVideoGenerationParams], WorkspaceTool[QueryVideoGenerationParams]):
    """查询视频生成任务并在成功时下载结果。"""

    def __init__(self, **data):
        if "base_dir" not in data:
            data["base_dir"] = PathManager.get_workspace_dir()
        super().__init__(**data)
        self._video_tool = GenerateVideo(base_dir=self.base_dir)

    async def execute(self, tool_context: ToolContext, params: QueryVideoGenerationParams) -> VideoToolResult:
        try:
            logger.info(
                "开始查询视频生成任务: "
                f"{_format_tool_context_for_log(tool_context)} "
                f"operation_id={params.operation_id} request_id={params.request_id or ''} "
                f"project_path={params.project_path or ''} element_id={params.element_id or ''}"
            )
            operation = await self._video_tool.wait_for_operation(
                operation_id=params.operation_id,
                poll_interval_seconds=params.poll_interval_seconds,
                poll_timeout_seconds=params.poll_timeout_seconds,
                request_id=params.request_id,
                tool_context=tool_context,
                progress_payload={
                    "tool_name": getattr(tool_context, "tool_name", self.name),
                    "file_name": params.video_name,
                    "project_path": params.project_path,
                    "element_id": params.element_id,
                },
            )
            metadata = {
                "operation_id": params.operation_id,
                "request_id": params.request_id or None,
                "file_dir": params.output_path or DEFAULT_VIDEO_OUTPUT_DIR,
            }
            result = await self._video_tool.build_operation_result(
                tool_context=tool_context,
                operation=operation,
                output_path=params.output_path,
                video_name=params.video_name,
                override=params.override,
                metadata=metadata,
                success_message_code="query_video_generation.success",
                pending_message_code="query_video_generation.pending",
            )
            logger.info(
                "查询视频生成任务结束: "
                f"operation_id={params.operation_id} request_id={params.request_id or ''} "
                f"status={_normalize_video_operation_status(operation) or ''}"
            )
            return await self._sync_canvas_video_element_if_needed(tool_context, params, result)
        except Exception as e:
            logger.exception(f"查询视频生成任务失败: {e!s}")
            return VideoToolResult(
                ok=False,
                content=i18n.translate("query_video_generation.error", category="tool.messages", error=str(e)),
                videos=[],
                extra_info={"error": str(e), "operation_id": params.operation_id, "request_id": params.request_id or None},
            )

    async def _sync_canvas_video_element_if_needed(
        self,
        tool_context: ToolContext,
        params: QueryVideoGenerationParams,
        result: VideoToolResult,
    ) -> VideoToolResult:
        project_path = params.project_path.strip()
        element_id = params.element_id.strip()
        if not project_path or not element_id:
            return result

        try:
            properties = await self._build_canvas_sync_properties(params, result)
            if not properties:
                return result

            from app.tools.design.tools.batch_update_canvas_elements import (
                BatchUpdateCanvasElements,
                BatchUpdateCanvasElementsParams,
                ElementUpdate,
            )

            update_tool = BatchUpdateCanvasElements(base_dir=self.base_dir)
            update_result = await update_tool.execute(
                tool_context,
                BatchUpdateCanvasElementsParams(
                    project_path=project_path,
                    updates=[ElementUpdate(element_id=element_id, properties=properties)],
                ),
            )

            result.extra_info["canvas_sync"] = {
                "project_path": project_path,
                "element_id": element_id,
                "updated": update_result.ok,
            }
            if update_result.ok:
                result.extra_info["elements"] = update_result.extra_info.get("elements", [])
            else:
                result.extra_info["canvas_sync"]["error"] = update_result.content
                logger.warning(
                    f"查询视频任务后回填画布元素失败: project_path={project_path}, "
                    f"element_id={element_id}, error={update_result.content}"
                )
            return result
        except Exception as e:
            result.extra_info["canvas_sync"] = {
                "project_path": project_path,
                "element_id": element_id,
                "updated": False,
                "error": str(e),
            }
            logger.warning(f"查询视频任务后回填画布元素异常: {e!s}")
            return result

    async def _build_canvas_sync_properties(
        self,
        params: QueryVideoGenerationParams,
        result: VideoToolResult,
    ) -> Dict[str, Any]:
        existing_request = await self._load_existing_generate_request(params.project_path, params.element_id)
        extra_info = result.extra_info or {}
        status = str(extra_info.get("status", "")).strip().lower()
        metadata = extra_info.get("metadata")

        merged_request = self._merge_generate_request(existing_request, metadata, params)
        properties: Dict[str, Any] = {"generateVideoRequest": merged_request}

        if status == "succeeded":
            properties.update(
                {
                    "src": extra_info.get("saved_video_relative_path"),
                    "poster": extra_info.get("saved_poster_relative_path"),
                    "status": "completed",
                    "errorMessage": None,
                }
            )
            actual_width = self._normalize_canvas_dimension(merged_request.get("actual_width"))
            actual_height = self._normalize_canvas_dimension(merged_request.get("actual_height"))
            if actual_width is not None and actual_height is not None:
                properties["width"] = actual_width
                properties["height"] = actual_height
            return properties

        if status in {"failed", "canceled"}:
            properties.update(
                {
                    "status": "failed",
                    "errorMessage": result.content,
                }
            )
            return properties

        properties.update({"status": "processing"})
        return properties

    async def _load_existing_generate_request(self, project_path: str, element_id: str) -> Dict[str, Any]:
        from app.tools.design.manager.canvas_manager import CanvasManager

        manager = CanvasManager(str(self.resolve_path(project_path)))
        await manager.load()
        element = await manager.get_element_by_id(element_id)
        if element is None:
            raise ValueError(f"未找到需要回填的视频元素: {element_id}")

        generate_request = getattr(element, "generateVideoRequest", None)
        if isinstance(generate_request, dict):
            return dict(generate_request)
        if _is_dataclass_instance(generate_request):
            return dataclasses.asdict(generate_request)
        return {}

    @staticmethod
    def _merge_generate_request(
        existing_request: Dict[str, Any],
        metadata: Any,
        params: QueryVideoGenerationParams,
    ) -> Dict[str, Any]:
        merged_request = dict(existing_request)
        if isinstance(metadata, dict):
            for key, value in metadata.items():
                if QueryVideoGeneration._should_merge_generate_request_value(value):
                    merged_request[key] = value

        merged_request["operation_id"] = params.operation_id
        if params.request_id:
            merged_request["request_id"] = params.request_id
        if params.output_path:
            merged_request["file_dir"] = params.output_path
        return merged_request

    @staticmethod
    def _should_merge_generate_request_value(value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, (list, dict)):
            return bool(value)
        return True

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

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict[str, str]:
        return _build_video_tool_action_and_remark(self.name, result)
