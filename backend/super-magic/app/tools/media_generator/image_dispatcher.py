"""图片生成调度器

调用方通过 handler_name 显式指定使用哪个驱动，dispatcher 负责构造并委托。
新增驱动只需在 _build_handler 中加分支即可，上层调用方传对应 handler_name 即可切换。
后续视频/音频生成各自有独立的 video_dispatcher.py、audio_dispatcher.py。
"""

from typing import Dict

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.media_generator.base import (
    BaseImageGeneratorHandler,
    ImageGenerationRequest,
    ImageGenerationResponse,
)

logger = get_logger(__name__)

# 已注册的 handler 名称常量
HANDLER_MAGIC_SERVICE = "magic_service"


class ImageGeneratorDispatcher:
    """图片生成调度器，由调用方指定 handler_name 决定使用哪个驱动"""

    # 类级别缓存，进程内复用同一 handler 实例
    _handler_cache: Dict[str, BaseImageGeneratorHandler] = {}

    def _build_handler(self, handler_name: str) -> BaseImageGeneratorHandler:
        """
        根据 handler_name 返回驱动实例，已加载的直接从缓存取。
        新增驱动在此处加分支，并声明对应的 HANDLER_* 常量。
        """
        if handler_name in self._handler_cache:
            return self._handler_cache[handler_name]

        if handler_name == HANDLER_MAGIC_SERVICE:
            from app.tools.media_generator.handlers.magic_service import MagicServiceHandler

            api_base_url = config.get("image_generator.text_to_image_api_base_url")
            access_key = config.get("image_generator.text_to_image_access_key")
            if not api_base_url or not access_key:
                raise ValueError(
                    f"Handler '{handler_name}' is not configured. "
                    "Check image_generator.text_to_image_api_base_url and "
                    "image_generator.text_to_image_access_key in config."
                )
            handler = MagicServiceHandler(api_base_url=api_base_url, access_key=access_key)
            self._handler_cache[handler_name] = handler
            logger.info(f"图片生成驱动 [{handler_name}] 已加载并缓存")
            return handler

        raise ValueError(f"Unknown image generation handler: '{handler_name}'")

    def is_available(self, handler_name: str) -> bool:
        """检查指定驱动是否可用"""
        try:
            self._build_handler(handler_name)
            return True
        except Exception:
            return False

    async def generate(
        self, handler_name: str, request: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        """使用指定驱动执行图片生成"""
        handler = self._build_handler(handler_name)
        logger.info(
            f"使用驱动 [{handler.name}] 生成图片, model={request.model}, size={request.size}"
        )
        return await handler.generate(request)
