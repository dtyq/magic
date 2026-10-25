"""图片生成调度器

调用方通过 handler_name 显式指定使用哪个驱动，dispatcher 负责构造并委托。
新增驱动只需在 _build_handler 中加分支即可，上层调用方传对应 handler_name 即可切换。
后续视频/音频生成各自有独立的 video_dispatcher.py、audio_dispatcher.py。
"""

from typing import Dict, Optional

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.core.config.debug_config import is_mock_image_generation_enabled
from app.tools.media_generator.base import (
    BaseImageGeneratorHandler,
    ImageGenerationRequest,
    ImageGenerationResponse,
    ImageTaskCreatedCallback,
)

logger = get_logger(__name__)

# 已注册的 handler 名称常量
HANDLER_MAGIC_SERVICE = "magic_service"
HANDLER_DEBUG = "debug"


class ImageGeneratorDispatcher:
    """图片生成调度器，由调用方指定 handler_name 决定使用哪个驱动"""

    # 类级别缓存，进程内复用同一 handler 实例
    _handler_cache: Dict[str, BaseImageGeneratorHandler] = {}

    def _build_handler(self, handler_name: str) -> BaseImageGeneratorHandler:
        """根据配置选择并构造图片生成 Handler，已加载的实例直接复用。"""
        selected_handler_name = HANDLER_DEBUG if is_mock_image_generation_enabled() else handler_name
        if selected_handler_name in self._handler_cache:
            return self._handler_cache[selected_handler_name]

        match selected_handler_name:
            case "debug":
                from app.tools.media_generator.handlers.debug_image import (
                    DebugImageGeneratorHandler,
                )

                handler = DebugImageGeneratorHandler()
            case "magic_service":
                from app.tools.media_generator.handlers.magic_service import MagicServiceHandler

                api_base_url = config.get("image_generator.text_to_image_api_base_url")
                access_key = config.get("image_generator.text_to_image_access_key")
                if not api_base_url or not access_key:
                    raise ValueError(
                        f"Handler '{selected_handler_name}' is not configured. "
                        "Check image_generator.text_to_image_api_base_url and "
                        "image_generator.text_to_image_access_key in config."
                    )
                handler = MagicServiceHandler(api_base_url=api_base_url, access_key=access_key)
            case _:
                raise ValueError(f"Unknown image generation handler: '{selected_handler_name}'")

        if not handler.is_available():
            raise ValueError(f"Image generation handler is unavailable: '{selected_handler_name}'")

        self._handler_cache[selected_handler_name] = handler
        logger.info(f"图片生成 Handler [{selected_handler_name}] 已加载并缓存")
        return handler

    def is_available(self, handler_name: str) -> bool:
        """检查指定驱动是否可用"""
        try:
            self._build_handler(handler_name)
            return True
        except Exception:
            return False

    async def generate(
        self,
        handler_name: str,
        request: ImageGenerationRequest,
        on_task_created: Optional[ImageTaskCreatedCallback] = None,
    ) -> ImageGenerationResponse:
        """使用指定驱动执行图片生成"""
        handler = self._build_handler(handler_name)
        logger.info(
            f"使用驱动 [{handler.name}] 生成图片, model={request.model}, size={request.size}"
        )
        return await handler.generate(request, on_task_created)
