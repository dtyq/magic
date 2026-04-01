# -*- coding: utf-8 -*-
"""视频模型配置服务：提取 dynamic_config 中的视频模型配置并同步到 AgentHorizon。"""

import json
from typing import TYPE_CHECKING, Any, Dict, Optional

from app.utils.video_logger import get_video_logger

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_video_logger(__name__)


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
    async def sync_to_horizon(dynamic_config: Optional[Dict[str, Any]], horizon: "AgentHorizon") -> None:
        """从 dynamic_config 中提取视频模型配置并同步到 horizon（内部判断是否变化）。"""
        try:
            if not dynamic_config:
                return
            video_model = dynamic_config.get("video_model")
            if not isinstance(video_model, dict):
                return
            model_id = video_model.get("model_id") or ""
            config = video_model.get("video_generation_config")
            if model_id and isinstance(config, dict) and config:
                await horizon.update_video_model(model_id, config)
        except Exception as e:
            logger.warning(f"[VideoModelConfigService] sync_to_horizon 失败: {e}")
