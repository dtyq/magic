"""Canvas 旧 Design 视频接口适配器。"""

from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.core.config.debug_config import is_local_debug_mode_enabled
from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.generation.adapters.design_video_payload_builder import DesignVideoPayloadBuilder
from app.tools.canvas.generation.adapters.project_identity_resolver import ProjectIdentityResolver
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_query_result import GenerationQueryResult
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.generation.contracts.generation_submission import GenerationSubmission
from app.tools.canvas.generation.ports.query_port import GenerationQueryPort
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort
from app.tools.canvas.generation.video_filename import build_video_filename
from app.tools.canvas.infrastructure.assets import ProjectAssetPathResolver
from app.tools.canvas.infrastructure.workspace import (
    CanvasFileReadinessChecker,
    CanvasWorkspaceDirectoryManager,
)
from app.tools.video_generation_utils.video_input_utils import VideoInputPayloadBuilder

logger = get_logger(__name__)


class DesignVideoGenerationPort(GenerationSubmissionPort, GenerationQueryPort):
    """通过 POST/GET Design API 提交和查询 Canvas 视频任务。"""

    execution_mode = "async"

    def __init__(self, workspace: Path) -> None:
        """创建请求转换、项目路径和 Magic Service 依赖。"""
        self.workspace = workspace
        self._client = MagicServiceClient()
        self._payload_builder = DesignVideoPayloadBuilder(workspace)
        self._project_identity_resolver = ProjectIdentityResolver()
        self._asset_path_resolver = ProjectAssetPathResolver(workspace)
        self._workspace_directories = CanvasWorkspaceDirectoryManager(workspace)
        self._file_readiness = CanvasFileReadinessChecker(workspace)

    async def resolve_request_metadata(self, request: GenerationRequest, tool_context: ToolContext | None) -> dict[str, object]:
        """在提交前解析视频最终模型、输入模式和任务类型。"""
        return {
            "model_id": self._payload_builder.resolve_model_id(request.parameters, tool_context),
            "input_mode": self._payload_builder.resolve_input_mode(request.parameters),
            "task": request.parameters.task or "generate",
        }

    async def submit(self, request: GenerationRequest, tool_context: ToolContext | None) -> GenerationSubmission:
        """提交 Design 视频任务并保存服务返回的视频 ID。"""
        provider_task_id = f"vid_{uuid.uuid4().hex[:16]}"
        started_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        request_metadata: dict[str, Any] = {}
        result_metadata: dict[str, Any] = {"runtime": {"started_at": started_at}}
        try:
            project = self._project_identity_resolver.resolve(request.project_path)
            project_id = self._payload_builder.resolve_project_id(tool_context)
            await self._workspace_directories.ensure_media_directories(project.project_path)
            await self._ensure_remote_media_directories(project_id, project.project_path)
            output_filename = build_video_filename(request.parameters.name, provider_task_id, request.content_id)
            payload = self._payload_builder.build(
                request.project_path,
                request.parameters,
                provider_task_id,
                f"/{project.project_path}/videos/",
                tool_context,
            )
            payload = await self._build_transport_payload(
                payload,
                request.project_path,
                request.parameters,
            )
            request_metadata = {
                "model_id": payload.get("model_id"),
                "input_mode": payload.get("input_mode"),
                "task": payload.get("task"),
            }
            result_metadata = self._result_metadata(
                {},
                fallback={
                    "generation_info": self._generation_info(payload),
                    "runtime": {"started_at": started_at},
                },
            )
        except Exception as error:
            logger.exception(
                "Canvas Design 视频提交请求构造失败: project_path={} element_id={} content_id={} video_id={} error={}",
                request.project_path,
                request.element_id,
                request.content_id,
                provider_task_id,
                error,
            )
            return GenerationSubmission(
                "async",
                "failed",
                error_message=str(error),
                request_metadata=request_metadata,
                result_metadata=result_metadata,
            )

        logger.info(
            "Canvas Design 视频提交请求: endpoint=POST /api/v1/design/generate-video "
            "project_id={} project_path={} element_id={} content_id={} video_id={} "
            "model_id={} file_dir={} task={} input_mode={} reference_counts={} generation={}",
            payload.get("project_id"),
            request.project_path,
            request.element_id,
            request.content_id,
            provider_task_id,
            payload.get("model_id"),
            payload.get("file_dir"),
            payload.get("task"),
            payload.get("input_mode"),
            self._reference_counts(payload),
            payload.get("generation") or {},
        )
        try:
            response = await self._client.generate_design_video(payload)
        except Exception as error:
            logger.exception(
                "Canvas Design 视频提交请求异常: project_path={} content_id={} video_id={} error={}",
                request.project_path,
                request.content_id,
                provider_task_id,
                error,
            )
            return GenerationSubmission(
                "async",
                "failed",
                error_message=str(error),
                request_metadata=request_metadata,
                result_metadata=result_metadata,
            )
        returned_id = str(response.get("video_id") or response.get("id") or provider_task_id).strip()
        status = self._status(response) or "processing"
        logger.info(
            "Canvas Design 视频提交响应: project_path={} content_id={} requested_video_id={} "
            "provider_video_id={} status={} response_keys={}",
            request.project_path,
            request.content_id,
            provider_task_id,
            returned_id,
            status,
            sorted(response.keys()),
        )
        if status in {"failed", "error", "canceled", "cancelled"}:
            logger.warning(
                "Canvas Design 视频提交失败: project_path={} content_id={} provider_video_id={} status={} error={}",
                request.project_path,
                request.content_id,
                returned_id,
                status,
                self._error_message(response),
            )
            return GenerationSubmission(
                "async",
                "failed",
                error_message=self._error_message(response),
                request_metadata=request_metadata,
                result_metadata=self._result_metadata(response, fallback=result_metadata),
            )
        generation_task_id = f"canvas-generation-{uuid.uuid4().hex}"
        logger.info(
            "Canvas Design 视频任务已提交: project_path={} content_id={} generation_task_id={} provider_video_id={} output_filename={}",
            request.project_path,
            request.content_id,
            generation_task_id,
            returned_id,
            output_filename,
        )
        return GenerationSubmission(
            "async",
            "processing",
            generation_task_id=generation_task_id,
            provider_task_id=returned_id,
            request_metadata={"outputFilename": output_filename, **request_metadata},
            result_metadata=self._result_metadata(
                response,
                fallback={
                    "generation_info": self._generation_info(payload),
                    "runtime": {"started_at": started_at},
                },
            ),
        )

    async def _ensure_remote_media_directories(self, project_id: str, project_path: str) -> None:
        """确保 Magic Service 文件树存在 Canvas 的媒体目录。"""
        for media_directory in CanvasWorkspaceDirectoryManager.REQUIRED_DIRECTORIES:
            directory_parts = CanvasWorkspaceDirectoryManager.project_directory_parts(
                project_path,
                media_directory,
            )
            await self._client.ensure_project_directories(project_id, directory_parts)
        logger.debug(
            "Canvas Design 视频工作区目录已准备: project_id={} project_path={} directories={}",
            project_id,
            project_path,
            CanvasWorkspaceDirectoryManager.REQUIRED_DIRECTORIES,
        )

    async def _build_transport_payload(
        self,
        persisted_payload: dict[str, Any],
        project_path: str,
        parameters: GenerationParameters,
    ) -> dict[str, Any]:
        """按配置转换视频参考图片，但保留 Canvas 中持久化的路径参数。"""
        builder = VideoInputPayloadBuilder(self.workspace)
        if not builder.enabled:
            return persisted_payload

        image_paths = parameters.effective_reference_images()
        reference_images = [
            await builder.build_image_input(
                self._asset_path_resolver.to_workspace_reference_path(project_path, path)
            )
            for path in image_paths
        ]
        frames: list[dict[str, Any]] = []
        for role, path in (
            ("start", parameters.frame_start_path),
            ("end", parameters.frame_end_path),
        ):
            if path:
                frames.append(
                    {
                        "role": role,
                        **await builder.build_image_input(
                            self._asset_path_resolver.to_workspace_reference_path(project_path, path)
                        ),
                    }
                )

        inputs = persisted_payload.get("inputs")
        persisted_inputs = inputs if isinstance(inputs, dict) else {}
        return {
            **persisted_payload,
            "inputs": {
                **persisted_inputs,
                "reference_images": reference_images,
                "frames": frames,
            },
        }

    async def query(self, request: GenerationQueryRequest, tool_context: ToolContext | None) -> GenerationQueryResult:
        """查询 Design 视频状态，仅本地调试模式下载结果文件。"""
        try:
            project_id = self._payload_builder.resolve_project_id(tool_context)
            await self._workspace_directories.ensure_media_directories(request.project_path)
        except Exception as error:
            logger.exception(
                "Canvas Design 视频查询请求构造失败: project_path={} content_id={} provider_video_id={} error={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                error,
            )
            return GenerationQueryResult("failed", error_message=str(error))
        logger.debug(
            "Canvas Design 视频查询请求: endpoint=GET /api/v1/design/video-generation-result "
            "project_id={} project_path={} element_id={} content_id={} provider_video_id={}",
            project_id,
            request.project_path,
            request.element_id,
            request.content_id,
            request.provider_task_id,
        )
        try:
            response = await self._client.query_video_generation_result(project_id, request.provider_task_id)
        except Exception as error:
            logger.exception(
                "Canvas Design 视频查询请求异常: project_path={} content_id={} provider_video_id={} error={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                error,
            )
            return GenerationQueryResult("failed", error_message=str(error))
        status = self._status(response)
        response_log = logger.info if status in {"completed", "failed", "error", "canceled", "cancelled"} else logger.debug
        response_log(
            "Canvas Design 视频查询响应: project_path={} content_id={} provider_video_id={} status={} "
            "local_debug={} file_url_present={} file_dir={} file_name={} response_keys={}",
            request.project_path,
            request.content_id,
            request.provider_task_id,
            status or "unknown",
            is_local_debug_mode_enabled(),
            bool(response.get("file_url")),
            response.get("file_dir") or "",
            response.get("file_name") or "",
            sorted(response.keys()),
        )
        if status in {"failed", "error", "canceled", "cancelled"}:
            logger.warning(
                "Canvas Design 视频远端任务失败: project_path={} content_id={} provider_video_id={} status={} error={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                status,
                self._error_message(response),
            )
            return GenerationQueryResult(
                "failed",
                error_message=self._error_message(response),
                result_metadata=self._result_metadata(response),
            )
        if status != "completed":
            return GenerationQueryResult("processing", result_metadata=self._result_metadata(response))
        project = self._project_identity_resolver.resolve(request.project_path)
        project_root = self._asset_path_resolver.resolve_project_root(request.project_path)
        if not is_local_debug_mode_enabled():
            try:
                output_uri = self._build_workspace_output_uri(
                    request,
                    response,
                    project.project_path,
                    project_root,
                )
            except Exception as error:
                logger.exception(
                    "Canvas Design 工作区视频路径解析失败: project_path={} content_id={} provider_video_id={} error={}",
                    request.project_path,
                    request.content_id,
                    request.provider_task_id,
                    error,
                )
                return GenerationQueryResult("failed", error_message=str(error))
            if not await self._file_readiness.wait_for_uri(request.project_path, output_uri):
                logger.debug(
                    "Canvas Design 视频已完成但本地 MagicFS 文件尚未就绪，继续等待: "
                    "project_path={} content_id={} provider_video_id={} output_uri={}",
                    request.project_path,
                    request.content_id,
                    request.provider_task_id,
                    output_uri,
                )
                return GenerationQueryResult("processing")
            logger.info(
                "Canvas Design 视频已由 Magic Service 写入工作区: project_path={} content_id={} provider_video_id={} output_uri={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                output_uri,
            )
            return GenerationQueryResult(
                "completed",
                output_uri=output_uri,
                result_metadata=self._result_metadata(response),
            )

        file_url = str(response.get("file_url") or "").strip()
        if not file_url:
            logger.error(
                "Canvas Design 本地调试视频已完成但缺少 file_url: project_path={} content_id={} provider_video_id={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
            )
            return GenerationQueryResult("failed", error_message="Design video result has no file_url.")

        output_filename = request.output_filename or build_video_filename(
            None,
            request.provider_task_id,
            request.content_id,
        )
        target = project_root / "videos" / output_filename
        logger.info(
            "Canvas Design 本地调试视频下载开始: project_path={} content_id={} provider_video_id={} output_filename={} file_url_present=True",
            request.project_path,
            request.content_id,
            request.provider_task_id,
            output_filename,
        )
        try:
            await self._client.download_url_to_path(file_url, target)
            output_uri = self._asset_path_resolver.to_project_uri(project.project_path, target)
            if not await self._file_readiness.wait_for_uri(request.project_path, output_uri):
                return GenerationQueryResult(
                    "failed",
                    error_message="Downloaded Design video is not ready in the Canvas workspace.",
                    result_metadata=self._result_metadata(response),
                )
            logger.info(
                "Canvas Design 本地调试视频下载完成: project_path={} content_id={} provider_video_id={} output_uri={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                output_uri,
            )
            return GenerationQueryResult(
                "completed",
                output_uri=output_uri,
                result_metadata=self._result_metadata(response),
            )
        except Exception as error:
            logger.exception(
                "Canvas Design 本地调试视频下载失败: project_path={} content_id={} provider_video_id={} target={} error={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                target,
                error,
            )
            return GenerationQueryResult(
                "failed",
                error_message=str(error),
                result_metadata=self._result_metadata(response),
            )

    @staticmethod
    def _generation_info(payload: dict[str, Any]) -> dict[str, Any]:
        """从已解析的 Design 请求体提取前端展示所需的生成信息。"""
        generation = payload.get("generation") if isinstance(payload.get("generation"), dict) else {}
        values = {
            "task": payload.get("task"),
            "input_mode": payload.get("input_mode"),
            "aspect_ratio": generation.get("aspect_ratio"),
            "resolution": generation.get("resolution"),
            "duration_seconds": generation.get("duration_seconds"),
        }
        return {key: value for key, value in values.items() if value not in (None, "")}

    @classmethod
    def _result_metadata(
        cls,
        response: dict[str, Any],
        fallback: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """从 Design 响应提取白名单元数据，避免把 provider 原始响应写入 sidecar。"""
        metadata = dict(fallback or {})
        for nested_key in ("data", "result", "metadata"):
            nested_response = response.get(nested_key)
            if isinstance(nested_response, dict):
                response = {**nested_response, **response}
        for key in ("billing", "generation_info", "runtime"):
            value = response.get(key)
            if isinstance(value, dict):
                metadata[key] = {**(metadata.get(key) if isinstance(metadata.get(key), dict) else {}), **value}
        return metadata

    def _build_workspace_output_uri(
        self,
        request: GenerationQueryRequest,
        response: dict[str, object],
        project_path: str,
        project_root: Path,
    ) -> str:
        """把 Magic Service 返回的项目文件路径转换为 Canvas 项目 URI。"""
        file_name = str(response.get("file_name") or "").strip()
        if not file_name:
            file_name = str(request.output_filename or "").strip()
            logger.warning(
                "Canvas Design 完成响应缺少 file_name，使用提交时文件名回退: project_path={} content_id={} provider_video_id={} output_filename={}",
                request.project_path,
                request.content_id,
                request.provider_task_id,
                file_name,
            )
        if not file_name or Path(file_name).name != file_name:
            raise ValueError("Design video result has no safe file_name.")

        file_dir = str(response.get("file_dir") or "").strip().replace("\\", "/")
        normalized_project_path = project_path.strip("/")
        normalized_file_dir = file_dir.strip("/")
        relative_dir = "videos"
        if normalized_file_dir:
            if normalized_file_dir == normalized_project_path:
                relative_dir = ""
            elif normalized_file_dir.startswith(f"{normalized_project_path}/"):
                relative_dir = normalized_file_dir[len(normalized_project_path) + 1 :].strip("/")
            else:
                raise ValueError(
                    f"Design video result file_dir is outside project: {file_dir}"
                )
        target = project_root / relative_dir / file_name if relative_dir else project_root / file_name
        return self._asset_path_resolver.to_project_uri(project_path, target)

    @staticmethod
    def _reference_counts(payload: dict[str, object]) -> dict[str, int]:
        """返回参考素材数量，避免日志记录具体素材 URI。"""
        inputs = payload.get("inputs")
        if not isinstance(inputs, dict):
            return {"images": 0, "videos": 0, "audios": 0, "frames": 0}
        return {
            "images": len(inputs.get("reference_images") or []) if isinstance(inputs.get("reference_images"), list) else 0,
            "videos": len(inputs.get("reference_videos") or []) if isinstance(inputs.get("reference_videos"), list) else 0,
            "audios": len(inputs.get("reference_audios") or []) if isinstance(inputs.get("reference_audios"), list) else 0,
            "frames": len(inputs.get("frames") or []) if isinstance(inputs.get("frames"), list) else 0,
        }

    @staticmethod
    def _status(response: dict[str, object]) -> str:
        """读取并规范化 Design API 状态。"""
        return str(response.get("status") or "").strip().lower()

    @staticmethod
    def _error_message(response: dict[str, object]) -> str:
        """保留 Design API 返回的真实错误信息。"""
        return str(response.get("error_message") or response.get("error") or response.get("message") or "Video generation failed.")
