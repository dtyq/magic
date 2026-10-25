"""Canvas 到旧 Design 视频接口的请求体转换器。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.generation.adapters.project_identity_resolver import ProjectIdentityResolver
from app.tools.canvas.infrastructure.assets import ProjectAssetPathResolver
from app.tools.video_generation_utils import VideoAudioPolicyResolver


class DesignVideoPayloadBuilder:
    """把 Canvas 视频参数转换为旧 Design API 的稳定协议。"""

    def __init__(self, workspace: Path) -> None:
        """保存工作区路径解析依赖。"""
        self._project_identity_resolver = ProjectIdentityResolver()
        self._asset_path_resolver = ProjectAssetPathResolver(workspace)

    def build(
        self,
        project_path: str,
        parameters: GenerationParameters,
        video_id: str,
        file_dir: str,
        tool_context: ToolContext | None,
    ) -> dict[str, Any]:
        """生成提交或积分预估共用的 Design API 请求体。"""
        project = self._project_identity_resolver.resolve(project_path)
        project_id = self.resolve_project_id(tool_context)
        model_id = self._resolve_model_id(parameters, tool_context)
        payload: dict[str, Any] = {
            "project_id": project_id,
            "model_id": model_id,
            "prompt": parameters.prompt,
            "input_mode": self._resolve_input_mode(parameters),
            "task": parameters.task or "generate",
            "inputs": self._build_inputs(project_path, parameters),
        }
        generation = self._build_generation(parameters, model_id)
        if generation:
            payload["generation"] = generation
        if parameters.extensions:
            payload["extensions"] = dict(parameters.extensions)
        if video_id:
            payload["video_id"] = video_id
        if file_dir:
            payload["file_dir"] = self._format_file_dir(file_dir, project.project_path)
        return payload

    def _build_inputs(self, project_path: str, parameters: GenerationParameters) -> dict[str, Any]:
        """转换参考图片、视频、音频及首尾帧输入。"""
        image_paths = parameters.effective_reference_images()
        inputs: dict[str, Any] = {
            "reference_images": [{"uri": self._to_design_uri(project_path, path)} for path in image_paths],
            "reference_videos": [{"uri": self._to_design_uri(project_path, path)} for path in parameters.reference_video_paths],
            "reference_audios": [{"uri": self._to_design_uri(project_path, path)} for path in parameters.reference_audio_paths],
            "frames": [],
        }
        if parameters.frame_start_path:
            inputs["frames"].append({"role": "start", "uri": self._to_design_uri(project_path, parameters.frame_start_path)})
        if parameters.frame_end_path:
            inputs["frames"].append({"role": "end", "uri": self._to_design_uri(project_path, parameters.frame_end_path)})
        return inputs

    def _to_design_uri(self, project_path: str, asset_path: str) -> str:
        """将 Canvas 路径转换为旧 Design API 的工作区路径，保留供应商 URI。"""
        normalized = self._asset_path_resolver.to_workspace_reference_path(project_path, asset_path)
        if "://" in normalized or normalized.startswith("data:"):
            if normalized.startswith(("http://", "https://")):
                raise ValueError(f"旧 Design 视频接口不支持外部 URL 参考素材: {asset_path}")
            return normalized
        return "/" + normalized.strip("/")

    @staticmethod
    def _build_generation(parameters: GenerationParameters, model_id: str = "") -> dict[str, Any]:
        """构造旧 Design API 支持的生成参数，并转换统一音频策略。"""
        values = {
            "aspect_ratio": parameters.aspect_ratio,
            "duration_seconds": parameters.duration_seconds,
            "resolution": parameters.resolution,
            "fps": parameters.fps,
            "seed": parameters.seed,
            "watermark": parameters.watermark,
            "draft": parameters.draft,
            "generate_audio": VideoAudioPolicyResolver.to_legacy_generate_audio(
                parameters.audio_policy,
                model_id or parameters.model_id or "",
            ),
        }
        return {key: value for key, value in values.items() if value is not None and value != ""}

    @staticmethod
    def _resolve_input_mode(parameters: GenerationParameters) -> str:
        """在未显式指定时按参考素材推断 Design 输入模式。"""
        if parameters.input_mode:
            return parameters.input_mode
        if parameters.task == "edit":
            return "video_edit"
        if parameters.frame_start_path or parameters.frame_end_path:
            return "keyframe_guided"
        if (
            parameters.effective_reference_images()
            or parameters.reference_video_paths
            or parameters.reference_audio_paths
        ):
            return "omni_reference"
        return "standard"

    @staticmethod
    def resolve_input_mode(parameters: GenerationParameters) -> str:
        """返回提交前可确定的视频输入模式。"""
        return DesignVideoPayloadBuilder._resolve_input_mode(parameters)

    @staticmethod
    def resolve_project_id(tool_context: ToolContext | None) -> str:
        """从当前工具上下文取得 Magic Service 所需的项目 ID。"""
        project_id = ""
        if tool_context is not None:
            project_id = str(tool_context.get_metadata("project_id") or "").strip()
        if not project_id:
            from agentlang.utils.metadata import MetadataUtil

            if MetadataUtil.is_initialized():
                project_id = str(MetadataUtil.get_metadata().get("project_id") or "").strip()
        if not project_id:
            raise ValueError("缺少 project_id，无法提交 Design 视频生成任务")
        return project_id

    @staticmethod
    def _resolve_model_id(parameters: GenerationParameters, tool_context: ToolContext | None) -> str:
        """优先使用请求模型，否则读取当前 Agent 的视频模型。"""
        model_id = str(parameters.model_id or "").strip()
        if not model_id and tool_context is not None:
            agent_context = tool_context.get_extension("agent_context")
            model_context = getattr(agent_context, "model_context", None) if agent_context else None
            model_id = str(getattr(model_context, "video_model_id", "") or "").strip()
        if not model_id:
            raise ValueError("未指定视频模型，无法提交 Design 视频生成任务")
        return model_id

    @staticmethod
    def resolve_model_id(parameters: GenerationParameters, tool_context: ToolContext | None) -> str:
        """返回提交前可确定的视频最终模型。"""
        return DesignVideoPayloadBuilder._resolve_model_id(parameters, tool_context)

    @staticmethod
    def _format_file_dir(file_dir: str, project_path: str) -> str:
        """将输出目录规范化为旧 Design API 的项目文件树路径。"""
        normalized = str(file_dir or "").strip().replace("\\", "/")
        if not normalized:
            normalized = project_path + "/videos"
        if not normalized.startswith("/"):
            normalized = "/" + normalized
        normalized = "/" + normalized.strip("/")
        return normalized if normalized == "/" else normalized + "/"
