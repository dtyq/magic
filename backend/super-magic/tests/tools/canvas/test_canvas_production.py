"""Canvas 内容产出能力的 mock 测试。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.canvas.application.commands import GenerationParameters, RetryContentCommand
from app.tools.canvas.domain.content_fields import VideoContentFields, VideoEditContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasConnection, CanvasContent, CanvasElement, ElementProperties
from app.tools.canvas.production.adapters import (
    FakeAssetDownloadPort,
    FakeImageSearchPort,
    FakeMediaProbePort,
    FakeVideoCompositionPort,
    FfmpegVideoCompositionPort,
)
from app.tools.canvas.production.adapters import ffmpeg_video_composition_port as ffmpeg_port_module
from app.tools.canvas.production.adapters.generic_video_point_estimate_port import GenericVideoPointEstimatePort
from app.tools.canvas.production.contracts import ImageSearchTask, VideoPointEstimateItem
from app.tools.canvas.production.estimation.video_production_request_normalizer import VideoProductionRequestNormalizer
from app.tools.canvas.production.ports import ImageSearchCandidate, VideoCompositionRequest
from app.tools.canvas.production.services.video_composition_service import VideoCompositionService
from app.tools.canvas.repository import CanvasRepository
from app.tools.generate_video import GenerateVideo
from app.utils.async_file_utils import async_mkdir, async_write_bytes
from tests.tools.canvas.helpers import create_test_application


@pytest.mark.asyncio
async def test_generic_video_point_estimate_calls_magic_service_endpoint_directly(tmp_path, monkeypatch) -> None:
    """积分预估直接调用 Magic Service，不经过生成工具的 execute_purely。"""
    request = VideoProductionRequestNormalizer().normalize(
        "mock-project",
        "shot-1",
        GenerationParameters(
            prompt="mock video",
            model_id="mock-model",
            input_mode="video_edit",
            task="edit",
        ),
    )
    calls: dict[str, object] = {}

    async def build_payload(self, tool_context, params):
        """返回测试用的视频预估请求体。"""
        calls["params"] = params
        return {"model_id": "mock-model", "prompt": "mock video"}

    async def estimate_video_points(self, payload, request_id=""):
        """返回测试用的积分结果。"""
        calls["payload"] = payload
        calls["request_id"] = request_id
        return {"points": 12}

    async def execute_purely(*args, **kwargs):
        """如果错误调用生成工具，测试应立即失败。"""
        raise AssertionError("point estimation must not call execute_purely")

    monkeypatch.setattr(GenerateVideo, "_build_payload", build_payload)
    monkeypatch.setattr(GenerateVideo, "execute_purely", execute_purely)
    monkeypatch.setattr(MagicServiceClient, "estimate_video_points", estimate_video_points)

    points = await GenericVideoPointEstimatePort(tmp_path).estimate_points(request, None)

    assert points == 12
    assert calls["payload"] == {"model_id": "mock-model", "prompt": "mock video"}
    assert calls["params"].input_mode == "video_edit"
    assert calls["params"].task == "edit"
    assert isinstance(calls["request_id"], str) and calls["request_id"]


@pytest.mark.asyncio
async def test_video_point_estimate_has_no_canvas_side_effect(tmp_path, monkeypatch) -> None:
    """视频积分预估只保存凭证，不新增 Element、Content 或生成任务。"""
    monkeypatch.setenv("CANVAS_FAKE_GENERATION", "1")
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository)
    await application.initialize("mock-project")

    result = await application.estimate_content_points(
        "mock-project",
        "video_generation",
        [VideoPointEstimateItem("shot-1", GenerationParameters(prompt="mock video", duration_seconds=4))],
    )

    assert result["can_continue"] is True
    assert result["total_points"] == 10
    assert result["estimate_id"]
    assert (await application.overview("mock-project", 1, 50))["total_elements"] == 0


@pytest.mark.asyncio
async def test_canvas_fake_video_estimate_skips_magic_service_and_uses_configured_points(tmp_path, monkeypatch) -> None:
    """独立 fake 估算开关只替换积分端口，并使用配置的模拟积分。"""
    monkeypatch.delenv("CANVAS_FAKE_GENERATION", raising=False)
    monkeypatch.setenv("CANVAS_FAKE_VIDEO_ESTIMATE", "1")
    monkeypatch.setenv("CANVAS_FAKE_VIDEO_ESTIMATE_POINTS", "12.5")

    async def estimate_design_video_points(self, payload):
        """如果 fake 端口错误访问 Magic Service，测试应失败。"""
        raise AssertionError("fake video estimate must not call Magic Service")

    monkeypatch.setattr(MagicServiceClient, "estimate_design_video_points", estimate_design_video_points)
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository)
    await application.initialize("mock-project")

    result = await application.estimate_content_points(
        "mock-project",
        "video_generation",
        [VideoPointEstimateItem("shot-1", GenerationParameters(prompt="mock video", duration_seconds=4))],
    )

    assert result["can_continue"] is True
    assert result["total_points"] == 12.5
    assert result["estimate_id"]


@pytest.mark.asyncio
async def test_image_search_imports_only_downloaded_and_probed_candidates(tmp_path) -> None:
    """图片搜索只物化下载和媒体探测成功的候选，并按主题去重。"""
    repository = CanvasRepository(tmp_path)
    search = FakeImageSearchPort([
        ImageSearchCandidate("https://mock.invalid/a.png", "A", 800, 600),
        ImageSearchCandidate("https://mock.invalid/a.png", "A duplicate", 800, 600),
    ])
    application = create_test_application(
        repository,
        image_search_port=search,
        asset_download_port=FakeAssetDownloadPort(),
        media_probe_port=FakeMediaProbePort(),
    )
    await application.initialize("mock-project")

    first = await application.search_images(
        "mock-project",
        "topic-1",
        [ImageSearchTask("images", "hero", "product", expected_aspect_ratio="4:3", count=3)],
    )
    second = await application.search_images(
        "mock-project",
        "topic-1",
        [ImageSearchTask("images-again", "hero", "product", expected_aspect_ratio="4:3", count=3)],
    )

    assert first["items"][0]["imported_count"] == 1
    assert second["items"][0]["status"] == "failed"
    assert (await application.overview("mock-project", 1, 50))["total_elements"] == 1


@pytest.mark.asyncio
async def test_add_elements_composes_from_element_sequences_and_declared_connections(tmp_path) -> None:
    """最终视频按 Element 顺序解析媒体，并保留调用方声明的 Canvas 关系。"""
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository, video_composition_port=FakeVideoCompositionPort())
    await application.initialize("mock-project")
    await async_mkdir(tmp_path / "mock-project" / "videos", parents=True, exist_ok=True)
    await async_write_bytes(tmp_path / "mock-project" / "videos" / "one.mp4", b"mock")
    await async_write_bytes(tmp_path / "mock-project" / "videos" / "two.mp4", b"mock")

    def seed(project):
        """写入最小的 mock 合成图。"""
        video_1 = CanvasElement("video-1", "video", ElementProperties(x=0, y=0, width=720, height=1280), [CanvasContent("video-1-content", VideoContentFields(src="./videos/one.mp4", status="completed"))], "video-1-content", "video-1-content")
        video_2 = CanvasElement("video-2", "video", ElementProperties(x=800, y=0, width=720, height=1280), [CanvasContent("video-2-content", VideoContentFields(src="./videos/two.mp4", status="completed"))], "video-2-content", "video-2-content")
        project.canvas.elements.extend([video_1, video_2])

    await repository.transaction("mock-project", seed)
    result = await application._application.add_elements("mock-project", [{
        "item_ref": "final-video",
        "element_type": "video",
        "name": "final",
        "layout": {"strategy": "dependency_flow"},
        "content": {
            "source": "generated",
            "content_type": "video",
            "task": "compose",
            "composition": {
                "videoSequence": ["video-1", "video-2"],
                "audioSequence": [],
            },
            "output": {"format": "mp4", "aspectRatio": "16:9", "resolution": "720p"},
        },
        "connections": [
            {"source_element_id": "video-1"},
            {"source_element_id": "video-2"},
        ],
    }])

    assert result["items"][0]["status"] == "completed"
    final_element_id = result["items"][0]["element_id"]
    details = await application.elements("mock-project", [final_element_id])
    final = details["elements"][0]
    main_content = next(item for item in final["contents"] if item["content_id"] == final["main_content_id"])
    assert main_content["status"] == "completed"
    assert main_content["asset_path"] == "./videos/final.mp4"
    assert main_content["runtime"]["composition"]["videoSequence"] == ["video-1", "video-2"]
    assert main_content["runtime"]["composition"]["resolvedVideos"] == ["./videos/one.mp4", "./videos/two.mp4"]
    assert any(item["source_element_id"] == "video-1" and item["target_element_id"] == final_element_id for item in details["connections"])
    assert any(item["source_element_id"] == "video-2" and item["target_element_id"] == final_element_id for item in details["connections"])


@pytest.mark.asyncio
async def test_composition_connected_from_video_edit_rejects_direct_media_connections(tmp_path) -> None:
    """最终视频连接 Video Edit 时不得重复连接其原始媒体。"""
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository, video_composition_port=FakeVideoCompositionPort())
    await application.initialize("mock-project")
    await async_mkdir(tmp_path / "mock-project" / "videos", parents=True, exist_ok=True)
    await async_write_bytes(tmp_path / "mock-project" / "videos" / "one.mp4", b"mock")
    await async_write_bytes(tmp_path / "mock-project" / "videos" / "two.mp4", b"mock")

    def seed(project):
        """写入视频和可复用 Video Edit。"""
        video_1 = CanvasElement("video-1", "video", ElementProperties(width=720, height=1280), [CanvasContent("video-1-content", VideoContentFields(src="./videos/one.mp4", status="completed"))], "video-1-content", "video-1-content")
        video_2 = CanvasElement("video-2", "video", ElementProperties(width=720, height=1280), [CanvasContent("video-2-content", VideoContentFields(src="./videos/two.mp4", status="completed"))], "video-2-content", "video-2-content")
        edit = CanvasElement("video-edit", "video-edit", ElementProperties(width=520, height=360), [CanvasContent("edit-content", VideoEditContentFields(video_sequence=["video-1", "video-2"]))], "edit-content", "edit-content")
        project.canvas.elements.extend([video_1, video_2, edit])
        project.canvas.connections.extend([
            CanvasConnection("c1", "video-1", "video-edit"),
            CanvasConnection("c2", "video-2", "video-edit"),
        ])

    await repository.transaction("mock-project", seed)
    with pytest.raises(CanvasDomainError, match="only direct predecessor"):
        await application._application.add_elements("mock-project", [{
            "item_ref": "final-video",
            "element_type": "video",
            "name": "final",
            "content": {
                "source": "generated",
                "content_type": "video",
                "task": "compose",
                "composition": {"videoSequence": ["video-1", "video-2"], "audioSequence": []},
                "output": {"format": "mp4", "aspectRatio": "16:9", "resolution": "720p"},
            },
            "connections": [
                {"source_element_id": "video-edit"},
                {"source_element_id": "video-1"},
            ],
        }])


@pytest.mark.asyncio
async def test_composition_input_failure_marks_created_content_failed(tmp_path) -> None:
    """合成输入解析失败时，已创建的结果 Content 也必须落为 failed。"""
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository, video_composition_port=FakeVideoCompositionPort())
    await application.initialize("mock-project")

    def seed(project):
        """写入带非法比例的 mock 合成图。"""
        video = CanvasElement(
            "video-1",
            "video",
            ElementProperties(x=0, y=0, width=720, height=1280),
            [CanvasContent("video-content", VideoContentFields(src="./videos/one.mp4", status="completed"))],
            "video-content",
            "video-content",
        )
        project.canvas.elements.append(video)

    await repository.transaction("mock-project", seed)
    result = await application._application.add_elements("mock-project", [{
        "item_ref": "final-video",
        "element_type": "video",
        "name": "final",
        "layout": {"strategy": "dependency_flow"},
        "content": {
            "source": "generated",
            "content_type": "video",
            "task": "compose",
            "composition": {"videoSequence": ["video-1"], "audioSequence": []},
            "output": {"format": "mp4", "aspectRatio": "invalid", "resolution": "768p"},
        },
    }])

    assert result["items"][0]["status"] == "failed"
    final_element_id = result["items"][0]["element_id"]
    details = await application.elements("mock-project", [final_element_id])
    final_content = details["elements"][0]["contents"][0]
    assert final_content["status"] == "failed"
    assert "Invalid output aspect ratio" in final_content["error_message"]


@pytest.mark.asyncio
async def test_composition_retry_reuses_snapshot_without_video_edit_dependency(tmp_path) -> None:
    """最终视频合成重试复用原请求快照，不读取或创建 Video Edit。"""
    repository = CanvasRepository(tmp_path)
    application = create_test_application(repository, video_composition_port=FakeVideoCompositionPort())
    await application.initialize("mock-project")
    await async_mkdir(tmp_path / "mock-project" / "videos", parents=True, exist_ok=True)
    def seed(project):
        """写入没有物化媒体文件的 mock 合成项目。"""
        video = CanvasElement(
            "video-1",
            "video",
            ElementProperties(width=720, height=1280),
            [CanvasContent("video-content", VideoContentFields(src="./videos/one.mp4", status="completed"))],
            "video-content",
            "video-content",
        )
        project.canvas.elements.append(video)

    await repository.transaction("mock-project", seed)
    initial = await application._application.add_elements("mock-project", [{
        "item_ref": "final-video",
        "element_type": "video",
        "name": "final",
        "content": {
            "source": "generated",
            "content_type": "video",
            "task": "compose",
            "composition": {"videoSequence": ["video-1"], "audioSequence": []},
            "output": {"format": "mp4", "aspectRatio": "16:9", "resolution": "768p"},
        },
    }])
    element_id = initial["items"][0]["element_id"]
    content_id = initial["items"][0]["content_id"]
    assert initial["items"][0]["status"] == "failed"

    await async_write_bytes(tmp_path / "mock-project" / "videos" / "one.mp4", b"mock")
    retried = await application._application._application.retry_content(
        "mock-project",
        [RetryContentCommand(
            item_ref="final-video",
            element_id=element_id,
            content_id=content_id,
        )],
    )

    assert retried["items"][0]["status"] == "completed"
    assert retried["items"][0]["element_id"] == element_id
    assert retried["items"][0]["content_id"] == content_id
    assert (await application.overview("mock-project", 1, 50))["total_elements"] == 2


def test_ffmpeg_command_preserves_source_audio_and_fills_silent_segments() -> None:
    """无外部音频时，FFmpeg 命令保留原音并为无音轨片段补静音。"""
    port = FfmpegVideoCompositionPort()
    request = VideoCompositionRequest(
        video_paths=(Path("one.mp4"), Path("two.mp4")),
        audio_path=None,
        output_path=Path("final.mp4"),
        width=1920,
        height=1080,
    )
    command = port._build_command(request, [
        type("Media", (), {"has_audio": True, "duration_seconds": 2.0})(),
        type("Media", (), {"has_audio": False, "duration_seconds": 3.0})(),
    ])
    rendered = " ".join(command)
    assert "anullsrc" in rendered
    assert "concat=n=2:v=1:a=1" in rendered
    assert "-map [aout]" in rendered


def test_video_composition_accepts_numeric_short_side_resolution() -> None:
    """Canvas 视频合成应接受非预设的数字短边分辨率。"""
    assert VideoCompositionService._resolve_dimensions("16:9", "768p") == (1366, 768)


def test_video_composition_prefers_explicit_dimensions() -> None:
    """Canvas 视频合成应优先使用明确的输出宽高。"""
    assert VideoCompositionService._resolve_dimensions("16:9", "720p", 1344, 768) == (1344, 768)


def test_ffmpeg_command_mutes_all_audio_sources() -> None:
    """静音策略必须生成无音频流的 FFmpeg 命令。"""
    port = FfmpegVideoCompositionPort()
    request = VideoCompositionRequest(
        video_paths=(Path("one.mp4"), Path("two.mp4")),
        audio_path=Path("music.mp3"),
        output_path=Path("final.mp4"),
        width=1920,
        height=1080,
        audio_policy="mute",
    )
    command = port._build_command(request)
    rendered = " ".join(command)
    assert "-an" in command
    assert "-map 2:a:0" not in rendered


@pytest.mark.asyncio
async def test_ffmpeg_output_writes_directly_to_final_path(tmp_path: Path) -> None:
    """合成输出不应在目标目录创建 MagicFS 不兼容的中间文件。"""
    source = tmp_path / "composition.mp4"
    target = tmp_path / "workspace" / "final.mp4"
    await async_write_bytes(source, b"mock-composed-video")

    await FfmpegVideoCompositionPort._move_output(source, target)

    assert target.read_bytes() == b"mock-composed-video"
    assert not list(target.parent.glob(".*.part-*"))


@pytest.mark.asyncio
async def test_ffmpeg_output_cleans_partial_target_after_copy_failure(tmp_path: Path, monkeypatch) -> None:
    """最终文件写入失败时应清理不完整目标，避免留下半个 MP4。"""
    source = tmp_path / "composition.mp4"
    target = tmp_path / "workspace" / "final.mp4"
    await async_write_bytes(source, b"mock-composed-video")

    async def fail_copy(_source, destination):
        """模拟 MagicFS 在写入过程中返回 I/O 错误。"""
        await async_mkdir(destination.parent, parents=True, exist_ok=True)
        await async_write_bytes(destination, b"partial")
        raise OSError(5, "Input/output error")

    monkeypatch.setattr(ffmpeg_port_module, "async_copy_contents", fail_copy)

    with pytest.raises(OSError, match="Input/output error"):
        await FfmpegVideoCompositionPort._move_output(source, target)

    assert not target.exists()
