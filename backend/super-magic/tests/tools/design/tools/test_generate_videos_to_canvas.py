"""测试 GenerateVideosToCanvas 工具"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from app.core.entity.tool.tool_result import VideoToolResult
from app.i18n import i18n
from app.tools.design.tools.generate_videos_to_canvas import (
    GenerateVideosToCanvas,
    GenerateVideosToCanvasParams,
)


class _MockDownloadResponse:
    def __init__(self, content: bytes, content_type: str = "video/mp4", status: int = 200):
        self.status = status
        self._content = content
        self.headers = {"Content-Type": content_type}

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


@pytest.fixture
def tool(tmp_path):
    tool_instance = GenerateVideosToCanvas()
    tool_instance.base_dir = tmp_path
    tool_instance._generate_tool.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    context = ToolContext(metadata={"workspace_dir": str(tmp_path)})
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()
    context.register_extension("agent_context", agent_context)
    return context


@pytest.fixture
def setup_project(tmp_path):
    project_path = tmp_path / "test-project"
    project_path.mkdir()
    (project_path / "magic.project.js").write_text(
        """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": []
  }
};""",
        encoding="utf-8",
    )
    return project_path


class TestGenerateVideosToCanvas:
    @staticmethod
    def _expected_design_failure_remark() -> str:
        return i18n.translate("design.error_unexpected", category="tool.messages")

    @pytest.mark.asyncio
    async def test_generate_video_completed_with_real_generate_tool_flow(self, tool, tool_context, setup_project):
        captured_updates = {}

        async def mock_batch_update_execute(_tool_context, params):
            captured_updates["params"] = params
            update = params.updates[0]
            return VideoToolResult(
                ok=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": update.element_id,
                            "name": "promo_video",
                            "type": "video",
                            "src": update.properties["src"],
                            "poster": update.properties.get("poster"),
                            "status": update.properties["status"],
                            "width": update.properties.get("width"),
                            "height": update.properties.get("height"),
                            "generateVideoRequest": update.properties["generateVideoRequest"],
                        }
                    ]
                },
            )

        with patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", side_effect=mock_batch_update_execute) as mock_batch_update, \
             patch.object(tool._generate_tool, "_resolve_model", return_value="veo-3.1-fast-generate-preview"), \
             patch.object(tool._generate_tool, "_resolve_video_generation_config", return_value=None), \
             patch.object(tool._generate_tool, "_build_create_payload", new_callable=AsyncMock, return_value=({"prompt": "生成一段产品宣传视频"}, {}, None)), \
             patch.object(tool._generate_tool, "_request_json", new_callable=AsyncMock, return_value={"id": "op_video_real_1", "status": "queued"}) as mock_request_json, \
             patch.object(tool._generate_tool, "_wait_for_operation", new_callable=AsyncMock, return_value={"id": "op_video_real_1", "status": "succeeded", "output": {"video_url": "https://example.com/generated/promo.mp4"}}), \
             patch.object(tool._generate_tool, "_probe_video_dimensions", new_callable=AsyncMock, return_value=(1920, 1080)), \
             patch("app.tools.generate_video.aiohttp.ClientSession", return_value=_MockDownloadSession(b"canvas-video-bytes")), \
             patch("app.tools.generate_video.notify_generated_media_file", new_callable=AsyncMock, side_effect=RuntimeError("missing upload key")) as mock_notify, \
             patch("app.tools.generate_video.uuid.uuid4", return_value="req_video_real_1"):

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_real_1", "name": "promo_video", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="promo_video",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        saved_path = tool.base_dir / "test-project" / "videos" / "promo_video.mp4"

        assert result.ok
        assert result.extra_info["completed_count"] == 1
        assert result.extra_info["processing_count"] == 0
        assert result.extra_info["failed_count"] == 0
        assert result.extra_info["pending_operations"] == []
        assert saved_path.read_bytes() == b"canvas-video-bytes"
        assert result.extra_info["elements"][0]["src"] == "test-project/videos/promo_video.mp4"
        assert result.extra_info["elements"][0]["status"] == "completed"
        assert result.extra_info["elements"][0]["width"] == 1920
        assert result.extra_info["elements"][0]["height"] == 1080
        assert mock_notify.await_count == 1
        assert mock_batch_update.call_count == 1
        assert mock_request_json.await_args.kwargs["path"] == "/videos"

        update = captured_updates["params"].updates[0]
        assert update.element_id == "video_elem_real_1"
        assert update.properties["src"] == "test-project/videos/promo_video.mp4"
        assert update.properties["poster"] is None
        assert update.properties["status"] == "completed"
        assert update.properties["width"] == 1920
        assert update.properties["height"] == 1080
        assert update.properties["generateVideoRequest"]["operation_id"] == "op_video_real_1"
        assert update.properties["generateVideoRequest"]["request_id"] == "req_video_real_1"
        assert update.properties["generateVideoRequest"]["file_dir"] == "test-project/videos"
        assert update.properties["generateVideoRequest"]["actual_width"] == 1920
        assert update.properties["generateVideoRequest"]["actual_height"] == 1080

    @pytest.mark.asyncio
    async def test_generate_video_completed(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="done",
                extra_info={
                    "operation_id": "op_video_1",
                    "request_id": "req_video_1",
                    "status": "succeeded",
                    "saved_video_relative_path": "test-project/videos/promo.mp4",
                    "saved_poster_relative_path": "test-project/videos/promo_poster.jpg",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_1",
                        "request_id": "req_video_1",
                        "file_dir": "videos",
                        "actual_width": 1920,
                        "actual_height": 1080,
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(
                ok=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "video_elem_1",
                            "name": "宣传视频",
                            "type": "video",
                            "src": "test-project/videos/promo.mp4",
                            "poster": "test-project/videos/promo_poster.jpg",
                            "status": "completed",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                    reference_image_paths=["test-project/assets/ref-1.png"],
                    frame_start_path="test-project/assets/frame-start.png",
                    frame_end_path="test-project/assets/frame-end.png",
                ),
            )

        assert result.ok
        assert result.extra_info["completed_count"] == 1
        assert result.extra_info["processing_count"] == 0
        assert result.extra_info["failed_count"] == 0
        assert result.extra_info["pending_operations"] == []
        assert result.extra_info["elements"][0]["src"] == "test-project/videos/promo.mp4"
        assert result.extra_info["elements"][0]["status"] == "completed"

        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["src"] == "test-project/videos/promo.mp4"
        assert update.properties["poster"] == "test-project/videos/promo_poster.jpg"
        assert update.properties["status"] == "completed"
        assert update.properties["width"] == 1920
        assert update.properties["height"] == 1080
        assert update.properties["generateVideoRequest"]["model_id"] == "veo-3.1-fast-generate-preview"
        assert update.properties["generateVideoRequest"]["operation_id"] == "op_video_1"
        assert update.properties["generateVideoRequest"]["request_id"] == "req_video_1"
        assert update.properties["generateVideoRequest"]["actual_width"] == 1920
        assert update.properties["generateVideoRequest"]["actual_height"] == 1080
        assert update.properties["generateVideoRequest"]["reference_images"] == ["test-project/assets/ref-1.png"]
        assert update.properties["generateVideoRequest"]["frames"] == [
            {"role": "start", "uri": "test-project/assets/frame-start.png"},
            {"role": "end", "uri": "test-project/assets/frame-end.png"},
        ]

        generate_params = mock_generate.await_args.args[1]
        assert generate_params.model_id == "veo-3.1-fast-generate-preview"
        assert generate_params.width == 640
        assert generate_params.height == 360
        assert generate_params.output_path == "test-project/videos"
        assert generate_params.reference_image_paths == ["test-project/assets/ref-1.png"]
        assert generate_params.frame_start_path == "test-project/assets/frame-start.png"
        assert generate_params.frame_end_path == "test-project/assets/frame-end.png"

    @pytest.mark.asyncio
    async def test_generate_video_passes_explicit_generation_size(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="done",
                extra_info={
                    "operation_id": "op_video_1",
                    "request_id": "req_video_1",
                    "status": "succeeded",
                    "saved_video_relative_path": "test-project/videos/promo.mp4",
                    "saved_poster_relative_path": "test-project/videos/promo_poster.jpg",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_1",
                        "request_id": "req_video_1",
                        "file_dir": "test-project/videos",
                        "size": {"value": "1920x1080", "resolution": "1080p"},
                        "actual_width": 1920,
                        "actual_height": 1080,
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(ok=True, content="updated", extra_info={"elements": []})

            await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    size="1920x1080",
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        generate_params = mock_generate.await_args.args[1]
        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert generate_params.size == "1920x1080"
        assert generate_params.output_path == "test-project/videos"
        assert update.properties["width"] == 1920
        assert update.properties["height"] == 1080
        assert update.properties["generateVideoRequest"]["size"] == {"value": "1920x1080", "resolution": "1080p"}

    @pytest.mark.asyncio
    async def test_generate_video_completed_keeps_placeholder_size_when_actual_dimensions_absent(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="done",
                extra_info={
                    "operation_id": "op_video_1",
                    "request_id": "req_video_1",
                    "status": "succeeded",
                    "saved_video_relative_path": "test-project/videos/promo.mp4",
                    "saved_poster_relative_path": "test-project/videos/promo_poster.jpg",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_1",
                        "request_id": "req_video_1",
                        "file_dir": "videos",
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(ok=True, content="updated", extra_info={"elements": []})

            await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert "width" not in update.properties
        assert "height" not in update.properties
        assert "actual_width" not in update.properties["generateVideoRequest"]
        assert "actual_height" not in update.properties["generateVideoRequest"]

    @pytest.mark.asyncio
    async def test_generate_video_keeps_processing_when_operation_not_finished(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="still processing",
                extra_info={
                    "operation_id": "op_video_2",
                    "request_id": "req_video_2",
                    "status": "processing",
                    "timed_out": True,
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_2",
                        "request_id": "req_video_2",
                        "file_dir": "test-project/videos",
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(
                ok=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "video_elem_1",
                            "name": "宣传视频",
                            "type": "video",
                            "status": "processing",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                    reference_image_paths=["test-project/assets/ref-processing.png"],
                    frame_start_path="test-project/assets/frame-processing-start.png",
                    frame_end_path="test-project/assets/frame-processing-end.png",
                ),
            )

        assert result.ok
        assert result.extra_info["completed_count"] == 0
        assert result.extra_info["processing_count"] == 1
        assert result.extra_info["failed_count"] == 0
        assert result.extra_info["pending_operations"] == [
            {
                "element_id": "video_elem_1",
                "element_name": "宣传视频",
                "operation_id": "op_video_2",
                "request_id": "req_video_2",
                "status": "processing",
            }
        ]
        assert result.extra_info["elements"][0]["status"] == "processing"
        assert "polled until timeout" in result.content
        assert "If the user explicitly asks to check progress later, use query_video_generation" in result.content
        assert "Do not switch to generate_images_to_canvas" in result.content

        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["status"] == "processing"
        assert update.properties["generateVideoRequest"]["model_id"] == "veo-3.1-fast-generate-preview"
        assert update.properties["generateVideoRequest"]["operation_id"] == "op_video_2"
        assert update.properties["generateVideoRequest"]["request_id"] == "req_video_2"
        assert update.properties["generateVideoRequest"]["file_dir"] == "test-project/videos"
        assert update.properties["generateVideoRequest"]["reference_images"] == ["test-project/assets/ref-processing.png"]
        assert update.properties["generateVideoRequest"]["frames"] == [
            {"role": "start", "uri": "test-project/assets/frame-processing-start.png"},
            {"role": "end", "uri": "test-project/assets/frame-processing-end.png"},
        ]

    @pytest.mark.asyncio
    async def test_generate_video_fills_missing_reference_inputs_from_design_params(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="still processing",
                extra_info={
                    "operation_id": "op_video_partial_1",
                    "request_id": "req_video_partial_1",
                    "status": "processing",
                    "timed_out": True,
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_partial_1",
                        "request_id": "req_video_partial_1",
                        "file_dir": "",
                        "reference_images": [],
                        "frames": [],
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(ok=True, content="updated", extra_info={"elements": []})

            await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                    reference_image_paths=["test-project/assets/ref-fill.png"],
                    frame_start_path="test-project/assets/frame-fill-start.png",
                    frame_end_path="test-project/assets/frame-fill-end.png",
                ),
            )

        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["generateVideoRequest"]["file_dir"] == "test-project/videos"
        assert update.properties["generateVideoRequest"]["reference_images"] == ["test-project/assets/ref-fill.png"]
        assert update.properties["generateVideoRequest"]["frames"] == [
            {"role": "start", "uri": "test-project/assets/frame-fill-start.png"},
            {"role": "end", "uri": "test-project/assets/frame-fill-end.png"},
        ]

    @pytest.mark.asyncio
    async def test_generate_video_returns_error_when_all_videos_fail(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult.error(
                "video failed",
                extra_info={
                    "operation_id": "op_video_3",
                    "request_id": "req_video_3",
                    "status": "failed",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_3",
                        "request_id": "req_video_3",
                        "file_dir": "test-project/videos",
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(
                ok=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "video_elem_1",
                            "name": "宣传视频",
                            "type": "video",
                            "status": "failed",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        assert not result.ok
        assert result.extra_info["completed_count"] == 0
        assert result.extra_info["processing_count"] == 0
        assert result.extra_info["failed_count"] == 1
        assert "all 1 video(s) failed to generate" in result.content
        assert "Detailed errors:" in result.content
        assert "宣传视频 (id: video_elem_1): video failed" in result.content
        assert result.extra_info["elements"][0]["status"] == "failed"
        assert result.extra_info["failed_reasons"] == ["宣传视频 (id: video_elem_1): video failed"]

        friendly = await tool.get_after_tool_call_friendly_action_and_remark(
            tool_name="generate_videos_to_canvas",
            tool_context=tool_context,
            result=result,
            execution_time=0,
            arguments=None,
        )

        assert result.use_custom_remark is True
        assert friendly["remark"] == self._expected_design_failure_remark()
        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["status"] == "failed"
        assert update.properties["errorMessage"] == "video failed"
        assert update.properties["generateVideoRequest"]["file_dir"] == "test-project/videos"
        assert update.properties["generateVideoRequest"]["request_id"] == "req_video_3"

    @pytest.mark.asyncio
    async def test_generate_video_prefers_raw_local_input_error_when_all_videos_fail(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult.error(
                "视频生成失败: 本地文件不存在: test-project/images/source.png",
                extra_info={
                    "raw_error": "本地文件不存在: test-project/images/source.png",
                    "error_type": "video.local_input_not_found",
                    "operation_id": "op_video_3",
                    "request_id": "req_video_3",
                    "status": "failed",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_3",
                        "request_id": "req_video_3",
                        "file_dir": "test-project/videos",
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(
                ok=True,
                content="updated",
                extra_info={
                    "elements": [
                        {
                            "id": "video_elem_1",
                            "name": "宣传视频",
                            "type": "video",
                            "status": "failed",
                        }
                    ]
                },
            )

            result = await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        assert not result.ok
        assert "本地文件不存在: test-project/images/source.png" in result.content
        assert "宣传视频 (id: video_elem_1): 本地文件不存在: test-project/images/source.png" in result.content
        assert result.extra_info["failed_reasons"] == [
            "宣传视频 (id: video_elem_1): 本地文件不存在: test-project/images/source.png"
        ]

        friendly = await tool.get_after_tool_call_friendly_action_and_remark(
            tool_name="generate_videos_to_canvas",
            tool_context=tool_context,
            result=result,
            execution_time=0,
            arguments=None,
        )

        assert result.use_custom_remark is True
        assert friendly["remark"] == self._expected_design_failure_remark()
        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["status"] == "failed"
        assert update.properties["errorMessage"] == "本地文件不存在: test-project/images/source.png"
        assert update.properties["generateVideoRequest"]["request_id"] == "req_video_3"

    @pytest.mark.asyncio
    async def test_generate_video_ignores_explicit_output_path_and_still_uses_project_videos(self, tool, tool_context, setup_project):
        with patch.object(tool._generate_tool, "execute_purely", new_callable=AsyncMock) as mock_generate, \
             patch.object(tool._batch_create_tool, "execute", new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, "execute", new_callable=AsyncMock) as mock_batch_update:

            mock_batch_create.return_value = VideoToolResult(
                ok=True,
                content="placeholder created",
                extra_info={
                    "created_elements": [
                        {"id": "video_elem_1", "name": "宣传视频", "type": "video", "x": 100.0, "y": 100.0, "width": 640.0, "height": 360.0}
                    ],
                    "elements": [],
                },
            )
            mock_generate.return_value = VideoToolResult(
                ok=True,
                content="done",
                extra_info={
                    "operation_id": "op_video_4",
                    "request_id": "req_video_4",
                    "status": "succeeded",
                    "saved_video_relative_path": "test-project/videos/promo.mp4",
                    "saved_poster_relative_path": "test-project/videos/promo_poster.jpg",
                    "metadata": {
                        "model_id": "veo-3.1-fast-generate-preview",
                        "prompt": "生成一段产品宣传视频",
                        "operation_id": "op_video_4",
                        "request_id": "req_video_4",
                        "file_dir": "videos/custom",
                    },
                },
            )
            mock_batch_update.return_value = VideoToolResult(ok=True, content="updated", extra_info={"elements": []})

            await tool.execute(
                tool_context,
                GenerateVideosToCanvasParams(
                    project_path="test-project",
                    prompts=["生成一段产品宣传视频"],
                    name="宣传视频",
                    width=640,
                    height=360,
                    output_path="videos/custom",
                    model_id="veo-3.1-fast-generate-preview",
                ),
            )

        generate_params = mock_generate.await_args.args[1]
        assert generate_params.output_path == "test-project/videos"

        update_params = mock_batch_update.call_args[0][1]
        update = update_params.updates[0]
        assert update.properties["generateVideoRequest"]["file_dir"] == "test-project/videos"
