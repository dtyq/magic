# -*- coding: utf-8 -*-
"""图片模型尺寸服务：提取 dynamic_config 中的图片模型配置并同步到 AgentHorizon。"""

import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from agentlang.logger import get_logger
from app.magic.agent import Agent

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
    def build_image_sizes_context(sizes: List[Dict[str, Any]], is_model_changed: bool = False) -> str:
        """构建图片模型尺寸信息的文本格式

        Args:
            sizes: 图片模型可用尺寸列表，格式为 [{"label": "1:1", "value": "1024x1024", "scale": "1K"}, ...]
            is_model_changed: 是否因为模型变动导致尺寸变化

        Returns:
            str: 格式化的尺寸信息文本
        """
        if not sizes:
            return ""

        # 构建尺寸信息文本，使用大模型友好的格式
        if is_model_changed:
            sizes_lines = [
                "[System Note] The image generation model has been switched. The following are the available size options for the current model. This information is only for image generation tool usage. It is only relevant when the user explicitly asks about available sizes or when you need to call the image generation tool. In other conversation scenarios, there is no need to mention this size information.",
                "",
                "Available sizes:"
            ]
        else:
            sizes_lines = [
                "[System Note] The following are the available size options for the current image generation model. This information is only for image generation tool usage. It is only relevant when the user explicitly asks about available sizes or when you need to call the image generation tool. In other conversation scenarios, there is no need to mention this size information.",
                "",
                "Available sizes:"
            ]

        for size_info in sizes:
            label = size_info.get("label", "")
            value = size_info.get("value", "")
            scale = size_info.get("scale", "")

            size_desc = f"- {label} ({value})"
            if scale:
                size_desc += f" - {scale}"

            sizes_lines.append(size_desc)

        return "\n".join(sizes_lines)

    @staticmethod
    def append_image_sizes_to_query(query: str, dynamic_config: Optional[Dict[str, Any]], agent: Agent) -> str:
        """从 dynamic_config 中提取图片模型尺寸信息并追加到 query

        Args:
            query: 原始查询内容
            dynamic_config: 动态配置字典
            agent: Agent 实例，用于获取上次的模型配置

        Returns:
            str: 追加了尺寸信息后的查询内容
        """
        try:
            if not dynamic_config:
                return query

            image_model_config = dynamic_config.get("image_model")
            if not image_model_config or not isinstance(image_model_config, dict):
                return query

            current_image_model_id = image_model_config.get("model_id")
            current_image_sizes = image_model_config.get("sizes")
            if not current_image_sizes or not isinstance(current_image_sizes, list) or len(current_image_sizes) == 0:
                return query

            # 从 agent 的聊天历史中获取上次的会话配置
            last_session_config = agent.chat_history.get_last_session_config()
            last_image_model_sizes = last_session_config.get("image_model_sizes")

            # 判断是否为模型切换
            is_model_changed = False

            # 如果 sizes 未变化，跳过追加
            if last_image_model_sizes:
                # 比较 sizes 是否相同（使用 JSON 序列化比较）
                current_sizes_json = json.dumps(current_image_sizes, sort_keys=True, ensure_ascii=False)
                last_sizes_json = json.dumps(last_image_model_sizes, sort_keys=True, ensure_ascii=False)
                if current_sizes_json == last_sizes_json:
                    logger.debug(f"图片模型 sizes 未变化，跳过追加")
                    return query
                # sizes 有变化，说明模型已切换
                is_model_changed = True

            # 构建 sizes 信息的文本格式并追加到 query 中
            sizes_text = ImageModelSizesService.build_image_sizes_context(current_image_sizes, is_model_changed)
            return f"{query}\n\n---\n\n{sizes_text}"

        except Exception as e:
            logger.warning(f"处理图片模型尺寸配置时出错: {e}")
            # 失败不影响聊天主流程，返回原始 query
            return query
