"""Canvas 旧 Design 视频适配器的 mock 测试。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.generation.adapters.design_video_generation_port import DesignVideoGenerationPort
from app.tools.canvas.generation.adapters.design_video_payload_builder import DesignVideoPayloadBuilder
from app.tools.canvas.generation.capability.default_capability_factory import default_generation_capabilities
from app.tools.canvas.generation.contracts.generation_query_request import GenerationQueryRequest
from app.tools.canvas.generation.contracts.generation_request import GenerationRequest
from app.tools.canvas.production.adapters.design_video_point_estimate_port import DesignVideoPointEstimatePort
from app.tools.canvas.production.contracts import NormalizedVideoProductionRequest
from app.tools.canvas.repository import CanvasRepository
from app.tools.video_generation_utils.video_input_utils import VideoInputPayloadBuilder


class _ToolContext:
    """提供测试所需项目元数据的最小工具上下文。"""

    def get_metadata(self, key: str) -> str:
        """返回 mock 项目 ID。"""
        return "magic-project-1" if key == "project_id" else ""

    def get_extension(self, _key: str):
        """测试中不提供额外 Agent 扩展。"""
        return None


def test_design_video_payload_maps_canvas_parameters_and_provider_uri(tmp_path: Path) -> None:
    """请求体应符合旧 Design API，并原样保留 provider 资产 URI。"""
    payload = DesignVideoPayloadBuilder(tmp_path).build(
        "mock-project",
        GenerationParameters(
            prompt="animate [image1]",
            model_id="veo-3.1",
            reference_image_paths=("./images/source.png", "asset://provider/image-1"),
            frame_start_path="./images/start.png",
            duration_seconds=4,
            aspect_ratio="16:9",
            resolution="720p",
            fps=24,
            seed=7,
            watermark=False,
            audio_policy="mute",
        ),
        "vid-1",
        "/mock-project/videos/",
        _ToolContext(),
    )

    assert payload["project_id"] == "magic-project-1"
    assert payload["video_id"] == "vid-1"
    assert payload["file_dir"] == "/mock-project/videos/"
    assert payload["inputs"]["reference_images"] == [
        {"uri": "/mock-project/images/source.png"},
        {"uri": "asset://provider/image-1"},
    ]
    assert payload["inputs"]["frames"] == [{"role": "start", "uri": "/mock-project/images/start.png"}]
    assert payload["generation"] == {
        "aspect_ratio": "16:9",
        "duration_seconds": 4,
        "resolution": "720p",
        "fps": 24,
        "seed": 7,
        "watermark": False,
        "generate_audio": False,
    }


def test_design_video_payload_treats_shot_image_as_omni_reference(tmp_path: Path) -> None:
    """精细模式的镜头图片是全能模式参考图，不是起始帧。"""
    payload = DesignVideoPayloadBuilder(tmp_path).build(
        "mock-project",
        GenerationParameters(
            prompt="animate the shot reference [image1]",
            model_id="video-model",
            reference_image_paths=("./images/shot-reference.png",),
        ),
        "vid-shot-1",
        "/mock-project/videos/",
        _ToolContext(),
    )

    assert payload["input_mode"] == "omni_reference"
    assert payload["inputs"]["reference_images"] == [
        {"uri": "/mock-project/images/shot-reference.png"}
    ]
    assert payload["inputs"]["frames"] == []


def test_design_video_payload_normalizes_provider_uri_with_leading_slash(tmp_path: Path) -> None:
    """Canvas Design 请求应去掉 provider URI 误加的前导斜杠。"""
    payload = DesignVideoPayloadBuilder(tmp_path).build(
        "mock-project",
        GenerationParameters(
            prompt="animate [image1]",
            model_id="video-model",
            reference_images=("/asset://asset-20260401123823-6d4x2",),
        ),
        "",
        "",
        _ToolContext(),
    )

    assert payload["inputs"]["reference_images"] == [
        {"uri": "asset://asset-20260401123823-6d4x2"}
    ]


def test_default_canvas_video_capability_uses_design_adapter(tmp_path: Path, monkeypatch) -> None:
    """非 fake 模式的默认视频能力应注册 Design API 适配器。"""
    monkeypatch.delenv("CANVAS_FAKE_GENERATION", raising=False)
    capabilities = default_generation_capabilities(tmp_path)

    video = next(capability for capability in capabilities if capability.element_type == "video")
    assert isinstance(video.submission_port, DesignVideoGenerationPort)


@pytest.mark.asyncio
async def test_canvas_video_transport_keeps_workspace_paths_when_base64_is_disabled(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """关闭开关时应原样提交工作区路径。"""
    monkeypatch.setattr(VideoInputPayloadBuilder, "enabled", property(lambda _self: False))
    port = DesignVideoGenerationPort(tmp_path)
    payload = {
        "inputs": {
            "reference_images": [{"uri": "/mock-project/images/source.png"}],
            "reference_videos": [{"uri": "/mock-project/videos/source.mp4"}],
            "frames": [{"role": "start", "uri": "/mock-project/images/start.png"}],
        }
    }

    transport_payload = await port._build_transport_payload(
        payload,
        "mock-project",
        GenerationParameters(
            reference_image_paths=("./images/source.png",),
            frame_start_path="./images/start.png",
        ),
    )

    assert transport_payload is payload


@pytest.mark.asyncio
async def test_canvas_video_transport_converts_images_to_base64_when_enabled(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """开启开关时仅转换参考图片和首尾帧，并保留持久化路径请求。"""
    converted_paths: list[str] = []

    async def build_image_input(_self, source_path: str) -> dict[str, str]:
        """返回 mock Base64 输入并记录转换路径。"""
        converted_paths.append(source_path)
        return {
            "source_type": "base64",
            "base64_data": f"mock-{Path(source_path).name}",
            "mime_type": "image/png",
        }

    monkeypatch.setattr(VideoInputPayloadBuilder, "enabled", property(lambda _self: True))
    monkeypatch.setattr(VideoInputPayloadBuilder, "build_image_input", build_image_input)
    port = DesignVideoGenerationPort(tmp_path)
    persisted_payload = {
        "inputs": {
            "reference_images": [{"uri": "/mock-project/images/source.png"}],
            "reference_videos": [{"uri": "/mock-project/videos/source.mp4"}],
            "reference_audios": [{"uri": "/mock-project/audios/source.wav"}],
            "frames": [{"role": "start", "uri": "/mock-project/images/start.png"}],
        }
    }

    transport_payload = await port._build_transport_payload(
        persisted_payload,
        "mock-project",
        GenerationParameters(
            reference_image_paths=("./images/source.png",),
            frame_start_path="./images/start.png",
            frame_end_path="./images/end.png",
        ),
    )

    assert converted_paths == [
        "mock-project/images/source.png",
        "mock-project/images/start.png",
        "mock-project/images/end.png",
    ]
    assert transport_payload["inputs"]["reference_images"] == [
        {
            "source_type": "base64",
            "base64_data": "mock-source.png",
            "mime_type": "image/png",
        }
    ]
    assert transport_payload["inputs"]["frames"] == [
        {
            "role": "start",
            "source_type": "base64",
            "base64_data": "mock-start.png",
            "mime_type": "image/png",
        },
        {
            "role": "end",
            "source_type": "base64",
            "base64_data": "mock-end.png",
            "mime_type": "image/png",
        },
    ]
    assert transport_payload["inputs"]["reference_videos"] == persisted_payload["inputs"]["reference_videos"]
    assert transport_payload["inputs"]["reference_audios"] == persisted_payload["inputs"]["reference_audios"]
    assert persisted_payload["inputs"]["reference_images"] == [
        {"uri": "/mock-project/images/source.png"}
    ]


@pytest.mark.asyncio
async def test_canvas_video_transport_normalizes_provider_uri_without_local_file_access(
    tmp_path: Path,
) -> None:
    """Base64 开启时 provider URI 应直接透传，不读取本地文件。"""
    payload = await VideoInputPayloadBuilder(tmp_path).build_image_input(
        "/asset://asset-20260401123823-6d4x2"
    )

    assert payload == {"uri": "asset://asset-20260401123823-6d4x2"}


@pytest.mark.asyncio
async def test_design_video_generation_uses_design_submit_and_query_endpoints(tmp_path: Path, monkeypatch) -> None:
    """本地调试模式提交和查询旧 Design API，完成后下载到 Canvas videos 目录。"""
    monkeypatch.setenv("ENABLE_LOCAL_DEBUG_MODE", "true")
    calls: dict[str, object] = {}

    async def ensure_directories(self, project_id, directory_parts):
        """记录远端项目目录准备调用。"""
        calls.setdefault("directories", []).append((project_id, directory_parts))
        return "mock-directory-id"

    async def generate(self, payload):
        """返回 mock Design 提交结果。"""
        calls["submit"] = payload
        return {
            "status": "processing",
            "video_id": "remote-video-1",
            "billing": {"points": 3},
        }

    async def query(self, project_id, video_id):
        """返回 mock Design 完成结果。"""
        calls["query"] = (project_id, video_id)
        return {
            "status": "completed",
            "file_url": "https://mock.invalid/video.mp4",
            "generation_info": {
                "input_mode": "standard",
                "resolution": "720p",
                "duration_seconds": 5,
            },
            "runtime": {
                "finished_at": "2026-09-02 10:00:05",
                "elapsed_seconds": 5,
            },
        }

    async def download(self, url, target):
        """将 mock 下载结果写入目标文件。"""
        calls["download"] = (url, target)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"mock-video")

    monkeypatch.setattr(MagicServiceClient, "generate_design_video", generate)
    monkeypatch.setattr(MagicServiceClient, "query_video_generation_result", query)
    monkeypatch.setattr(MagicServiceClient, "download_url_to_path", download)
    monkeypatch.setattr(MagicServiceClient, "ensure_project_directories", ensure_directories)

    await CanvasRepository(tmp_path).initialize("mock-project")
    port = DesignVideoGenerationPort(tmp_path)
    submission = await port.submit(
        GenerationRequest(
            project_path="mock-project",
            element_id="element-1",
            content_id="content-1",
            element_type="video",
            parameters=GenerationParameters(prompt="mock", model_id="model-1", name="城市街景"),
        ),
        _ToolContext(),
    )
    output_filename = submission.request_metadata["outputFilename"]
    result = await port.query(
        GenerationQueryRequest("remote-video-1", "mock-project", "element-1", "content-1", output_filename),
        _ToolContext(),
    )

    assert submission.provider_task_id == "remote-video-1"
    assert submission.request_metadata["model_id"] == "model-1"
    assert submission.request_metadata["input_mode"] == "standard"
    assert submission.result_metadata["billing"]["points"] == 3
    assert submission.result_metadata["runtime"]["started_at"]
    assert len(calls["submit"]["video_id"]) == 20
    assert output_filename.startswith("城市街景-vid_")
    assert calls["submit"]["project_id"] == "magic-project-1"
    assert calls["directories"] == [
        ("magic-project-1", ["mock-project", "images"]),
        ("magic-project-1", ["mock-project", "videos"]),
        ("magic-project-1", ["mock-project", "audios"]),
    ]
    assert calls["query"] == ("magic-project-1", "remote-video-1")
    assert result.status == "completed"
    assert result.output_uri == f"./videos/{output_filename}"
    assert result.result_metadata["generation_info"]["input_mode"] == "standard"
    assert result.result_metadata["runtime"]["elapsed_seconds"] == 5


@pytest.mark.asyncio
async def test_design_video_generation_uses_magic_service_workspace_file_without_download(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """部署模式应复用 Magic Service 已归档的工作区文件，不重复下载。"""
    monkeypatch.delenv("ENABLE_LOCAL_DEBUG_MODE", raising=False)
    calls: dict[str, object] = {}

    async def ensure_directories(self, project_id, directory_parts):
        """记录远端项目目录准备调用。"""
        calls.setdefault("directories", []).append((project_id, directory_parts))
        return "mock-directory-id"

    async def generate(self, payload):
        """返回 mock Design 提交结果。"""
        return {"status": "processing", "video_id": "remote-video-2"}

    async def query(self, project_id, video_id):
        """返回 Magic Service 已归档的文件信息。"""
        calls["query"] = (project_id, video_id)
        return {
            "status": "completed",
            "file_dir": "/mock-project/videos/",
            "file_name": "llm-named-video.mp4",
        }

    async def download(self, url, target):
        """记录不应发生的下载调用。"""
        calls["download"] = (url, target)

    monkeypatch.setattr(MagicServiceClient, "generate_design_video", generate)
    monkeypatch.setattr(MagicServiceClient, "query_video_generation_result", query)
    monkeypatch.setattr(MagicServiceClient, "download_url_to_path", download)
    monkeypatch.setattr(MagicServiceClient, "ensure_project_directories", ensure_directories)

    await CanvasRepository(tmp_path).initialize("mock-project")
    port = DesignVideoGenerationPort(tmp_path)
    submission = await port.submit(
        GenerationRequest(
            project_path="mock-project",
            element_id="element-1",
            content_id="content-1",
            element_type="video",
            parameters=GenerationParameters(prompt="mock", model_id="model-1", name="城市街景"),
        ),
        _ToolContext(),
    )
    output_path = tmp_path / "mock-project" / "videos" / "llm-named-video.mp4"
    output_path.write_bytes(b"mock-video")
    result = await port.query(
        GenerationQueryRequest("remote-video-2", "mock-project", "element-1", "content-1", submission.request_metadata["outputFilename"]),
        _ToolContext(),
    )

    assert calls["query"] == ("magic-project-1", "remote-video-2")
    assert "download" not in calls
    assert result.status == "completed"
    assert result.output_uri == "./videos/llm-named-video.mp4"


@pytest.mark.asyncio
async def test_design_video_generation_waits_for_magicfs_output_visibility(
    tmp_path: Path,
    monkeypatch,
) -> None:
    """远端已完成但本地文件尚未可见时，应继续等待而不是提前完成。"""
    monkeypatch.delenv("ENABLE_LOCAL_DEBUG_MODE", raising=False)

    async def query(self, project_id, video_id):
        """返回已完成但本地尚未落盘的 mock 结果。"""
        return {
            "status": "completed",
            "file_dir": "/mock-project/videos/",
            "file_name": "not-visible.mp4",
        }

    monkeypatch.setattr(MagicServiceClient, "query_video_generation_result", query)
    await CanvasRepository(tmp_path).initialize("mock-project")

    result = await DesignVideoGenerationPort(tmp_path).query(
        GenerationQueryRequest("remote-video-3", "mock-project", "element-1", "content-1", "fallback.mp4"),
        _ToolContext(),
    )

    assert result.status == "processing"
    assert result.output_uri is None


@pytest.mark.asyncio
async def test_design_video_point_estimate_uses_design_estimate_endpoint(monkeypatch, tmp_path: Path) -> None:
    """Canvas 视频积分预估必须调用 Design 估算接口。"""
    calls: dict[str, object] = {}

    async def estimate(self, payload):
        """返回 mock Design 积分结果。"""
        calls["payload"] = payload
        return {"points": 9}

    monkeypatch.setattr(MagicServiceClient, "estimate_design_video_points", estimate)
    request = NormalizedVideoProductionRequest(
        "mock-project",
        "item-1",
        GenerationParameters(prompt="mock", model_id="model-1"),
        "fingerprint",
    )

    points = await DesignVideoPointEstimatePort(tmp_path).estimate_points(request, _ToolContext())

    assert points == 9
    assert calls["payload"]["project_id"] == "magic-project-1"
