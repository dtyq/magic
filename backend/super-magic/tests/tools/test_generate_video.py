"""测试 GenerateVideo 的 URL 归一化与路径拼接。"""

from unittest.mock import AsyncMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from app.core.entity.tool.tool_result import VideoToolResult
from app.infrastructure.magic_service.config import MagicServiceConfig
from app.tools.design.utils.magic_project_design_parser import read_magic_project_js
from app.tools.generate_video import (
    GenerateVideo,
    GenerateVideoParams,
    QueryVideoGeneration,
    QueryVideoGenerationParams,
)


class _MockResponse:
    def __init__(self, status: int = 200, text: str = '{"id":"op_123","status":"queued"}'):
        self.status = status
        self._text = text

    async def text(self) -> str:
        return self._text

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _MockSession:
    def __init__(self, recorder: list[tuple[str, str, dict | None, dict | None, int | None]], response: _MockResponse | None = None):
        self._recorder = recorder
        self._response = response or _MockResponse()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def request(self, method, url, json=None, headers=None, timeout=None):
        self._recorder.append((method, url, json, headers, timeout))
        return self._response


class _MockDownloadResponse:
    def __init__(self, content: bytes, content_type: str = "video/mp4", status: int = 200):
        self.status = status
        self._content = content
        self.headers = {
            "Content-Type": content_type,
            "Content-Length": str(len(content)),
        }

    async def read(self) -> bytes:
        return self._content

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _MockDownloadSession:
    def __init__(self, content: bytes, content_type: str = "video/mp4", status: int = 200):
        self._response = _MockDownloadResponse(content=content, content_type=content_type, status=status)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def get(self, url, timeout=None):
        return self._response


class _FakeCorrelationManager:
    def __init__(self, correlation_id: str = "corr_123"):
        self._correlation_id = correlation_id

    def get_active_correlation_id(self, _event_pair_type):
        return self._correlation_id


class _FakeAgentContext:
    def __init__(self):
        self.events = []
        self.updated_activity_times = 0

    def update_activity_time(self):
        self.updated_activity_times += 1

    async def dispatch_event(self, event_type, event_data):
        self.events.append((event_type, event_data))


@pytest.fixture
def tool(tmp_path):
    return GenerateVideo(base_dir=tmp_path)


