from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.core.models.media_model import ImageModelSpec, JsonObject, VideoModelSpec


@dataclass(frozen=True)
class AgentModelSelection:
    """一次模型选择后的确定结果。

    这是 `ModelSelectionPolicy` 和 `AgentModelContext` 之间共享的纯数据结构。
    它只描述最终选中的文本、图片、视频模型，不读取配置，也不持有运行时缓存。
    """

    configured_text_model_id: str
    text_model_id: str
    image_model: ImageModelSpec = field(default_factory=ImageModelSpec.empty)
    video_model: VideoModelSpec = field(default_factory=VideoModelSpec.empty)

    @property
    def image_model_id(self) -> Optional[str]:
        """返回最终选中的图片模型 ID。"""
        return self.image_model.model_id

    @property
    def image_model_sizes(self) -> Optional[list[dict[str, str]]]:
        """返回最终图片模型可用尺寸的序列化结果。"""
        return self.image_model.sizes_payload()

    @property
    def video_model_id(self) -> Optional[str]:
        """返回最终选中的视频模型 ID。"""
        return self.video_model.model_id

    @property
    def video_generation_config(self) -> Optional[JsonObject]:
        """返回最终视频模型的生成能力配置。"""
        return self.video_model.video_generation_config
