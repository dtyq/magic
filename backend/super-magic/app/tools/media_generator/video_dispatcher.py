"""视频生成调度器。"""

from typing import Dict

from agentlang.logger import get_logger
from app.core.config.debug_config import is_mock_video_generation_enabled
from app.tools.media_generator.video_base import (
    BaseVideoGeneratorHandler,
    VideoGenerationRequest,
    VideoGenerationResponse,
)

logger = get_logger(__name__)

HANDLER_MAGIC_SERVICE = "magic_service"
HANDLER_DEBUG = "debug"


class VideoGeneratorDispatcher:
    """根据配置选择并调用视频生成 Handler。"""

    _handler_cache: Dict[str, BaseVideoGeneratorHandler] = {}

    def _build_handler(self, handler_name: str) -> BaseVideoGeneratorHandler:
        """根据配置选择并构造视频生成 Handler，已加载的实例直接复用。"""
        selected_handler_name = HANDLER_DEBUG if is_mock_video_generation_enabled() else handler_name
        if selected_handler_name in self._handler_cache:
            return self._handler_cache[selected_handler_name]

        match selected_handler_name:
            case "debug":
                from app.tools.media_generator.handlers.debug_video import (
                    DebugVideoGeneratorHandler,
                )

                handler = DebugVideoGeneratorHandler()
            case "magic_service":
                from app.tools.media_generator.handlers.magic_service_video import (
                    MagicServiceVideoHandler,
                )

                handler = MagicServiceVideoHandler()
            case _:
                raise ValueError(f"Unknown video generation handler: '{selected_handler_name}'")

        if not handler.is_available():
            raise ValueError(f"Video generation handler is unavailable: '{selected_handler_name}'")
        self._handler_cache[selected_handler_name] = handler
        logger.info(f"视频生成 Handler [{selected_handler_name}] 已加载并缓存")
        return handler

    def is_available(self, handler_name: str) -> bool:
        """检查指定视频生成 Handler 是否可用。"""
        try:
            self._build_handler(handler_name)
            return True
        except Exception:
            return False

    async def generate(
        self,
        handler_name: str,
        request: VideoGenerationRequest,
    ) -> VideoGenerationResponse:
        """通过当前 Handler 执行视频生成。"""
        handler = self._build_handler(handler_name)
        logger.info(f"使用 Handler [{handler.name}] 生成视频")
        return await handler.generate(request)