class TestGenerateVideoUrlNormalization:
    def test_normalize_video_api_base_url_keeps_existing_v1(self, tool):
        assert tool._normalize_video_api_base_url("https://api.t.teamshare.cn/magic-service/v1") == "https://api.t.teamshare.cn/magic-service/v1"

    def test_normalize_video_api_base_url_appends_missing_v1(self, tool):
        assert tool._normalize_video_api_base_url("https://api.t.teamshare.cn/magic-service") == "https://api.t.teamshare.cn/magic-service/v1"

    def test_normalize_video_api_base_url_replaces_trailing_v2_with_v1(self, tool):
        assert tool._normalize_video_api_base_url("https://api.t.teamshare.cn/magic-service/v2") == "https://api.t.teamshare.cn/magic-service/v1"

    def test_normalize_video_api_base_url_replaces_trailing_v10_with_v1(self, tool):
        assert tool._normalize_video_api_base_url("https://api.t.teamshare.cn/magic-service/v10/") == "https://api.t.teamshare.cn/magic-service/v1"

    @pytest.mark.asyncio
    async def test_request_json_uses_single_v1_when_magic_service_host_already_contains_v1(self, tool):
        recorded_requests = []

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockSession(recorded_requests)):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v1",
                api_key="access_key",
            )

            await tool._request_json("POST", "/videos", {"prompt": "test"})

        assert recorded_requests[0][1] == "https://api.t.teamshare.cn/magic-service/v1/videos"
        assert "/v1/v1/videos" not in recorded_requests[0][1]

    @pytest.mark.asyncio
    async def test_request_json_appends_v1_when_magic_service_host_does_not_contain_it(self, tool):
        recorded_requests = []

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockSession(recorded_requests)):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service",
                api_key="access_key",
            )

            await tool._request_json("GET", "/videos/op_123")

        assert recorded_requests[0][1] == "https://api.t.teamshare.cn/magic-service/v1/videos/op_123"
        assert "/v1/v1/videos" not in recorded_requests[0][1]

    @pytest.mark.asyncio
    async def test_request_json_replaces_trailing_v2_from_magic_service_host_for_create_request(self, tool):
        recorded_requests = []

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockSession(recorded_requests)):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v2",
                api_key="access_key",
            )

            await tool._request_json("POST", "/videos", {"prompt": "test"})

        assert recorded_requests[0][1] == "https://api.t.teamshare.cn/magic-service/v1/videos"
        assert "/v2/videos" not in recorded_requests[0][1]
        assert "/v2/v1/videos" not in recorded_requests[0][1]

    @pytest.mark.asyncio
    async def test_request_json_replaces_trailing_v2_from_magic_service_host_for_query_request(self, tool):
        recorded_requests = []

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockSession(recorded_requests)):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v2",
                api_key="access_key",
            )

            await tool._request_json("GET", "/videos/op_123")

        assert recorded_requests[0][1] == "https://api.t.teamshare.cn/magic-service/v1/videos/op_123"
        assert "/v2/videos" not in recorded_requests[0][1]
        assert "/v2/v1/videos" not in recorded_requests[0][1]

    @pytest.mark.asyncio
    async def test_request_json_uses_magic_service_loader_instead_of_text_to_image_config(self, tool):
        recorded_requests = []

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockSession(recorded_requests)):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://magic-service.t.teamshare.cn/",
                api_key="magic_service_key",
            )

            await tool._request_json("POST", "/videos", {"prompt": "test"})

        mock_load_config.assert_called_once_with()
        assert recorded_requests[0][1] == "https://magic-service.t.teamshare.cn/v1/videos"

    @pytest.mark.asyncio
    async def test_request_json_raises_magic_service_business_error_message(self, tool):
        recorded_requests = []
        business_error_response = _MockResponse(
            status=200,
            text='{"code":400123,"message":"provider says duration_seconds=9 is invalid","data":{},"error":[]}',
        )

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch(
                 "app.tools.generate_video.aiohttp.ClientSession",
                 return_value=_MockSession(recorded_requests, response=business_error_response),
             ):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v1",
                api_key="access_key",
            )

            with pytest.raises(ValueError, match="provider says duration_seconds=9 is invalid"):
                await tool._request_json("POST", "/videos", {"prompt": "test"})

    @pytest.mark.asyncio
    async def test_request_json_raises_nested_magic_service_error_message_for_non_200(self, tool):
        recorded_requests = []
        business_error_response = _MockResponse(
            status=400,
            text=(
                '{"error":{"message":"ResourceAccessException happened, please retry later.",'
                '"code":4018,"request_id":"req_123","support_url":"https://www.letsmagic.cn"}}'
            ),
        )

        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch(
                 "app.tools.generate_video.aiohttp.ClientSession",
                 return_value=_MockSession(recorded_requests, response=business_error_response),
             ):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v1",
                api_key="access_key",
            )

            with pytest.raises(
                ValueError,
                match=r"ResourceAccessException happened, please retry later\.",
            ) as exc_info:
                await tool._request_json("POST", "/videos", {"prompt": "test"})

        assert "code=4018" in str(exc_info.value)
        assert "request_id=req_123" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_execute_purely_calls_create_with_versionless_video_path(self, tool):
        with patch.object(tool, "_resolve_model", return_value="veo-3.1-fast-generate-preview"), \
             patch.object(tool, "_resolve_video_generation_config", return_value=None), \
             patch.object(tool, "_build_create_payload", new_callable=AsyncMock, return_value=({"prompt": "test"}, {}, None)), \
             patch.object(tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_123", "status": "queued"}), \
             patch.object(tool, "_build_result_metadata", return_value={"operation_id": "op_123", "request_id": "req_123"}), \
             patch.object(tool, "_build_operation_result", new_callable=AsyncMock) as mock_build_result, \
             patch.object(tool, "_request_json", new_callable=AsyncMock, return_value={"id": "op_123", "status": "queued"}) as mock_request_json, \
             patch("app.tools.generate_video.uuid.uuid4", return_value="req_123"):
            await tool.execute_purely(None, type("Params", (), {
                "model_id": "",
                "prompt": "test",
                "poll_interval_seconds": 1,
                "poll_timeout_seconds": 1,
                "video_name": "",
                "output_path": "videos",
                "override": False,
            })())

        assert mock_request_json.await_args.kwargs["path"] == "/videos"
        assert mock_request_json.await_args.kwargs["request_id"] == "req_123"
        assert mock_build_result.await_args.kwargs["metadata"]["request_id"] == "req_123"
        assert mock_build_result.await_count == 1

    @pytest.mark.asyncio
    async def test_execute_purely_returns_not_ok_when_create_request_fails(self, tool):
        with patch.object(tool, "_resolve_model", return_value="veo-3.1-fast-generate-preview"), \
             patch.object(tool, "_resolve_video_generation_config", return_value=None), \
             patch.object(tool, "_build_create_payload", new_callable=AsyncMock, return_value=({"prompt": "test"}, {}, None)), \
             patch.object(tool, "_request_json", new_callable=AsyncMock, side_effect=ValueError("boom")):
            result = await tool.execute_purely(
                None,
                GenerateVideoParams(prompt="test", model_id="veo-3.1-fast-generate-preview"),
            )

        assert not result.ok
        assert result.content
        assert result.extra_info["error"] == "boom"

    @pytest.mark.asyncio
    async def test_execute_purely_returns_raw_missing_local_file_error_for_reference_image(self, tool):
        with patch.object(tool, "_resolve_model", return_value="veo-3.1-fast-generate-preview"), \
             patch.object(tool, "_resolve_video_generation_config", return_value=None):
            result = await tool.execute_purely(
                None,
                GenerateVideoParams(
                    prompt="test",
                    model_id="veo-3.1-fast-generate-preview",
                    reference_image_paths=["missing-reference.jpg"],
                ),
            )

        assert not result.ok
        assert result.content == "本地文件不存在: missing-reference.jpg"
        assert result.extra_info["error"] == "本地文件不存在: missing-reference.jpg"
        assert result.extra_info["raw_error"] == "本地文件不存在: missing-reference.jpg"
        assert result.extra_info["error_type"] == "video.local_input_not_found"

    @pytest.mark.asyncio
    async def test_build_create_payload_uses_model_id_and_generate_task(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            reference_image_paths=["https://example.com/ref.png"],
            frame_start_path="https://example.com/start.png",
            frame_end_path="https://example.com/end.png",
            aspect_ratio="16:9",
            resolution="1080p",
        )

        with patch("app.tools.generate_video.MetadataUtil.is_initialized", return_value=False):
            payload, generation, matched_size = await tool._build_create_payload(params, params.model_id)

        assert payload["model_id"] == "veo-3.1-fast-generate-preview"
        assert payload["task"] == "generate"
        assert "model" not in payload
        assert payload["inputs"]["reference_images"] == [{"uri": "https://example.com/ref.png"}]
        assert payload["inputs"]["frames"] == [
            {"role": "start", "uri": "https://example.com/start.png"},
            {"role": "end", "uri": "https://example.com/end.png"},
        ]
        assert payload["generation"] == {"aspect_ratio": "16:9", "resolution": "1080p"}
        assert generation == {"aspect_ratio": "16:9", "resolution": "1080p"}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_attaches_project_id_from_metadata(self, tool):
        params = GenerateVideoParams(prompt="test", model_id="veo-3.1-fast-generate-preview")

        with patch("app.tools.generate_video.MetadataUtil.is_initialized", return_value=True), \
             patch("app.tools.generate_video.MetadataUtil.get_metadata", return_value={"project_id": "1001"}):
            payload, generation, matched_size = await tool._build_create_payload(params, params.model_id)

        assert payload["business_params"] == {"project_id": "1001"}
        assert generation == {}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_does_not_use_featured_default_resolution(self, tool):
        params = GenerateVideoParams(prompt="test", model_id="veo-3.1-fast-generate-preview")

        with patch("app.tools.generate_video.MetadataUtil.is_initialized", return_value=False):
            payload, generation, matched_size = await tool._build_create_payload(
                params,
                params.model_id,
                {
                    "generation": {
                        "resolutions": ["720p", "1080p"],
                        "default_resolution": "1080p",
                        "sizes": [
                            {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}
                        ],
                    }
                },
            )

        assert "generation" not in payload
        assert generation == {}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_keeps_only_explicit_size_when_featured_matches(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            size="1920x1080",
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "resolutions": ["720p", "1080p"],
                    "aspect_ratios": ["16:9"],
                    "sizes": [
                        {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}
                    ],
                }
            },
        )

        assert payload["generation"] == {"size": "1920x1080"}
        assert generation == {"size": "1920x1080"}
        assert matched_size == {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}

    @pytest.mark.asyncio
    async def test_build_create_payload_maps_dimensions_to_size_without_inferred_featured_fields(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            width=1920,
            height=1080,
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "resolutions": ["720p", "1080p"],
                    "aspect_ratios": ["16:9"],
                    "sizes": [
                        {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}
                    ],
                }
            },
        )

        assert payload["generation"] == {"size": "1920x1080"}
        assert generation == {"size": "1920x1080"}
        assert matched_size == {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}

    @pytest.mark.asyncio
    async def test_build_create_payload_keeps_explicit_conflicting_fields_for_magic_service_filtering(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            size="1920x1080",
            aspect_ratio="9:16",
            resolution="720p",
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "resolutions": ["720p", "1080p"],
                    "aspect_ratios": ["16:9", "9:16"],
                    "sizes": [
                        {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}
                    ],
                }
            },
        )

        assert payload["generation"] == {"size": "1920x1080", "aspect_ratio": "9:16", "resolution": "720p"}
        assert generation == {"size": "1920x1080", "aspect_ratio": "9:16", "resolution": "720p"}
        assert matched_size == {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}

    @pytest.mark.asyncio
    async def test_build_create_payload_tolerates_unsupported_size(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            size="1024x1024",
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "sizes": [
                        {"label": "16:9", "value": "1920x1080", "width": 1920, "height": 1080, "resolution": "1080p"}
                    ],
                }
            },
        )

        assert payload["generation"] == {"size": "1024x1024"}
        assert generation == {"size": "1024x1024"}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_tolerates_size_without_featured_sizes(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="wuyin-grok-imagine",
            size="1920x1080",
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "aspect_ratios": ["16:9"],
                    "durations": [10],
                }
            },
        )

        assert payload["generation"] == {"size": "1920x1080"}
        assert generation == {"size": "1920x1080"}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_tolerates_unsupported_resolution(self, tool):
        params = GenerateVideoParams(prompt="test", model_id="veo-3.1-fast-generate-preview", resolution="4k")

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {"generation": {"resolutions": ["720p", "1080p"]}},
        )

        assert payload["generation"] == {"resolution": "4k"}
        assert generation == {"resolution": "4k"}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_infers_resolution_from_dimensions_without_featured_sizes(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="keling-3.0-video",
            width=1920,
            height=1080,
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "resolutions": ["720p", "1080p"],
                    "aspect_ratios": ["16:9", "9:16", "1:1"],
                }
            },
        )

        assert payload["generation"] == {"resolution": "1080p"}
        assert generation == {"resolution": "1080p"}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_does_not_infer_unsupported_resolution_from_dimensions(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="keling-3.0-video",
            width=1920,
            height=1080,
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "generation": {
                    "resolutions": ["720p"],
                    "aspect_ratios": ["16:9", "9:16", "1:1"],
                }
            },
        )

        assert "generation" not in payload
        assert generation == {}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_accepts_reference_images_when_reference_images_config_supports_it(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="veo-3.1-fast-generate-preview",
            reference_image_paths=["https://example.com/ref.png"],
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "supported_inputs": ["text_prompt", "image"],
                "reference_images": {
                    "max_count": 1,
                    "reference_types": [],
                    "style_supported": False,
                },
            },
        )

        assert payload["inputs"]["reference_images"] == [{"uri": "https://example.com/ref.png"}]
        assert generation == {}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_create_payload_supports_grok_featured_without_sizes_or_default_resolution(self, tool):
        params = GenerateVideoParams(
            prompt="test",
            model_id="wuyin-grok-imagine",
            reference_image_paths=["https://example.com/ref.png"],
            duration_seconds=10,
            aspect_ratio="16:9",
        )

        payload, generation, matched_size = await tool._build_create_payload(
            params,
            params.model_id,
            {
                "supported_inputs": ["text_prompt", "reference_images"],
                "reference_images": {
                    "max_count": 1,
                    "reference_types": ["asset"],
                    "style_supported": False,
                },
                "generation": {
                    "aspect_ratios": ["2:3", "3:2", "1:1", "16:9", "9:16"],
                    "durations": [6, 10, 15],
                },
            },
        )

        assert payload["inputs"]["reference_images"] == [{"uri": "https://example.com/ref.png"}]
        assert payload["generation"] == {"aspect_ratio": "16:9", "duration_seconds": 10}
        assert generation == {"aspect_ratio": "16:9", "duration_seconds": 10}
        assert matched_size is None

    @pytest.mark.asyncio
    async def test_build_target_path_appends_counter_when_file_exists(self, tool):
        save_dir = tool.base_dir / "videos"
        save_dir.mkdir(parents=True, exist_ok=True)
        (save_dir / "demo.mp4").write_bytes(b"existing")

        target_path = await tool._build_target_path(str(save_dir), "demo", ".mp4", override=False)

        assert target_path == save_dir / "demo_1.mp4"

    @pytest.mark.asyncio
    async def test_build_operation_result_succeeds_when_file_notification_fails(self, tool):
        operation = {
            "id": "op_video_1",
            "status": "succeeded",
            "output": {
                "video_url": "https://example.com/generated/demo.mp4",
            },
        }
        metadata = {
            "operation_id": "op_video_1",
            "request_id": "req_video_1",
        }

        with patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockDownloadSession(b"fake-video-bytes")), \
             patch.object(tool, "_probe_video_dimensions", new_callable=AsyncMock, return_value=(1280, 720)), \
             patch("app.tools.generate_video.notify_generated_media_file", new_callable=AsyncMock, side_effect=RuntimeError("missing upload key")) as mock_notify:
            result = await tool._build_operation_result(
                tool_context=None,
                operation=operation,
                output_path="videos",
                video_name="demo",
                override=False,
                metadata=metadata,
                success_message_code="generate_video.success",
                pending_message_code="generate_video.pending",
            )

        saved_path = tool.base_dir / "videos" / "demo.mp4"
        assert result.ok
        assert result.video_url == str(saved_path)
        assert result.videos == [str(saved_path)]
        assert result.extra_info["saved_video_relative_path"] == "videos/demo.mp4"
        assert result.extra_info["metadata"]["actual_width"] == 1280
        assert result.extra_info["metadata"]["actual_height"] == 720
        assert saved_path.read_bytes() == b"fake-video-bytes"
        assert mock_notify.await_count == 1
        assert mock_notify.await_args.kwargs["source"] == 7

    @pytest.mark.asyncio
    async def test_build_operation_result_keeps_success_when_poster_download_fails(self, tool):
        operation = {
            "id": "op_video_2",
            "status": "succeeded",
            "output": {
                "video_url": "https://example.com/generated/demo.mp4",
                "poster_url": "https://example.com/generated/demo.jpg",
            },
        }

        with patch(
            "app.tools.generate_video.aiohttp.ClientSession",
            side_effect=[
                _MockDownloadSession(b"fake-video-bytes"),
                _MockDownloadSession(b"", status=404),
            ],
        ), patch.object(
            tool,
            "_probe_video_dimensions",
            new_callable=AsyncMock,
            return_value=(None, None),
        ), patch(
            "app.tools.generate_video.notify_generated_media_file",
            new_callable=AsyncMock,
            side_effect=RuntimeError("missing upload key"),
        ):
            result = await tool._build_operation_result(
                tool_context=None,
                operation=operation,
                output_path="videos",
                video_name="demo",
                override=False,
                metadata={"operation_id": "op_video_2", "request_id": "req_video_2"},
                success_message_code="generate_video.success",
                pending_message_code="generate_video.pending",
            )

        assert result.ok
        assert result.extra_info["saved_video_relative_path"] == "videos/demo.mp4"
        assert result.extra_info["saved_poster_relative_path"] is None
        assert result.extra_info["poster_download_error"] == "poster download failed"
        assert result.extra_info["metadata"]["actual_width"] is None
        assert result.extra_info["metadata"]["actual_height"] is None

    @pytest.mark.asyncio
    async def test_build_operation_result_keeps_success_when_video_dimension_probe_fails(self, tool):
        operation = {
            "id": "op_video_probe_fail",
            "status": "succeeded",
            "output": {
                "video_url": "https://example.com/generated/demo.mp4",
            },
        }

        with patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockDownloadSession(b"fake-video-bytes")), \
             patch.object(tool, "_probe_video_dimensions", new_callable=AsyncMock, side_effect=RuntimeError("ffprobe missing")), \
             patch("app.tools.generate_video.notify_generated_media_file", new_callable=AsyncMock, side_effect=RuntimeError("missing upload key")):
            result = await tool._build_operation_result(
                tool_context=None,
                operation=operation,
                output_path="videos",
                video_name="demo",
                override=False,
                metadata={"operation_id": "op_video_probe_fail", "request_id": "req_video_probe_fail"},
                success_message_code="generate_video.success",
                pending_message_code="generate_video.pending",
            )

        assert result.ok
        assert result.extra_info["metadata"]["actual_width"] is None
        assert result.extra_info["metadata"]["actual_height"] is None

    @pytest.mark.asyncio
    async def test_build_operation_result_marks_pending_as_timed_out_result(self, tool):
        operation = {
            "id": "op_video_pending",
            "status": "processing",
            "timed_out": True,
            "output": {},
        }

        result = await tool._build_operation_result(
            tool_context=None,
            operation=operation,
            output_path="videos",
            video_name="demo",
            override=False,
            metadata={"operation_id": "op_video_pending", "request_id": "req_video_pending"},
            success_message_code="generate_video.success",
            pending_message_code="generate_video.pending",
        )

        assert result.ok
        assert result.extra_info["timed_out"] is True
        assert result.extra_info["status"] == "processing"
        assert result.content
        assert result.extra_info["operation_id"] == "op_video_pending"

    @pytest.mark.asyncio
    async def test_query_video_generation_forwards_request_id(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)

        with patch.object(tool._video_tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_123", "status": "queued"}) as mock_wait, \
             patch.object(tool._video_tool, "_build_operation_result", new_callable=AsyncMock) as mock_build:
            await tool.execute(
                None,
                QueryVideoGenerationParams(
                    operation_id="op_123",
                    request_id="req_123",
                    output_path="videos",
                    video_name="demo",
                ),
            )

        assert mock_wait.await_args.kwargs["request_id"] == "req_123"
        assert mock_build.await_args.kwargs["metadata"]["request_id"] == "req_123"

    @pytest.mark.asyncio
    async def test_request_json_logs_only_payload_summary(self, tool):
        with patch("app.tools.generate_video.MagicServiceConfigLoader.load_with_fallback") as mock_load_config, \
             patch.object(tool, "_build_api_headers", return_value={"Magic-Authorization": "test"}), \
             patch("app.tools.generate_video.logger.info") as mock_logger_info, \
             patch(
                 "app.tools.generate_video.aiohttp.ClientSession",
                 return_value=_MockSession(
                     [],
                     response=_MockResponse(
                         status=200,
                         text='{"id":"op_123","status":"queued","output":{"video_url":"https://example.com/private.mp4"}}',
                     ),
                 ),
             ):
            mock_load_config.return_value = MagicServiceConfig(
                api_base_url="https://api.t.teamshare.cn/magic-service/v1",
                api_key="access_key",
            )

            await tool._request_json(
                "POST",
                "/videos",
                {
                    "prompt": "very secret prompt",
                    "model_id": "veo-3.1-fast-generate-preview",
                    "inputs": {
                        "reference_images": [{"uri": "https://example.com/signed-ref.png?token=abc"}],
                        "frame_start": {"uri": "https://example.com/frame-start.png?token=xyz"},
                    },
                    "generation": {"aspect_ratio": "16:9"},
                },
                request_id="req_123",
            )

        logged_messages = " ".join(call.args[0] for call in mock_logger_info.call_args_list)
        assert "very secret prompt" not in logged_messages
        assert "signed-ref.png?token=abc" not in logged_messages
        assert "frame-start.png?token=xyz" not in logged_messages
        assert "private.mp4" not in logged_messages
        assert '"prompt_length": 18' in logged_messages

    @pytest.mark.asyncio
    async def test_query_video_generation_updates_canvas_video_element_when_context_provided(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)
        project_path = tmp_path / "demo-project"
        project_path.mkdir()
        (project_path / "magic.project.js").write_text(
            """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "demo-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "video_elem_1",
        "type": "video",
        "name": "promo",
        "x": 100,
        "y": 100,
        "width": 640,
        "height": 360,
        "status": "processing",
        "generateVideoRequest": {
          "model_id": "veo-3.1-fast-generate-preview",
          "prompt": "生成一段产品宣传视频",
          "operation_id": "op_123",
          "request_id": "req_123",
          "file_dir": "videos",
          "reference_images": ["demo-project/assets/ref-1.png"],
          "frames": [
            {"role": "start", "uri": "demo-project/assets/frame-start.png"},
            {"role": "end", "uri": "demo-project/assets/frame-end.png"}
          ]
        }
      }
    ]
  }
};""",
            encoding="utf-8",
        )

        result_payload = VideoToolResult(
            ok=True,
            content="视频任务完成，文件：videos/demo.mp4",
            extra_info={
                "operation_id": "op_123",
                "request_id": "req_123",
                "status": "succeeded",
                "saved_video_relative_path": "videos/demo.mp4",
                "saved_poster_relative_path": "videos/demo_poster.jpg",
                "metadata": {
                    "operation_id": "op_123",
                    "request_id": "req_123",
                    "file_dir": "videos",
                    "actual_width": 1920,
                    "actual_height": 1080,
                    "reference_images": [],
                    "frames": [],
                },
            },
            videos=["/tmp/demo.mp4"],
        )

        with patch.object(tool._video_tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_123", "status": "succeeded"}), \
             patch.object(tool._video_tool, "_build_operation_result", new_callable=AsyncMock, return_value=result_payload):
            result = await tool.execute(
                ToolContext(metadata={"workspace_dir": str(tmp_path)}),
                QueryVideoGenerationParams(
                    operation_id="op_123",
                    request_id="req_123",
                    output_path="videos",
                    video_name="demo",
                    project_path="demo-project",
                    element_id="video_elem_1",
                ),
            )

        config = await read_magic_project_js(str(project_path))
        element = config.canvas.elements[0]

        assert result.ok
        assert result.extra_info["canvas_sync"]["updated"] is True
        assert element.src == "videos/demo.mp4"
        assert element.poster == "videos/demo_poster.jpg"
        assert element.status == "completed"
        assert element.errorMessage is None
        assert element.width == 1920
        assert element.height == 1080
        assert element.generateVideoRequest["operation_id"] == "op_123"
        assert element.generateVideoRequest["request_id"] == "req_123"
        assert element.generateVideoRequest["file_dir"] == "videos"
        assert element.generateVideoRequest["actual_width"] == 1920
        assert element.generateVideoRequest["actual_height"] == 1080
        assert element.generateVideoRequest["reference_images"] == ["demo-project/assets/ref-1.png"]
        assert element.generateVideoRequest["frames"] == [
            {"role": "start", "uri": "demo-project/assets/frame-start.png"},
            {"role": "end", "uri": "demo-project/assets/frame-end.png"},
        ]

    @pytest.mark.asyncio
    async def test_query_video_generation_keeps_placeholder_size_when_actual_dimensions_absent(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)
        project_path = tmp_path / "demo-project"
        project_path.mkdir()
        (project_path / "magic.project.js").write_text(
            """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "demo-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "video_elem_2",
        "type": "video",
        "name": "promo",
        "x": 100,
        "y": 100,
        "width": 640,
        "height": 360,
        "status": "processing",
        "generateVideoRequest": {
          "model_id": "veo-3.1-fast-generate-preview",
          "prompt": "生成一段产品宣传视频",
          "operation_id": "op_456",
          "request_id": "req_456",
          "file_dir": "videos"
        }
      }
    ]
  }
};""",
            encoding="utf-8",
        )

        result_payload = VideoToolResult(
            ok=True,
            content="视频任务完成，文件：videos/demo.mp4",
            extra_info={
                "operation_id": "op_456",
                "request_id": "req_456",
                "status": "succeeded",
                "saved_video_relative_path": "videos/demo.mp4",
                "saved_poster_relative_path": "videos/demo_poster.jpg",
                "metadata": {
                    "operation_id": "op_456",
                    "request_id": "req_456",
                    "file_dir": "videos",
                },
            },
            videos=["/tmp/demo.mp4"],
        )

        with patch.object(tool._video_tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_456", "status": "succeeded"}), \
             patch.object(tool._video_tool, "_build_operation_result", new_callable=AsyncMock, return_value=result_payload):
            result = await tool.execute(
                ToolContext(metadata={"workspace_dir": str(tmp_path)}),
                QueryVideoGenerationParams(
                    operation_id="op_456",
                    request_id="req_456",
                    output_path="videos",
                    video_name="demo",
                    project_path="demo-project",
                    element_id="video_elem_2",
                ),
            )

        config = await read_magic_project_js(str(project_path))
        element = config.canvas.elements[0]

        assert result.ok
        assert element.width == 640
        assert element.height == 360
        assert "actual_width" not in element.generateVideoRequest
        assert "actual_height" not in element.generateVideoRequest

    @pytest.mark.asyncio
    async def test_query_video_generation_failed_canvas_sync_clears_frontend_error_message(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)
        project_path = tmp_path / "demo-project"
        project_path.mkdir()
        (project_path / "magic.project.js").write_text(
            """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "demo-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "video_elem_failed",
        "type": "video",
        "name": "promo",
        "x": 100,
        "y": 100,
        "width": 640,
        "height": 360,
        "status": "processing",
        "generateVideoRequest": {
          "model_id": "veo-3.1-fast-generate-preview",
          "prompt": "生成一段产品宣传视频",
          "operation_id": "op_failed",
          "request_id": "req_failed",
          "file_dir": "videos"
        }
      }
    ]
  }
};""",
            encoding="utf-8",
        )

        result_payload = VideoToolResult(
            ok=False,
            content="视频生成失败: provider rejected size",
            extra_info={
                "operation_id": "op_failed",
                "request_id": "req_failed",
                "status": "failed",
                "error": {"message": "provider rejected size"},
                "metadata": {
                    "operation_id": "op_failed",
                    "request_id": "req_failed",
                    "file_dir": "videos",
                },
            },
            videos=[],
        )

        with patch.object(tool._video_tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_failed", "status": "failed"}), \
             patch.object(tool._video_tool, "_build_operation_result", new_callable=AsyncMock, return_value=result_payload):
            result = await tool.execute(
                ToolContext(metadata={"workspace_dir": str(tmp_path)}),
                QueryVideoGenerationParams(
                    operation_id="op_failed",
                    request_id="req_failed",
                    output_path="videos",
                    video_name="demo",
                    project_path="demo-project",
                    element_id="video_elem_failed",
                ),
            )

        config = await read_magic_project_js(str(project_path))
        element = config.canvas.elements[0]

        assert not result.ok
        assert result.content == "视频生成失败: provider rejected size"
        assert result.extra_info["canvas_sync"]["updated"] is True
        assert element.status == "failed"
        assert element.errorMessage == "视频生成失败: provider rejected size"
        assert element.generateVideoRequest["request_id"] == "req_failed"

    @pytest.mark.asyncio
    async def test_query_video_generation_dispatches_progress_events_with_original_tool_name(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)
        agent_context = _FakeAgentContext()
        tool_context = ToolContext(tool_call_id="tool_call_1", metadata={"workspace_dir": str(tmp_path)})
        tool_context.register_extension("agent_context", agent_context)

        operations = [
            {"id": "op_123", "status": "queued", "queue": {"position": 2}},
            {"id": "op_123", "status": "processing", "queue": {"position": 1}},
            {"id": "op_123", "status": "succeeded", "queue": None},
        ]

        with patch.object(tool._video_tool, "_request_json", new_callable=AsyncMock, side_effect=operations), \
             patch.object(tool._video_tool, "_build_operation_result", new_callable=AsyncMock, return_value=VideoToolResult(ok=True, content="done")), \
             patch.object(tool, "_sync_canvas_video_element_if_needed", new_callable=AsyncMock, return_value=VideoToolResult(ok=True, content="done")), \
             patch("app.tools.generate_video.asyncio.sleep", new_callable=AsyncMock), \
             patch("app.tools.generate_video.get_correlation_manager", return_value=_FakeCorrelationManager()), \
             patch("app.tools.generate_video.time.time", side_effect=[1000, 1005, 1010]):
            await tool.execute(
                tool_context,
                QueryVideoGenerationParams(
                    operation_id="op_123",
                    request_id="req_123",
                    output_path="videos",
                    video_name="demo",
                    poll_interval_seconds=5,
                    poll_timeout_seconds=15,
                    project_path="demo-project",
                    element_id="video_elem_1",
                ),
            )

        assert len(agent_context.events) == 3
        assert [event_type for event_type, _ in agent_context.events] == [EventType.PENDING_TOOL_CALL] * 3

        first_arguments = agent_context.events[0][1].arguments
        second_arguments = agent_context.events[1][1].arguments
        third_arguments = agent_context.events[2][1].arguments

        assert first_arguments["name"] == "video_generation_progress"
        assert first_arguments["action"]
        assert first_arguments["correlation_id"] == "corr_123"
        assert first_arguments["detail"]["type"] == "text"
        assert first_arguments["detail"]["data"]["task_type"] == "video_generation"
        assert first_arguments["detail"]["data"]["task_id"] == "op_123"
        assert first_arguments["detail"]["data"]["operation_id"] == "op_123"
        assert first_arguments["detail"]["data"]["video_status"] == "queued"
        assert first_arguments["detail"]["data"]["provider_status"] == "queued"
        assert first_arguments["detail"]["data"]["request_id"] == "req_123"
        assert first_arguments["detail"]["data"]["file_name"] == "demo"
        assert first_arguments["detail"]["data"]["queue"] == {"position": 2}
        assert first_arguments["detail"]["data"]["canvas_context"] == {
            "project_path": "demo-project",
            "element_id": "video_elem_1",
        }
        assert first_arguments["detail"]["data"]["progress"] == 1
        assert first_arguments["status"] == "processing"

        assert second_arguments["detail"]["data"]["progress"] > first_arguments["detail"]["data"]["progress"]
        assert second_arguments["detail"]["data"]["progress"] <= 99
        assert second_arguments["detail"]["data"]["started_at"] == 1000
        assert second_arguments["detail"]["data"]["elapsed_seconds"] == 5
        assert second_arguments["name"] == "video_generation_progress"
        assert second_arguments["detail"]["data"]["video_status"] == "processing"
        assert second_arguments["detail"]["data"]["provider_status"] == "processing"
        assert second_arguments["detail"]["data"]["queue"] == {"position": 1}
        assert third_arguments["name"] == "video_generation_progress"
        assert third_arguments["detail"]["data"]["progress"] == 100
        assert third_arguments["detail"]["data"]["message"]
        assert third_arguments["detail"]["data"]["elapsed_seconds"] == 10
        assert third_arguments["detail"]["data"]["video_status"] == "succeeded"
        assert third_arguments["detail"]["data"]["provider_status"] == "succeeded"
        assert third_arguments["detail"]["data"]["queue"] is None

    @pytest.mark.asyncio
    async def test_query_video_generation_does_not_dispatch_progress_for_immediate_failed_task(self, tmp_path):
        tool = QueryVideoGeneration(base_dir=tmp_path)
        agent_context = _FakeAgentContext()
        tool_context = ToolContext(tool_call_id="tool_call_1", metadata={"workspace_dir": str(tmp_path)})
        tool_context.register_extension("agent_context", agent_context)

        with patch.object(
            tool._video_tool,
            "_request_json",
            new_callable=AsyncMock,
            return_value={"id": "op_failed", "status": "failed", "error": {"message": "provider rejected size"}},
        ), patch.object(
            tool._video_tool,
            "_build_operation_result",
            new_callable=AsyncMock,
            return_value=VideoToolResult(ok=False, content="failed"),
        ), patch("app.tools.generate_video.get_correlation_manager", return_value=_FakeCorrelationManager()), \
             patch("app.tools.generate_video.time.time", return_value=2000):
            await tool.execute(
                tool_context,
                QueryVideoGenerationParams(
                    operation_id="op_failed",
                    request_id="req_failed",
                    output_path="videos",
                    video_name="demo",
                ),
            )

        assert agent_context.events == []

    @pytest.mark.asyncio
    async def test_execute_purely_dispatches_task_progress_events_during_waiting(self, tool):
        agent_context = _FakeAgentContext()
        tool_context = ToolContext(tool_call_id="tool_call_1", metadata={"workspace_dir": str(tool.base_dir)})
        tool_context.register_extension("agent_context", agent_context)

        with patch.object(tool, "_resolve_model", return_value="veo-3.1-fast-generate-preview"), \
             patch.object(tool, "_resolve_video_generation_config", return_value=None), \
             patch.object(tool, "_build_create_payload", new_callable=AsyncMock, return_value=({"prompt": "test"}, {}, None)), \
             patch.object(tool, "_build_result_metadata", return_value={"operation_id": "op_123", "request_id": "req_123"}), \
             patch.object(tool, "_build_operation_result", new_callable=AsyncMock, return_value=VideoToolResult(ok=True, content="done")), \
             patch.object(tool, "_request_json", new_callable=AsyncMock, side_effect=[{"id": "op_123", "status": "queued"}, {"id": "op_123", "status": "succeeded"}]), \
             patch("app.tools.generate_video.asyncio.sleep", new_callable=AsyncMock), \
             patch.object(tool, "_dispatch_task_progress_event", new_callable=AsyncMock) as mock_dispatch_progress, \
             patch("app.tools.generate_video.uuid.uuid4", return_value="req_123"):
            await tool.execute_purely(
                tool_context,
                GenerateVideoParams(
                    prompt="test",
                    model_id="veo-3.1-fast-generate-preview",
                    poll_interval_seconds=1,
                    poll_timeout_seconds=2,
                ),
            )

        assert mock_dispatch_progress.await_count == 2

    @pytest.mark.asyncio
    async def test_wait_for_operation_queries_with_versionless_video_path(self, tool):
        with patch.object(tool, "_request_json", new_callable=AsyncMock, return_value={"id": "op_123", "status": "succeeded"}) as mock_request_json:
            await tool._wait_for_operation(
                operation_id="op_123",
                poll_interval_seconds=1,
                poll_timeout_seconds=1,
                initial_response=None,
            )

        assert mock_request_json.await_args_list[0].args == ("GET", "/videos/op_123")
