# -*- coding: utf-8 -*-
"""
视频模型配置服务

处理视频生成模型的 featured 配置，按需生成运行时隐藏 user message。
"""

import json
from typing import Any, Dict, Optional, Protocol

from app.utils.video_logger import get_video_logger

logger = get_video_logger(__name__)


class SessionConfigChatHistory(Protocol):
    def get_last_session_config(self) -> Dict[str, Any]:
        """返回上次会话配置。"""


class AgentSessionConfigReader(Protocol):
    chat_history: SessionConfigChatHistory


class VideoModelConfigService:
    """视频模型配置服务类"""

    @staticmethod
    def _extract_supported_sizes(video_generation_config: Dict[str, Any]) -> list[dict[str, Any]]:
        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return []

        sizes = generation.get("sizes")
        if not isinstance(sizes, list):
            return []

        return [size for size in sizes if isinstance(size, dict)]

    @staticmethod
    def _build_supported_size_rule(video_generation_config: Dict[str, Any]) -> str:
        supported_sizes = VideoModelConfigService._extract_supported_sizes(video_generation_config)
        if not supported_sizes:
            return "- If generation.sizes is absent, do not invent a size parameter. Use only supported aspect_ratio / resolution values from this config."

        formatted_sizes = []
        has_1080p_size = False
        for size in supported_sizes:
            value = size.get("value")
            if not isinstance(value, str) or not value.strip():
                continue

            label = size.get("label")
            resolution = size.get("resolution")
            detail_parts = []
            if isinstance(label, str) and label.strip():
                detail_parts.append(f"aspect_ratio={label.strip()}")
            if isinstance(resolution, str) and resolution.strip():
                resolution_value = resolution.strip()
                detail_parts.append(f"resolution={resolution_value}")
                if resolution_value == "1080p":
                    has_1080p_size = True

            detail = f" ({', '.join(detail_parts)})" if detail_parts else ""
            formatted_sizes.append(f"{value.strip()}{detail}")

        if not formatted_sizes:
            return "- Prefer generation.sizes when selecting real width/height combinations, and only choose a size declared in this config."

        preference = "Prefer a 1080p size first when the user does not specify a size or resolution." if has_1080p_size else (
            "If the user does not specify a size or resolution, prefer the featured default resolution or another supported size."
        )
        joined_sizes = "; ".join(formatted_sizes)
        return (
            "- Prefer the `size` parameter when calling video tools, and choose it only from generation.sizes.value. "
            f"Supported sizes: {joined_sizes}. {preference}"
        )

    @staticmethod
    def _build_resolution_preference_rule(video_generation_config: Dict[str, Any]) -> str:
        """根据 featured 配置生成分辨率偏好规则。

        这里只负责拼接给 LLM 的提示文本，不直接修改工具层的实际默认值。
        """
        generation = video_generation_config.get("generation")
        if not isinstance(generation, dict):
            return "- If the user does not specify a resolution, choose an appropriate supported resolution from this config instead of inventing one."

        resolutions = generation.get("resolutions")
        if isinstance(resolutions, list) and "1080p" in resolutions:
            return (
                "- If the user does not specify a resolution, prefer 1080p when calling the video tool, "
                "but only if 1080p is listed in generation.resolutions or generation.sizes."
            )

        default_resolution = generation.get("default_resolution")
        if isinstance(default_resolution, str) and default_resolution.strip():
            return (
                f"- If the user does not specify a resolution, prefer the featured default resolution "
                f"`{default_resolution.strip()}` or another supported resolution from this config."
            )

        return "- If the user does not specify a resolution, choose an appropriate supported resolution from this config instead of inventing one."

    @staticmethod
    def build_video_model_context(video_model_id: str, video_generation_config: Dict[str, Any], is_model_changed: bool = False) -> str:
        """构建视频模型 featured 配置的提示文本。

        与图片模型尺寸提示的思路保持一致：
        - 仅在当前模型能力配置需要告知 LLM 时才追加
        - 当检测到模型切换时，显式告知是“模型已切换”
        """
        if not video_generation_config:
            return ""

        if is_model_changed:
            lines = [
                "[System Note] The video generation model has been switched. The following is the runtime capability configuration of the current video model. This information is only for video generation tool usage. Only use these values when the user asks about video generation options or when you need to call a video generation tool.",
            ]
        else:
            lines = [
                "[System Note] The following is the runtime capability configuration of the current video generation model. This information is only for video generation tool usage. Only use these values when the user asks about video generation options or when you need to call a video generation tool.",
            ]

        lines.extend([
            "",
            f"Current video model: {video_model_id or 'unknown'}",
            "Use the following featured config as the source of truth:",
            json.dumps(video_generation_config, ensure_ascii=False, indent=2, sort_keys=True),
            "",
            "Tool usage rules:",
            VideoModelConfigService._build_supported_size_rule(video_generation_config),
            "- For generate_videos_to_canvas, width/height are canvas element dimensions. Use the `size` parameter for real video generation size whenever possible.",
            "- If `size` is omitted but width/height exactly matches one entry in generation.sizes, the tool may infer the corresponding aspect_ratio and resolution automatically.",
            VideoModelConfigService._build_resolution_preference_rule(video_generation_config),
            "- Only use supported_inputs, reference_images, generation, and constraints declared in this config.",
            "- If a field is absent or explicitly unsupported here, do not send it to the video tool.",
        ])
        return "\n".join(lines)

    @staticmethod
    def build_runtime_video_model_config_message(
        dynamic_config: Optional[Dict[str, Any]],
        agent: AgentSessionConfigReader,
    ) -> Optional[str]:
        """从 dynamic_config 中提取视频模型能力信息并构建运行时隐藏 user message。

        行为与旧的 query 追加逻辑保持一致：
        - 只在 video_model_id 或 video_generation_config 发生变化时产出消息
        - 如果当前会话与上次会话的模型和能力配置都未变化，则直接跳过

        之所以不只比较 model_id，是因为同一个模型在不同环境/发布阶段下，
        featured 配置本身也可能变化；这里要确保提示词与实际能力配置一致。
        """
        try:
            if not dynamic_config:
                return None

            video_model = dynamic_config.get("video_model")
            if not isinstance(video_model, dict):
                return None

            current_video_model_id = video_model.get("model_id")
            current_video_generation_config = video_model.get("video_generation_config")
            if not isinstance(current_video_generation_config, dict) or not current_video_generation_config:
                return None

            last_session_config = agent.chat_history.get_last_session_config()
            last_video_model_id = last_session_config.get("video_model_id")
            last_video_generation_config = last_session_config.get("video_generation_config")

            # 和图片模型尺寸信息类似，这里通过比较“上次会话配置”和“当前动态配置”
            # 来决定是否需要再次把视频能力信息追加到 query 中。
            current_config_json = json.dumps(current_video_generation_config, sort_keys=True, ensure_ascii=False)
            if isinstance(last_video_generation_config, dict):
                last_config_json = json.dumps(last_video_generation_config, sort_keys=True, ensure_ascii=False)
                if last_config_json == current_config_json and last_video_model_id == current_video_model_id:
                    logger.debug("视频模型 video_generation_config 未变化，跳过追加")
                    return None

            is_model_changed = bool(last_video_model_id and last_video_model_id != current_video_model_id)
            return VideoModelConfigService.build_video_model_context(
                current_video_model_id or "",
                current_video_generation_config,
                is_model_changed,
            )
        except Exception as e:
            logger.warning(f"处理视频模型配置时出错: {e}")
            return None
