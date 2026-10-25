"""媒体生成 mock Handler 选择测试。"""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from PIL import Image as PILImage

from app.core.config.debug_config import (
    is_mock_image_generation_enabled,
    is_mock_video_generation_enabled,
)
from app.tools.media_generator.base import ImageGenerationRequest
from app.tools.media_generator.handlers.debug_image import DebugImageGeneratorHandler
from app.tools.media_generator.handlers.debug_video import DebugVideoGeneratorHandler
from app.tools.media_generator.handlers.magic_service_video import MagicServiceVideoHandler
from app.tools.media_generator.image_dispatcher import (
    HANDLER_MAGIC_SERVICE as IMAGE_HANDLER_MAGIC_SERVICE,
)
from app.tools.media_generator.image_dispatcher import ImageGeneratorDispatcher
from app.tools.media_generator.video_dispatcher import (
    HANDLER_MAGIC_SERVICE as VIDEO_HANDLER_MAGIC_SERVICE,
)
from app.tools.media_generator.video_dispatcher import VideoGeneratorDispatcher
from app.tools.media_generator.video_base import VideoGenerationRequest


@pytest.fixture(autouse=True)
def clear_handler_caches():
    """隔离不同测试之间的 Handler 缓存。"""
    ImageGeneratorDispatcher._handler_cache.clear()
    VideoGeneratorDispatcher._handler_cache.clear()
    yield
    ImageGeneratorDispatcher._handler_cache.clear()
    VideoGeneratorDispatcher._handler_cache.clear()


def test_image_and_video_mock_flags_are_independent(monkeypatch):
    """图片与视频 mock 环境变量可以独立启用。"""
    monkeypatch.setenv("ENABLE_MOCK_IMAGE_GENERATION", "true")
    monkeypatch.delenv("ENABLE_MOCK_VIDEO_GENERATION", raising=False)

    assert is_mock_image_generation_enabled()
    assert not is_mock_video_generation_enabled()
    assert isinstance(
        ImageGeneratorDispatcher()._build_handler(IMAGE_HANDLER_MAGIC_SERVICE),
        DebugImageGeneratorHandler,
    )

    monkeypatch.delenv("ENABLE_MOCK_IMAGE_GENERATION", raising=False)
    monkeypatch.setenv("ENABLE_MOCK_VIDEO_GENERATION", "true")

    assert not is_mock_image_generation_enabled()
    assert is_mock_video_generation_enabled()
    assert isinstance(
        VideoGeneratorDispatcher()._build_handler(VIDEO_HANDLER_MAGIC_SERVICE),
        DebugVideoGeneratorHandler,
    )


@pytest.mark.asyncio
async def test_debug_image_handler_returns_requested_dimensions(monkeypatch):
    """图片 mock Handler 返回符合请求尺寸的临时图片。"""
    monkeypatch.setenv("ENABLE_MOCK_IMAGE_GENERATION", "true")
    response = await ImageGeneratorDispatcher().generate(
        IMAGE_HANDLER_MAGIC_SERVICE,
        ImageGenerationRequest(
            prompt="模拟图片提示词",
            model="mock-image-model",
            size="640x360",
        ),
    )

    generated_path = Path(response.images[0].temp_file_path)
    try:
        with PILImage.open(generated_path) as image:
            assert image.size == (640, 360)
    finally:
        generated_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_magic_service_video_handler_always_returns_submitted_result(monkeypatch):
    """Magic Service Handler 在本地和线上都只负责提交异步任务。"""
    monkeypatch.setenv("ENABLE_LOCAL_DEBUG_MODE", "true")
    handler = object.__new__(MagicServiceVideoHandler)
    handler._client = SimpleNamespace(
        generate_design_video=AsyncMock(
            return_value={
                "project_id": "project-1",
                "video_id": "video-1",
                "status": "running",
            }
        ),
    )
    request = VideoGenerationRequest(
        payload={"project_id": "project-1", "model_id": "video-model", "file_dir": "/videos"},
        output_path=Path("/tmp/video.mp4"),
        relative_output_path="./videos/video.mp4",
        width=1280,
        height=720,
        duration_seconds=4,
    )

    result = await handler.generate(request)

    assert result.completed is False
    assert result.status == "running"
    assert result.provider_response["video_id"] == "video-1"
