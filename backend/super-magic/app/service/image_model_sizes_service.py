# -*- coding: utf-8 -*-
"""图片模型尺寸服务：提取 dynamic_config 中的图片模型配置并同步到 AgentHorizon。"""

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from agentlang.logger import get_logger

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_logger(__name__)


class ImageModelSizesService:
    """图片模型尺寸服务。"""

    @staticmethod
    async def sync_to_horizon(dynamic_config: Optional[Dict[str, Any]], horizon: "AgentHorizon") -> None:
        """从 dynamic_config 中提取图片模型配置并同步到 horizon（内部判断是否变化）。"""
        try:
            if not dynamic_config:
                return
            image_model_config = dynamic_config.get("image_model")
            if not image_model_config or not isinstance(image_model_config, dict):
                return
            model_id = image_model_config.get("model_id", "")
            sizes = image_model_config.get("sizes", [])
            if model_id and sizes:
                await horizon.update_image_model(model_id, sizes)
        except Exception as e:
            logger.warning(f"[ImageModelSizesService] sync_to_horizon 失败: {e}")

    @staticmethod
    def build_image_model_info(model_id: str, sizes: List[Dict[str, Any]], changed: bool = False) -> str:
        """构建紧凑图片模型信息，供 horizon 注入。"""
        if not model_id or not sizes:
            return ""

        grouped_sizes: dict[str, list[str]] = {}
        for size_info in sizes:
            if not isinstance(size_info, dict):
                continue

            label = size_info.get("label")
            value = size_info.get("value")
            if not isinstance(label, str) or not label.strip() or not isinstance(value, str) or not value.strip():
                continue

            scale = size_info.get("scale")
            size_value = value.strip()
            if isinstance(scale, str) and scale.strip():
                size_value = f"{scale.strip()}={size_value}"

            # 这里保留显式键值格式，而不是依赖 1K/2K/4K 的全局顺序。
            # 这样后续即使某个比例缺级别或级别命名不一致，LLM 仍能稳妥读取。
            grouped_sizes.setdefault(label.strip(), []).append(size_value)

        if not grouped_sizes:
            return ""

        sizes_attr = ";".join(
            f"{ratio}[{','.join(entries)}]"
            for ratio, entries in grouped_sizes.items()
        )
        changed_attr = "true" if changed else "false"
        return f'  <image model="{model_id}" changed="{changed_attr}" sizes="{sizes_attr}"/>'
