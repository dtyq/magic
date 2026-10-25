"""Canvas 媒体尺寸探测和生成后尺寸回写的 mock 测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.tools.canvas.application.element_sizing_service import CanvasElementSizingService
from app.tools.canvas.domain.content_fields import VideoContentFields
from app.tools.canvas.domain.models import CanvasContent, CanvasElement, ElementProperties
from app.tools.canvas.production.adapters import FakeMediaProbePort, FileMediaProbePort
from app.tools.canvas.production.ports.media_probe_port import VideoMediaInfo


@pytest.mark.asyncio
async def test_generated_video_dimensions_are_read_from_media_probe(tmp_path) -> None:
    """生成视频完成后应使用媒体探测结果，而不是请求默认尺寸。"""
    output = tmp_path / "Demo" / "videos" / "result.mp4"
    output.parent.mkdir(parents=True)
    output.write_bytes(b"mock-video")

    sizing = CanvasElementSizingService(tmp_path, FakeMediaProbePort())

    assert await sizing.inspect_generated_video("Demo", "./videos/result.mp4") == (1920, 1080)


@pytest.mark.asyncio
async def test_generated_video_dimension_probe_failure_returns_fallback_signal(tmp_path) -> None:
    """视频文件不存在时应返回空值，让调用方保留初始布局尺寸。"""
    sizing = CanvasElementSizingService(tmp_path, FakeMediaProbePort())

    assert await sizing.inspect_generated_video("Demo", "./videos/missing.mp4") is None


@pytest.mark.asyncio
async def test_pending_video_dimensions_follow_aspect_ratio_and_resolution(tmp_path) -> None:
    """生成前的视频 Element 应根据比例和分辨率设置初始宽高。"""
    element = CanvasElement(
        "video-1",
        "video",
        ElementProperties(),
        [
            CanvasContent(
                "content-1",
                VideoContentFields(generate_video_request={"aspect_ratio": "9:16", "resolution": "720p"}),
            )
        ],
        "content-1",
        "content-1",
    )
    sizing = CanvasElementSizingService(tmp_path, FakeMediaProbePort())

    await sizing.initialize("Demo", element)

    assert (element.properties.width, element.properties.height) == (720.0, 1280.0)


@pytest.mark.asyncio
async def test_imported_video_dimensions_are_read_from_media_probe(tmp_path) -> None:
    """导入视频初始化时应使用媒体探测结果，而不是默认横屏尺寸。"""
    source = tmp_path / "Demo" / "videos" / "silent-result.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"mock-video")
    element = CanvasElement(
        "video-1",
        "video",
        ElementProperties(),
        [CanvasContent("content-1", VideoContentFields(src="./videos/silent-result.mp4"))],
        "content-1",
        "content-1",
    )
    media_probe = FakeMediaProbePort()
    media_probe.inspect_video = AsyncMock(return_value=VideoMediaInfo(720, 1280, 5.0, False))
    sizing = CanvasElementSizingService(tmp_path, media_probe)

    await sizing.initialize("Demo", element)

    assert (element.properties.width, element.properties.height) == (720, 1280)


def test_file_media_probe_parses_mock_ffprobe_video_metadata() -> None:
    """文件探测适配器应从 FFprobe 结构中提取视频宽高和音频状态。"""
    info = FileMediaProbePort._read_video_info(
        {
            "streams": [
                {"codec_type": "video", "width": 1080, "height": 1920},
                {"codec_type": "audio"},
            ],
            "format": {"duration": "4.5"},
        }
    )

    assert (info.width, info.height) == (1080, 1920)
    assert info.duration_seconds == pytest.approx(4.5)
    assert info.has_audio is True
