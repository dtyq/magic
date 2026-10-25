"""独立 Canvas 核心能力的 mock 测试。"""

from __future__ import annotations

import base64
import gzip
import json

import pytest

import tests.tools.canvas.helpers  # noqa: F401
from app.tools.canvas.application.commands import ContentCommand
from app.tools.canvas.bootstrap import CanvasApplicationFactory
from app.tools.canvas.domain.content_fields import ImageContentFields, TextContentFields, VideoContentFields
from app.tools.canvas.domain.errors import CanvasBatchError, CanvasDomainError, CanvasProtocolError
from app.tools.canvas.domain.models import (
    CanvasConnection,
    CanvasContent,
    CanvasDocument,
    CanvasElement,
    CanvasProject,
    ElementProperties,
)
from app.tools.canvas.generation import (
    AsynchronousGenerationStrategy,
    GenerationCapability,
    GenerationCapabilityRegistry,
    GenerationQueryResult,
    GenerationRequest,
    GenerationSubmission,
    GenerationTask,
    InMemoryGenerationTaskRepository,
)
from app.tools.canvas.generation.adapters import FakeImageGenerationPort
from app.tools.canvas.hierarchy import HierarchyMutationPlan
from app.tools.canvas.infrastructure.persistence.canvas_codec import CANVAS_PREFIX, CanvasCodec
from app.tools.canvas.production.adapters import FakeMediaProbePort
from app.tools.canvas.production.ports import VideoMediaInfo
from app.tools.canvas.repository import CanvasRepository
from app.tools.canvas.strategies import (
    ConnectionMutationPlan,
    ConnectionStrategyRegistry,
    ContentMutationPlan,
    ContentStrategyRegistry,
    LayoutMutationPlan,
    LayoutStrategyRegistry,
    LayoutStrategyRequest,
)
from app.tools.canvas.tools import ConnectionInput, ManageCanvasConnections
from app.utils.async_file_utils import async_write_bytes


def test_codec_round_trip_preserves_nested_content_and_connection() -> None:
    """验证主协议编码和解码不会丢失 Element、Content 与 Connection。"""
    project = CanvasProject(
        version="3.0.0",
        project_type="design",
        name="mock-project",
        canvas=CanvasDocument(
            elements=[
                CanvasElement(
                    element_id="text-1",
                    element_type="text",
                    contents=[CanvasContent("text-content-1", TextContentFields(content=[{"children": [{"type": "text", "text": "mock"}]}]))],
                    active_content_id="text-content-1",
                    main_content_id="text-content-1",
                ),
                CanvasElement(
                    element_id="image-1",
                    element_type="image",
                    contents=[CanvasContent("image-content-1", ImageContentFields(src="images/mock.png", status="completed"))],
                    active_content_id="image-content-1",
                    main_content_id="image-content-1",
                ),
            ],
        ),
    )
    project.canvas.connections.append(CanvasConnection("connection-1", "text-1", "image-1"))

    decoded = CanvasCodec.decode(CanvasCodec.encode(project))

    assert decoded.canvas.get_element("text-1").contents[0].fields.content[0]["children"][0]["text"] == "mock"
    assert decoded.canvas.connections[0].target_element_id == "image-1"


def test_codec_rejects_unsupported_version() -> None:
    """协议入口必须拒绝不支持的版本。"""
    encoded = CanvasCodec.encode(CanvasCodec.empty_project("mock-project"))
    legacy = encoded.replace('"version":"3.0.0"', '"version":"2.0.0"', 1)

    with pytest.raises(CanvasProtocolError) as error:
        CanvasCodec.decode(legacy)

    assert error.value.code == "UNSUPPORTED_CANVAS_VERSION"


def test_codec_preserves_unknown_frontend_fields_when_reading_and_saving() -> None:
    """读取和保存时保留前端新增字段，不因未知字段让整个画布失败。"""
    draft = {
        "version": 1,
        "request": {
            "model_id": "mock-model",
            "input_mode": "mock-mode",
        },
    }
    project = CanvasProject(
        version="3.0.0",
        project_type="design",
        name="mock-project",
        canvas=CanvasDocument(
            elements=[
                CanvasElement(
                    element_id="video-1",
                    element_type="video",
                    contents=[
                        CanvasContent(
                            "video-1-content",
                            VideoContentFields(),
                            extra_data={"videoEditorDraft": draft},
                        )
                    ],
                    active_content_id="video-1-content",
                    main_content_id="video-1-content",
                    extra_data={"frontendElementState": {"selected": True}},
                )
            ],
        ),
    )

    decoded = CanvasCodec.decode(CanvasCodec.encode(project))
    content = decoded.canvas.elements[0].contents[0]
    element = decoded.canvas.elements[0]

    assert content.fields.video_editor_draft == draft
    assert element.extra_data == {"frontendElementState": {"selected": True}}

    saved_again = CanvasCodec.decode(CanvasCodec.encode(decoded))
    assert saved_again.canvas.elements[0].contents[0].fields.video_editor_draft == draft
    assert saved_again.canvas.elements[0].extra_data == {"frontendElementState": {"selected": True}}


def test_codec_preserves_frontend_media_fields_and_fractional_z_index() -> None:
    """前端已声明的媒体字段和小数层级必须由后端显式无损处理。"""
    project = CanvasProject(
        version="3.0.0",
        project_type="design",
        name="mock-project",
        canvas=CanvasDocument(elements=[
            CanvasElement(
                element_id="video-1",
                element_type="video",
                properties=ElementProperties(z_index=1.5),
                contents=[CanvasContent(
                    "content-1",
                    VideoContentFields(
                        visual_understanding={"summary": "mock visual summary"},
                        video_editor_draft={"version": 1, "request": {}},
                        video_generation_result_meta={"billing": {"points": 2}},
                    ),
                )],
                active_content_id="content-1",
                main_content_id="content-1",
            ),
        ]),
    )

    content = CanvasCodec.decode(CanvasCodec.encode(project)).canvas.elements[0]

    assert content.properties.z_index == 1.5
    assert content.contents[0].fields.visual_understanding == {"summary": "mock visual summary"}
    assert content.contents[0].fields.video_editor_draft == {"version": 1, "request": {}}
    assert content.contents[0].fields.video_generation_result_meta == {"billing": {"points": 2}}


@pytest.mark.asyncio
async def test_repository_splits_public_heavy_fields_from_video_main_content(tmp_path) -> None:
    """新写数据只把前端公共重字段放入 Sidecar，视频结果字段留在主文件。"""
    repository = CanvasRepository(tmp_path)
    await repository.initialize("mock-project")

    def mutate(project, metadata):
        project.canvas.elements.append(CanvasElement(
            element_id="video-1",
            element_type="video",
            contents=[CanvasContent(
                "content-1",
                VideoContentFields(
                    src="./videos/mock.mp4",
                    status="completed",
                    visual_understanding={"summary": "mock visual summary"},
                    generate_video_request={"prompt": "mock prompt"},
                    video_editor_draft={"version": 1, "request": {}},
                    video_generation_result_meta={"billing": {"points": 2}},
                ),
            )],
            active_content_id="content-1",
            main_content_id="content-1",
        ))
        return None, metadata

    await repository.transaction_with_sidecar("mock-project", mutate)

    saved_content = (await repository.read("mock-project")).canvas.elements[0].contents[0].fields
    detail = (await repository.read_sidecar("mock-project"))["elements"]["video-1"]["contentDetails"]["content-1"]
    assert saved_content.generate_video_request is None
    assert saved_content.visual_understanding is None
    assert saved_content.video_editor_draft == {"version": 1, "request": {}}
    assert saved_content.video_generation_result_meta == {"billing": {"points": 2}}
    assert detail == {
        "generateVideoRequest": {"prompt": "mock prompt"},
        "visualUnderstanding": {"summary": "mock visual summary"},
    }


def _encode_raw_canvas(name: str, canvas: dict) -> str:
    """把原始 Canvas 字典编码成 magic.project.js，用于模拟前端落盘文件。"""
    payload = json.dumps(canvas, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded = CANVAS_PREFIX + base64.b64encode(gzip.compress(payload)).decode("ascii")
    envelope = {"version": "3.0.0", "type": "design", "name": name, "canvas": encoded}
    return f"window.magicProjectConfig = {json.dumps(envelope, ensure_ascii=False, separators=(',', ':'))};\n"


def test_codec_reads_frontend_video_editor_draft_without_failing_project() -> None:
    """前端把 videoEditorDraft 写进 video content 时，整张画布仍可读取。"""
    draft = {"version": 1, "request": {"model_id": "mock-model", "input_mode": "mock-mode"}}
    source = _encode_raw_canvas("mock-project", {
        "elements": [
            {
                "id": "image-1",
                "type": "image",
                "name": "mock-image",
                "contents": [{"contentId": "image-1-content", "src": "./images/mock.png", "status": "completed"}],
                "activeContentId": "image-1-content",
                "mainContentId": "image-1-content",
            },
            {
                "id": "video-1",
                "type": "video",
                "contents": [{"contentId": "video-1-content", "videoEditorDraft": draft}],
                "activeContentId": "video-1-content",
                "mainContentId": "video-1-content",
            },
        ],
        "connections": [],
    })

    decoded = CanvasCodec.decode(source)

    assert decoded.canvas.get_element("image-1") is not None
    video = decoded.canvas.get_element("video-1")
    assert video is not None
    assert video.contents[0].extra_data["videoEditorDraft"] == draft


def test_codec_skips_unsupported_frontend_element_types() -> None:
    """前端新增、后端尚未支持的节点跳过解析，不影响已支持节点，保存时原样写回。"""
    unsupported = {
        "id": "widget-1",
        "type": "frontend-only-widget",
        "name": "mock-widget",
        "contents": [{"contentId": "widget-1-content", "customPayload": {"ok": True}}],
        "activeContentId": "widget-1-content",
        "mainContentId": "widget-1-content",
    }
    source = _encode_raw_canvas("mock-project", {
        "elements": [
            {
                "id": "image-1",
                "type": "image",
                "contents": [{"contentId": "image-1-content", "src": "./images/mock.png", "status": "completed"}],
                "activeContentId": "image-1-content",
                "mainContentId": "image-1-content",
            },
            unsupported,
            {
                "id": "text-1",
                "type": "text",
                "contents": [{"contentId": "text-1-content", "content": []}],
                "activeContentId": "text-1-content",
                "mainContentId": "text-1-content",
            },
        ],
        "connections": [
            {"id": "connection-1", "sourceElementId": "image-1", "targetElementId": "widget-1"},
        ],
    })

    decoded = CanvasCodec.decode(source)

    assert [element.element_id for element in decoded.canvas.elements] == ["image-1", "text-1"]
    assert decoded.canvas.get_element("widget-1") is None
    assert decoded.canvas.opaque_elements[0][1] == unsupported
    assert decoded.canvas.connections[0].target_element_id == "widget-1"

    saved = CanvasCodec.decode(CanvasCodec.encode(decoded))
    assert [element.element_id for element in saved.canvas.elements] == ["image-1", "text-1"]
    assert saved.canvas.opaque_elements[0][1] == unsupported
    assert saved.canvas.connections[0].target_element_id == "widget-1"


def test_codec_skips_unsupported_child_element_inside_frame() -> None:
    """Frame 内的前端新节点同样跳过解析，并在保存时留在 children 原位。"""
    unsupported_child = {
        "id": "widget-child",
        "type": "frontend-only-widget",
        "contents": [{"contentId": "widget-child-content"}],
        "activeContentId": "widget-child-content",
        "mainContentId": "widget-child-content",
    }
    source = _encode_raw_canvas("mock-project", {
        "elements": [
            {
                "id": "frame-1",
                "type": "frame",
                "contents": [{"contentId": "frame-1-content"}],
                "activeContentId": "frame-1-content",
                "mainContentId": "frame-1-content",
                "children": [
                    {
                        "id": "text-1",
                        "type": "text",
                        "contents": [{"contentId": "text-1-content", "content": []}],
                        "activeContentId": "text-1-content",
                        "mainContentId": "text-1-content",
                    },
                    unsupported_child,
                ],
            },
        ],
        "connections": [],
    })

    decoded = CanvasCodec.decode(source)
    frame = decoded.canvas.get_element("frame-1")
    assert frame is not None
    assert [child.element_id for child in frame.children or []] == ["text-1"]
    assert frame.opaque_children[0][1] == unsupported_child

    saved = CanvasCodec.decode(CanvasCodec.encode(decoded))
    saved_frame = saved.canvas.get_element("frame-1")
    assert saved_frame is not None
    assert saved_frame.opaque_children[0][1] == unsupported_child


def test_codec_skips_broken_supported_element_without_failing_project() -> None:
    """已支持节点损坏时跳过该节点，其它正常节点仍可读取和保存。"""
    broken = {
        "id": "image-broken",
        "type": "image",
        "contents": [{"contentId": "image-broken-content", "src": 123, "status": "not-a-status"}],
        "activeContentId": "image-broken-content",
        "mainContentId": "image-broken-content",
    }
    source = _encode_raw_canvas("mock-project", {
        "elements": [
            {
                "id": "image-1",
                "type": "image",
                "contents": [{"contentId": "image-1-content", "src": "./images/mock.png", "status": "completed"}],
                "activeContentId": "image-1-content",
                "mainContentId": "image-1-content",
            },
            broken,
            {
                "id": "text-1",
                "type": "text",
                "contents": [{"contentId": "text-1-content", "content": []}],
                "activeContentId": "text-1-content",
                "mainContentId": "text-1-content",
            },
        ],
        "connections": [
            {"id": "connection-1", "sourceElementId": "image-1", "targetElementId": "image-broken"},
            {"id": "connection-broken", "sourceElementId": "image-1"},
        ],
    })

    decoded = CanvasCodec.decode(source)

    assert [element.element_id for element in decoded.canvas.elements] == ["image-1", "text-1"]
    assert decoded.canvas.get_element("image-broken") is None
    assert decoded.canvas.opaque_elements[0][1] == broken
    assert [connection.connection_id for connection in decoded.canvas.connections] == ["connection-1"]
    assert decoded.canvas.opaque_connections[0][1]["id"] == "connection-broken"

    saved = CanvasCodec.decode(CanvasCodec.encode(decoded))
    assert [element.element_id for element in saved.canvas.elements] == ["image-1", "text-1"]
    assert saved.canvas.opaque_elements[0][1] == broken
    assert saved.canvas.connections[0].target_element_id == "image-broken"
    assert saved.canvas.opaque_connections[0][1]["id"] == "connection-broken"


def test_codec_skips_broken_supported_child_inside_frame() -> None:
    """Frame 内已支持但损坏的子节点跳过解析，其它子节点和父节点仍可用。"""
    broken_child = {
        "id": "text-broken",
        "type": "text",
        "contents": "not-an-array",
        "activeContentId": "text-broken-content",
        "mainContentId": "text-broken-content",
    }
    source = _encode_raw_canvas("mock-project", {
        "elements": [
            {
                "id": "frame-1",
                "type": "frame",
                "contents": [{"contentId": "frame-1-content"}],
                "activeContentId": "frame-1-content",
                "mainContentId": "frame-1-content",
                "children": [
                    {
                        "id": "text-1",
                        "type": "text",
                        "contents": [{"contentId": "text-1-content", "content": []}],
                        "activeContentId": "text-1-content",
                        "mainContentId": "text-1-content",
                    },
                    broken_child,
                ],
            },
        ],
        "connections": [],
    })

    decoded = CanvasCodec.decode(source)
    frame = decoded.canvas.get_element("frame-1")
    assert frame is not None
    assert [child.element_id for child in frame.children or []] == ["text-1"]
    assert frame.opaque_children[0][1] == broken_child

    saved = CanvasCodec.decode(CanvasCodec.encode(decoded))
    saved_frame = saved.canvas.get_element("frame-1")
    assert saved_frame is not None
    assert [child.element_id for child in saved_frame.children or []] == ["text-1"]
    assert saved_frame.opaque_children[0][1] == broken_child


@pytest.mark.asyncio
async def test_connection_replacement_is_atomic_and_idempotent(tmp_path) -> None:
    """替换连线时旧线和新线在同一事务内完成，重复新增不产生重复边。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    await application.add_elements(
        "mock-project",
        [
            {"item_ref": "a", "element_type": "text"},
            {"item_ref": "b", "element_type": "text"},
            {"item_ref": "c", "element_type": "text"},
        ],
    )
    project = await repository.read("mock-project")
    ids = [element.element_id for element in project.canvas.iter_elements()]
    added = await application.connections(
        "mock-project",
        [{"item_ref": "add", "source_element_id": ids[0], "target_element_id": ids[1]}],
    )
    connection_id = added["items"][0]["connection_id"]
    await application.connections(
        "mock-project",
        [{
            "item_ref": "replace",
            "source_element_id": ids[0],
            "target_element_id": ids[2],
            "replace_existing_connections": True,
            "remove_connection_ids": [connection_id],
        }],
    )
    current = await repository.read("mock-project")

    assert len(current.canvas.connections) == 1
    assert current.canvas.connections[0].target_element_id == ids[2]
    assert ConnectionInput(item_ref="remove", remove_connection_ids=[current.canvas.connections[0].connection_id])
    assert ManageCanvasConnections.code_mode_only is True


@pytest.mark.asyncio
async def test_connection_removal_rejects_unknown_ids_and_replays_known_deletions(tmp_path) -> None:
    """连线删除必须拒绝未知 ID，并允许已成功删除的精确 ID 幂等重放。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    await application.add_elements(
        "mock-project",
        [{"item_ref": "a", "element_type": "text"}, {"item_ref": "b", "element_type": "text"}],
    )
    project = await repository.read("mock-project")
    element_ids = [element.element_id for element in project.canvas.elements]
    added = await application.connections(
        "mock-project",
        [{"item_ref": "add", "source_element_id": element_ids[0], "target_element_id": element_ids[1]}],
    )
    connection_id = added["items"][0]["connection_id"]

    removed = await application.connections(
        "mock-project",
        [{"item_ref": "remove", "remove_connection_ids": [connection_id]}],
    )
    assert removed["items"][0]["status"] == "removed"

    replayed = await application.connections(
        "mock-project",
        [{"item_ref": "replay", "remove_connection_ids": [connection_id]}],
    )
    assert replayed["items"][0]["status"] == "already_removed"

    with pytest.raises(CanvasDomainError) as unknown:
        await application.connections(
            "mock-project",
            [{"item_ref": "unknown", "remove_connection_ids": ["connection-unknown"]}],
        )
    assert unknown.value.code == "CONNECTION_NOT_FOUND"


@pytest.mark.asyncio
async def test_initial_connections_use_each_current_item_as_anchor(tmp_path) -> None:
    """同批初始连线必须锚定各自 item，而不是批次最后一个 Element。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [
            {"item_ref": "a", "element_type": "text", "connections": [{"target_item_ref": "b"}]},
            {"item_ref": "b", "element_type": "text"},
            {"item_ref": "c", "element_type": "text", "connections": [{"source_item_ref": "b"}]},
        ],
    )
    ids = dict(zip(["a", "b", "c"], created["created_element_ids"], strict=True))
    project = await repository.read("mock-project")
    pairs = {(item.source_element_id, item.target_element_id) for item in project.canvas.connections}

    assert pairs == {(ids["a"], ids["b"]), (ids["b"], ids["c"])}


class MockSynchronousGenerationPort:
    """用于验证同步生成回写的 mock 端口。"""

    execution_mode = "sync"

    async def resolve_request_metadata(self, request, tool_context):
        """返回提交前即可确定的图片模型和生成模式。"""
        return {"model_id": "mock-image-model", "mode": "generate"}

    async def submit(self, request, tool_context):
        """返回固定的工作区相对图片路径。"""
        return GenerationSubmission("sync", "completed", output_uri="mock/images/result.png")


class MockAsynchronousGenerationPort:
    """用于验证异步任务串联的 mock 端口。"""

    execution_mode = "async"

    def __init__(self):
        """初始化查询次数。"""
        self.query_count = 0

    async def submit(self, request, tool_context):
        """返回稳定的 Canvas 与 provider 任务 ID。"""
        return GenerationSubmission(
            "async",
            "processing",
            generation_task_id="canvas-task-1",
            provider_task_id="provider-task-1",
            request_metadata={"model_id": "mock-video-model", "input_mode": "standard"},
            result_metadata={
                "generation_info": {
                    "input_mode": "standard",
                    "resolution": "720p",
                    "duration_seconds": 4,
                },
                "runtime": {"started_at": "2026-09-02 10:00:00"},
            },
        )

    async def query(self, request, tool_context):
        """返回固定完成状态和视频路径。"""
        self.query_count += 1
        return GenerationQueryResult(
            "completed",
            output_uri="./videos/result.mp4",
            result_metadata={
                "runtime": {
                    "finished_at": "2026-09-02 10:00:04",
                    "elapsed_seconds": 4,
                },
                "billing": {"points": 8},
            },
        )


class MockVideoMediaProbePort(FakeMediaProbePort):
    """返回与请求尺寸不同的 mock 视频尺寸，验证真实媒体尺寸回写。"""

    async def inspect_video(self, path):
        """返回竖屏视频尺寸，不依赖真实媒体文件。"""
        return VideoMediaInfo(1080, 1920, 4.0, False)


class MockFailedGenerationPort:
    """用于验证失败 Content 重试上限的 mock 端口。"""

    execution_mode = "sync"

    async def submit(self, request, tool_context):
        """始终返回失败结果。"""
        return GenerationSubmission("sync", "failed", error_message="mock generation failure")


class CountingFailedGenerationPort:
    """用于验证相同重试请求不会重复提交生成任务的 mock 端口。"""

    execution_mode = "sync"

    def __init__(self):
        """初始化提交计数。"""
        self.submit_count = 0

    async def submit(self, request, tool_context):
        """每次调用都返回失败，但保留提交次数。"""
        self.submit_count += 1
        return GenerationSubmission("sync", "failed", error_message="mock generation failure")


class MockIncompleteAsynchronousGenerationPort:
    """用于验证异步提交必须同时返回两类任务标识的 mock 端口。"""

    execution_mode = "async"

    async def submit(self, request, tool_context):
        """只返回 provider 标识，模拟不完整的异步响应。"""
        return GenerationSubmission("async", "processing", provider_task_id="provider-only")


class MockRetryableAsynchronousGenerationPort:
    """用于验证异步重试任务携带正确 retry_count 的 mock 端口。"""

    execution_mode = "async"

    def __init__(self):
        """初始化提交次数。"""
        self.submit_count = 0

    async def submit(self, request, tool_context):
        """为每次尝试返回唯一的 Canvas 和 provider 任务标识。"""
        self.submit_count += 1
        return GenerationSubmission(
            "async",
            "processing",
            generation_task_id=f"retry-canvas-task-{self.submit_count}",
            provider_task_id=f"retry-provider-task-{self.submit_count}",
        )

    async def query(self, request, tool_context):
        """让每次等待都以失败终止，从而进入下一次受控重试。"""
        return GenerationQueryResult("failed", error_message="mock retry failure")


@pytest.mark.asyncio
async def test_generation_strategies_write_sync_result_and_wait_async_result(tmp_path) -> None:
    """同步结果直接回写，异步结果通过同一任务 ID 等待后回写。"""
    image_port = MockSynchronousGenerationPort()
    video_port = MockAsynchronousGenerationPort()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("mock-image", "image", "sync", image_port),
        GenerationCapability("mock-video", "video", "async", video_port, video_port),
    ])
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        media_probe_port=MockVideoMediaProbePort(),
    )
    await application.initialize("mock-project")
    await async_write_bytes(tmp_path / "mock-project" / "videos" / "result.mp4", b"mock-video")

    image_result = await application.add_elements(
        "mock-project",
        [{"item_ref": "image", "element_type": "image", "content": {"source": "generated", "content_type": "image", "prompt": "mock", "name": "mock image"}}],
    )
    video_result = await application.add_elements(
        "mock-project",
        [{"item_ref": "video", "element_type": "video", "content": {"source": "generated", "content_type": "video", "prompt": "mock"}}],
    )
    pending_project = await repository.read("mock-project")
    pending_video = pending_project.canvas.get_element(video_result["items"][0]["element_id"])
    pending_content = pending_video.get_content(pending_video.active_content_id)
    pending_sidecar = await repository.read_sidecar("mock-project")
    pending_detail = pending_sidecar["elements"][pending_video.element_id]["contentDetails"][pending_content.content_id]
    assert pending_content.fields.video_generation_result_meta["generation_info"]["input_mode"] == "standard"
    assert "videoGenerationResultMeta" not in pending_detail
    waited = await application.wait("mock-project", ["canvas-task-1"], max_wait_seconds=1)
    waited_again = await application.wait("mock-project", ["canvas-task-1"], max_wait_seconds=1)
    project = await repository.read("mock-project")

    image = project.canvas.get_element(image_result["items"][0]["element_id"])
    video = project.canvas.get_element(video_result["items"][0]["element_id"])
    assert image.get_content(image.active_content_id).fields.src == "mock/images/result.png"
    sidecar = await repository.read_sidecar("mock-project")
    image_detail = sidecar["elements"][image.element_id]["contentDetails"][image.active_content_id]
    assert image_detail["generateImageRequest"]["model_id"] == "mock-image-model"
    assert video_result["items"][0]["generation_task_id"] == "canvas-task-1"
    assert waited["items"][0]["status"] == "completed"
    assert waited_again["items"][0]["already_finalized"] is True
    assert video_port.query_count == 1
    assert video.get_content(video.active_content_id).fields.src == "./videos/result.mp4"
    assert (video.properties.width, video.properties.height) == (1080, 1920)
    sidecar = await repository.read_sidecar("mock-project")
    video_detail = sidecar["elements"][video.element_id]["contentDetails"][video.active_content_id]
    assert video_detail["generateVideoRequest"]["model_id"] == "mock-video-model"
    assert video_detail["generateVideoRequest"]["input_mode"] == "standard"
    assert "videoGenerationResultMeta" not in video_detail
    assert video.get_content(video.active_content_id).fields.video_generation_result_meta == {
        "generation_info": {
            "input_mode": "standard",
            "resolution": "720p",
            "duration_seconds": 4,
        },
        "runtime": {
            "started_at": "2026-09-02 10:00:00",
            "finished_at": "2026-09-02 10:00:04",
            "elapsed_seconds": 4,
        },
        "billing": {"points": 8},
    }


@pytest.mark.asyncio
async def test_async_generation_requires_canvas_and_provider_task_ids() -> None:
    """异步任务缺少任一任务标识时必须拒绝，避免模型无法继续等待。"""
    capability = GenerationCapability(
        "incomplete",
        "video",
        "async",
        MockIncompleteAsynchronousGenerationPort(),
        MockIncompleteAsynchronousGenerationPort(),
    )

    with pytest.raises(CanvasDomainError) as error:
        await AsynchronousGenerationStrategy().execute(
            capability,
            GenerationRequest("mock-project", "video-1", "content-1", "video"),
            None,
        )

    assert error.value.code == "GENERATION_TASK_ID_MISSING"


@pytest.mark.asyncio
async def test_async_retry_count_is_carried_to_each_generation_task(tmp_path) -> None:
    """异步重试的任务记录必须携带当前 Content 的 retry_count。"""
    port = MockRetryableAsynchronousGenerationPort()
    tasks = InMemoryGenerationTaskRepository()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("mock-retry-video", "video", "async", port, port),
    ])
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        generation_tasks=tasks,
    )
    await application.initialize("mock-project")

    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "video",
            "element_type": "video",
            "content": {"source": "generated", "content_type": "video", "prompt": "mock"},
        }],
    )
    element_id = created["items"][0]["element_id"]
    content_id = created["items"][0]["content_id"]
    await application.wait("mock-project", ["retry-canvas-task-1"], max_wait_seconds=1)

    retried = await application.retry_content(
        "mock-project",
        [{"item_ref": "retry-one", "element_id": element_id, "content_id": content_id}],
    )
    assert retried["items"][0]["generation_task_id"] == "retry-canvas-task-2"
    first_retry_task = await tasks.get("retry-canvas-task-2")
    assert isinstance(first_retry_task, GenerationTask)
    assert first_retry_task.retry_count == 1
    await application.wait("mock-project", ["retry-canvas-task-2"], max_wait_seconds=1)

    retried_again = await application.retry_content(
        "mock-project",
        [{"item_ref": "retry-two", "element_id": element_id, "content_id": content_id}],
    )
    assert retried_again["items"][0]["generation_task_id"] == "retry-canvas-task-3"
    second_retry_task = await tasks.get("retry-canvas-task-3")
    assert isinstance(second_retry_task, GenerationTask)
    assert second_retry_task.retry_count == 2


def test_hierarchy_mutation_plan_replaces_selected_root_elements_in_order() -> None:
    """层级变更计划应用后应保留未选节点顺序并在首个选中位置插入 Frame。"""
    canvas = CanvasDocument(
        elements=[
            CanvasElement("a", "text"),
            CanvasElement("b", "image"),
            CanvasElement("c", "video"),
        ]
    )
    frame = CanvasElement("frame-1", "frame", children=[])

    HierarchyMutationPlan(frame=frame, selected_ids=("b", "c"), root_insert_index=1).apply(canvas)

    assert [element.element_id for element in canvas.elements] == ["a", "frame-1"]


@pytest.mark.asyncio
async def test_add_first_content_to_empty_element_initializes_content_pointers(tmp_path) -> None:
    """空 Element 首次追加 Content 时应初始化 active 和 main 指针。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{"item_ref": "empty", "element_type": "text"}],
    )
    element_id = created["items"][0]["element_id"]

    result = await application.add_contents(
        "mock-project",
        [{
            "item_ref": "first-content",
            "element_id": element_id,
            "content": {"source": "user", "content_type": "text", "content": [{"text": "mock"}]},
        }],
    )
    project = await repository.read("mock-project")
    element = project.canvas.get_element(element_id)
    content_id = result["items"][0]["content_id"]

    assert element.active_content_id == content_id
    assert element.main_content_id == content_id


@pytest.mark.asyncio
async def test_add_contents_materializes_imported_asset_into_project(tmp_path) -> None:
    """向已有 Element 追加 imported Content 时也应使用项目内 URI。"""
    asset = tmp_path / "uploads" / "mock.mp3"
    asset.parent.mkdir(parents=True)
    asset.write_bytes(b"mock-audio")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{"item_ref": "audio", "element_type": "audio"}],
    )

    result = await application.add_contents(
        "mock-project",
        [{
            "item_ref": "imported-audio",
            "element_id": created["items"][0]["element_id"],
            "content": {
                "source": "imported",
                "content_type": "audio",
                "asset_path": "uploads/mock.mp3",
            },
        }],
    )

    project = await repository.read("mock-project")
    element = project.canvas.get_element(created["items"][0]["element_id"])
    content = element.get_content(result["items"][0]["content_id"])
    assert content.fields.src.startswith("./audios/")
    assert len(list((tmp_path / "mock-project" / "audios").glob("*"))) == 1


@pytest.mark.asyncio
async def test_imported_asset_accepts_absolute_path_outside_workspace(tmp_path) -> None:
    """导入媒体应允许用户明确提供工作区外的本机绝对路径。"""
    workspace = tmp_path / "workspace"
    external_asset = tmp_path / "external" / "mock.png"
    external_asset.parent.mkdir(parents=True)
    external_asset.write_bytes(b"mock-image")
    repository = CanvasRepository(workspace)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    result = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "external-image",
            "element_type": "image",
            "content": {
                "source": "imported",
                "content_type": "image",
                "asset_path": str(external_asset),
            },
        }],
    )

    assert result["items"][0]["asset_path"].startswith("./images/")
    assert (workspace / "mock-project" / "images" / "mock.png").is_file()


@pytest.mark.asyncio
async def test_imported_asset_is_materialized_idempotently_and_reusable(tmp_path) -> None:
    """重复导入同一 imported 素材时复用已有 Element 和项目文件。"""
    asset = tmp_path / "uploads" / "mock.png"
    asset.parent.mkdir(parents=True)
    asset.write_bytes(b"mock-image")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    first_result = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "asset-one",
            "element_type": "image",
            "content": {
                "source": "imported",
                "content_type": "image",
                "asset_path": "uploads/mock.png",
            },
        }],
    )

    second = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "asset-two",
            "element_type": "image",
            "content": {
                "source": "imported",
                "content_type": "image",
                "asset_path": "uploads/mock.png",
            },
        }],
    )

    project = await repository.read("mock-project")
    first = project.canvas.get_element(first_result["items"][0]["element_id"])
    second_element = project.canvas.get_element(second["items"][0]["element_id"])
    first_uri = first.get_content(first.main_content_id).fields.src
    second_uri = second_element.get_content(second_element.main_content_id).fields.src

    assert second["items"][0]["status"] == "reused"
    assert second["items"][0]["element_id"] == first.element_id
    assert second["created_element_ids"] == []
    assert first_uri == second_uri
    assert first_uri == "./images/mock.png"
    assert first_result["items"][0]["asset_path"] == first_uri
    assert second["items"][0]["asset_path"] == first_uri
    assert asset.exists()
    assert len(list((tmp_path / "mock-project" / "images").glob("*"))) == 1
    assert len(project.canvas.elements) == 1
    details = await repository.read_sidecar_runtime("mock-project")
    assert details["elements"][first.element_id]["contentDetails"][first.main_content_id]["assetPath"] == first_uri


@pytest.mark.asyncio
async def test_imported_asset_conflict_keeps_original_name_and_adds_unique_suffix(tmp_path) -> None:
    """同名不同内容的导入素材不覆盖旧文件，并返回带唯一后缀的新路径。"""
    first_asset = tmp_path / "uploads" / "mock.png"
    first_asset.parent.mkdir(parents=True)
    first_asset.write_bytes(b"mock-image-one")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    first = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "asset-one",
            "element_type": "image",
            "content": {"source": "imported", "content_type": "image", "asset_path": "uploads/mock.png"},
        }],
    )

    first_asset.write_bytes(b"mock-image-two")
    second = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "asset-two",
            "element_type": "image",
            "content": {"source": "imported", "content_type": "image", "asset_path": "uploads/mock.png"},
        }],
    )

    first_path = first["items"][0]["asset_path"]
    second_path = second["items"][0]["asset_path"]
    assert first_path == "./images/mock.png"
    assert second_path.startswith("./images/mock-")
    assert second_path.endswith(".png")
    assert len(list((tmp_path / "mock-project" / "images").glob("*.png"))) == 2


@pytest.mark.asyncio
async def test_imported_image_video_audio_use_type_directories_and_project_uris(tmp_path) -> None:
    """图片、视频和音频导入后分别落入项目标准目录。"""
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    (uploads / "mock.png").write_bytes(b"mock-image")
    (uploads / "mock.mp4").write_bytes(b"mock-video")
    (uploads / "mock.mp3").write_bytes(b"mock-audio")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    await application.add_elements(
        "mock-project",
        [
            {"item_ref": "image", "element_type": "image", "content": {"source": "imported", "content_type": "image", "asset_path": "uploads/mock.png"}},
            {"item_ref": "video", "element_type": "video", "content": {"source": "imported", "content_type": "video", "asset_path": "uploads/mock.mp4"}},
            {"item_ref": "audio", "element_type": "audio", "content": {"source": "imported", "content_type": "audio", "asset_path": "uploads/mock.mp3"}},
        ],
    )

    project = await repository.read("mock-project")
    uris = {
        element.element_type: element.get_content(element.main_content_id).fields.src
        for element in project.canvas.elements
    }
    assert uris["image"].startswith("./images/")
    assert uris["video"].startswith("./videos/")
    assert uris["audio"].startswith("./audios/")
    assert len(list((tmp_path / "mock-project" / "images").glob("*"))) == 1
    assert len(list((tmp_path / "mock-project" / "videos").glob("*"))) == 1
    assert len(list((tmp_path / "mock-project" / "audios").glob("*"))) == 1


@pytest.mark.asyncio
async def test_imported_asset_batch_failure_removes_new_materialized_files(tmp_path) -> None:
    """批量事务失败时应删除本次新增的项目素材。"""
    asset = tmp_path / "uploads" / "mock.png"
    asset.parent.mkdir(parents=True)
    asset.write_bytes(b"mock-image")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    with pytest.raises(CanvasBatchError):
        await application.add_elements(
            "mock-project",
            [
                {"item_ref": "asset", "element_type": "image", "content": {"source": "imported", "content_type": "image", "asset_path": "uploads/mock.png"}},
                {"item_ref": "invalid", "element_type": "not-supported"},
            ],
        )

    images_directory = tmp_path / "mock-project" / "images"
    assert not list(images_directory.glob("*"))


@pytest.mark.asyncio
async def test_imported_asset_rejects_mismatched_extension(tmp_path) -> None:
    """导入媒体的扩展名必须与 Content 类型匹配。"""
    asset = tmp_path / "uploads" / "mock.png"
    asset.parent.mkdir(parents=True)
    asset.write_bytes(b"mock-image")
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    with pytest.raises(CanvasDomainError) as error:
        await application.add_elements(
            "mock-project",
            [{"item_ref": "wrong", "element_type": "video", "content": {"source": "imported", "content_type": "video", "asset_path": "uploads/mock.png"}}],
        )

    assert error.value.code == "ASSET_TYPE_MISMATCH"


@pytest.mark.asyncio
async def test_video_edit_creation_validates_media_types_and_explicit_connections(tmp_path) -> None:
    """创建 Video Edit 时必须由调用方显式连接全部类型正确的媒体输入。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    media = await application.add_elements(
        "mock-project",
        [
            {"item_ref": "video", "element_type": "video"},
            {"item_ref": "audio", "element_type": "audio"},
        ],
    )
    video_id, audio_id = [item["element_id"] for item in media["items"]]

    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "edit",
            "element_type": "video-edit",
            "connections": [
                {"source_element_id": video_id},
                {"source_element_id": audio_id},
            ],
            "content": {
                "source": "user",
                "content_type": "video-edit",
                "videoSequence": [video_id],
                "audioSequence": [audio_id],
            },
        }],
    )

    edit_id = created["items"][0]["element_id"]
    project = await repository.read("mock-project")
    edit = project.canvas.get_element(edit_id)
    assert (edit.properties.width, edit.properties.height) == (520.0, 360.0)
    incoming = {
        connection.source_element_id
        for connection in project.canvas.connections
        if connection.target_element_id == edit_id
    }
    assert incoming == {video_id, audio_id}


@pytest.mark.asyncio
async def test_video_edit_creation_rolls_back_when_input_connection_is_missing(tmp_path) -> None:
    """Video Edit 缺少序列对应的显式 Connection 时必须整体回滚。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    media = await application.add_elements(
        "mock-project",
        [{"item_ref": "video", "element_type": "video"}],
    )
    video_id = media["items"][0]["element_id"]

    with pytest.raises(CanvasDomainError) as error:
        await application.add_elements(
            "mock-project",
            [{
                "item_ref": "edit",
                "element_type": "video-edit",
                "content": {
                    "source": "user",
                    "content_type": "video-edit",
                    "videoSequence": [video_id],
                },
            }],
        )

    assert error.value.code == "VIDEO_EDIT_CONNECTION_MISSING"
    assert (await application.overview("mock-project", 1, 50))["total_elements"] == 1


@pytest.mark.asyncio
async def test_video_edit_creation_rejects_wrong_sequence_element_type(tmp_path) -> None:
    """videoSequence 引用非 Video Element 时必须在创建事务内拒绝。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    media = await application.add_elements(
        "mock-project",
        [{"item_ref": "audio", "element_type": "audio"}],
    )
    audio_id = media["items"][0]["element_id"]

    with pytest.raises(CanvasDomainError) as error:
        await application.add_elements(
            "mock-project",
            [{
                "item_ref": "edit",
                "element_type": "video-edit",
                "connections": [{"source_element_id": audio_id}],
                "content": {
                    "source": "user",
                    "content_type": "video-edit",
                    "videoSequence": [audio_id],
                },
            }],
        )

    assert error.value.code == "VIDEO_EDIT_INPUT_TYPE_MISMATCH"


@pytest.mark.asyncio
async def test_generated_image_persists_project_uri_dimensions_and_sidecar_request(tmp_path) -> None:
    """生成图片写入项目 URI 和尺寸，主文件不暴露生成请求。"""
    repository = CanvasRepository(tmp_path)
    port = FakeImageGenerationPort(tmp_path)
    registry = GenerationCapabilityRegistry([
        GenerationCapability("mock-image", "image", "sync", port),
    ])
    application = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        media_probe_port=FakeMediaProbePort(),
    )
    await application.initialize("mock-project")

    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "image",
            "element_type": "image",
            "content": {
                "source": "generated",
                "content_type": "image",
                "prompt": "mock perfume bottle",
                "name": "mock perfume bottle",
                "size": "1728x2304",
            },
        }],
    )

    element_id = created["items"][0]["element_id"]
    content_id = created["items"][0]["content_id"]
    project = await repository.read("mock-project")
    element = project.canvas.get_element(element_id)
    content = element.get_content(content_id)
    assert content.fields.src.startswith("./images/mock perfume bottle_")
    assert content.fields.src.endswith(".png")
    assert content.fields.src[-18:-4].isdigit()
    assert (element.properties.width, element.properties.height) == (800, 600)
    assert "generateImageRequest" not in content.fields.to_dict()

    sidecar = await repository.read_sidecar("mock-project")
    detail = sidecar["elements"][element_id]["contentDetails"][content_id]
    assert set(detail) == {"generateImageRequest"}
    assert detail["generateImageRequest"]["prompt"] == "mock perfume bottle"
    assert detail["generateImageRequest"]["size"] == "1728x2304"
    assert "generationParameters" not in detail
    runtime = await repository.read_sidecar_runtime("mock-project")
    runtime_detail = runtime["elements"][element_id]["contentDetails"][content_id]
    assert runtime_detail["generationParameters"]["size"] == "1728x2304"


@pytest.mark.asyncio
async def test_sizing_only_applies_to_media_elements(tmp_path) -> None:
    """文本和形状元素不应被后端强制写入默认宽高，媒体元素使用类型默认值。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [
            {"item_ref": "title", "element_type": "text", "content": {"source": "user", "content_type": "text", "content": [{"text": "mock"}]}},
            {"item_ref": "box", "element_type": "rectangle", "content": {"source": "user", "content_type": "rectangle", "fill": "#000000"}},
            {"item_ref": "clip", "element_type": "video"},
            {"item_ref": "voice", "element_type": "audio"},
        ],
    )
    project = await repository.read("mock-project")
    title = project.canvas.get_element(created["items"][0]["element_id"])
    box = project.canvas.get_element(created["items"][1]["element_id"])
    clip = project.canvas.get_element(created["items"][2]["element_id"])
    voice = project.canvas.get_element(created["items"][3]["element_id"])

    assert title.properties.width is None
    assert title.properties.height is None
    assert box.properties.width is None
    assert box.properties.height is None
    assert (clip.properties.width, clip.properties.height) == (1280.0, 720.0)
    assert (voice.properties.width, voice.properties.height) == (480.0, 120.0)


@pytest.mark.asyncio
async def test_generated_content_retry_is_limited_and_reuses_content_id(tmp_path) -> None:
    """失败 generated Content 最多重试两次，且始终复用原 Content ID。"""
    failed_port = MockFailedGenerationPort()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("mock-image", "image", "sync", failed_port),
    ])
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository, generation_capabilities=registry)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "image",
            "element_type": "image",
            "content": {"source": "generated", "content_type": "image", "prompt": "mock", "name": "mock image"},
        }],
    )
    element_id = created["items"][0]["element_id"]
    content_id = created["items"][0]["content_id"]

    for retry_index in range(2):
        result = await application.retry_content(
            "mock-project",
            [{
                "item_ref": f"retry-{retry_index}",
                "element_id": element_id,
                "content_id": content_id,
                "generation_override": {"prompt": f"mock-{retry_index}"},
            }],
        )
        assert result["items"][0]["content_id"] == content_id
        assert result["items"][0]["status"] == "failed"

    with pytest.raises(CanvasDomainError) as error:
        await application.retry_content(
            "mock-project",
            [{"item_ref": "retry-limit", "element_id": element_id, "content_id": content_id}],
        )

    assert error.value.code == "CONTENT_RETRY_LIMIT_REACHED"


@pytest.mark.asyncio
async def test_identical_retry_request_is_idempotent(tmp_path) -> None:
    """相同 item_ref 和生成输入的重试重放不能再次提交 provider 任务。"""
    port = CountingFailedGenerationPort()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("mock-image", "image", "sync", port),
    ])
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository, generation_capabilities=registry)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "image",
            "element_type": "image",
            "content": {"source": "generated", "content_type": "image", "prompt": "mock", "name": "mock image"},
        }],
    )
    element_id = created["items"][0]["element_id"]
    content_id = created["items"][0]["content_id"]
    request = [{
        "item_ref": "same-retry",
        "element_id": element_id,
        "content_id": content_id,
        "generation_override": {"prompt": "same retry"},
    }]

    first = await application.retry_content("mock-project", request)
    replay = await application.retry_content("mock-project", request)

    assert first["items"][0]["status"] == "failed"
    assert replay["items"][0]["idempotent_replay"] is True
    assert port.submit_count == 2
    details = await application.elements("mock-project", [element_id])
    assert details["elements"][0]["contents"][0]["retry_count"] == 1


@pytest.mark.asyncio
async def test_element_details_use_public_names_when_sidecar_is_damaged(tmp_path) -> None:
    """详情查询在扩展详情损坏时仍返回公开 DTO，不泄露内部文件名。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{
            "item_ref": "text",
            "element_type": "text",
            "content": {"source": "user", "content_type": "text", "content": [{"text": "mock"}]},
        }],
    )
    (tmp_path / "mock-project" / "element-details.json").write_text("not-json", encoding="utf-8")

    details = await application.elements("mock-project", [created["items"][0]["element_id"]])

    assert details["details_complete"] is False
    assert details["elements"][0]["element_id"] == created["items"][0]["element_id"]
    assert details["elements"][0]["contents"][0]["content_id"] == created["items"][0]["content_id"]
    assert all("element-details" not in warning for warning in details["warnings"])


async def _create_positioned_elements(tmp_path):
    """创建带有 mock 几何信息的根级 Element。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [
            {"item_ref": "first", "element_type": "image"},
            {"item_ref": "second", "element_type": "image"},
            {"item_ref": "third", "element_type": "image"},
        ],
    )
    ids = dict(zip(("first", "second", "third"), created["created_element_ids"], strict=True))

    def set_geometry(project):
        """写入测试专用的几何字段。"""
        values = {
            ids["first"]: {"x": 100, "y": 200, "width": 100, "height": 80, "zIndex": 1},
            ids["second"]: {"x": 300, "y": 260, "width": 120, "height": 90, "zIndex": 2},
            ids["third"]: {"x": 600, "y": 100, "width": 80, "height": 80, "zIndex": 3},
        }
        for element in project.canvas.elements:
            properties = values[element.element_id]
            for key, value in properties.items():
                setattr(element.properties, {"zIndex": "z_index"}.get(key, key), value)
        content = CanvasContent("first-content", ImageContentFields(src="./images/mock.png", status="completed"))
        project.canvas.get_element(ids["first"]).contents.append(content)
        project.canvas.get_element(ids["first"]).active_content_id = content.content_id
        project.canvas.get_element(ids["first"]).main_content_id = content.content_id

    await repository.transaction("mock-project", set_geometry)
    return repository, application, ids


@pytest.mark.asyncio
async def test_frame_selection_preserves_ids_connections_and_converts_to_local_coordinates(tmp_path) -> None:
    """框选应保留 Element/Content/Connection 标识，并转换为 Frame 局部坐标。"""
    repository, application, ids = await _create_positioned_elements(tmp_path)
    connection = await application.connections(
        "mock-project",
        [{"item_ref": "link", "source_element_id": ids["first"], "target_element_id": ids["third"]}],
    )
    connection_id = connection["items"][0]["connection_id"]
    before = await repository.read("mock-project")
    first_content_id = before.canvas.get_element(ids["first"]).active_content_id

    framed = await application.frame_elements(
        "mock-project",
        [{"item_ref": "frame", "element_ids": [ids["first"], ids["second"]]}],
    )
    frame_id = framed["items"][0]["frame_element_id"]
    frame = (await repository.read("mock-project")).canvas.get_element(frame_id)
    first = frame.children[0]
    second = frame.children[1]

    assert framed["items"][0]["child_element_ids"] == [ids["first"], ids["second"]]
    assert frame.element_type == "frame"
    assert frame.active_content_id == framed["items"][0]["content_id"]
    assert first.element_id == ids["first"]
    assert second.element_id == ids["second"]
    assert first.properties.x == pytest.approx(100 / 1 - frame.properties.x)
    assert second.properties.y == pytest.approx(260 - frame.properties.y)
    assert first.contents[0].content_id == first_content_id
    assert any(
        item.connection_id == connection_id
        and item.source_element_id == ids["first"]
        and item.target_element_id == ids["third"]
        for item in (await repository.read("mock-project")).canvas.connections
    )

    details = await application.elements("mock-project", [frame_id, ids["first"]])
    frame_detail = details["elements"][0]
    child_detail = details["elements"][1]
    assert frame_detail["parent_element_id"] is None
    assert frame_detail["depth"] == 0
    assert frame_detail["child_element_ids"] == [ids["first"], ids["second"]]
    assert child_detail["parent_element_id"] == frame_id
    assert child_detail["depth"] == 1


@pytest.mark.asyncio
async def test_frame_selection_uses_explicit_and_default_padding(tmp_path) -> None:
    """默认 padding 和显式 padding 都必须写入稳定的 Frame 几何结果。"""
    _, application, ids = await _create_positioned_elements(tmp_path)

    default_result = await application.frame_elements(
        "mock-project",
        [{"item_ref": "default", "element_ids": [ids["first"], ids["second"]]}],
    )
    default_padding = default_result["items"][0]["padding"]
    assert default_padding == pytest.approx(320 / 18)

    _, application, ids = await _create_positioned_elements(tmp_path / "explicit")
    explicit_result = await application.frame_elements(
        "mock-project",
        [{"item_ref": "explicit", "element_ids": [ids["first"], ids["second"]], "padding": 12.5}],
    )
    assert explicit_result["items"][0]["padding"] == pytest.approx(12.5)


@pytest.mark.asyncio
async def test_frame_selection_rejects_nested_and_mixed_batch_items(tmp_path) -> None:
    """已嵌套节点、重复选区和混合批次必须整体拒绝。"""
    _, application, ids = await _create_positioned_elements(tmp_path)
    framed = await application.frame_elements(
        "mock-project",
        [{"item_ref": "frame", "element_ids": [ids["first"], ids["second"]]}],
    )
    frame_id = framed["items"][0]["frame_element_id"]

    with pytest.raises(CanvasDomainError) as nested_error:
        await application.frame_elements(
            "mock-project",
            [{"item_ref": "nested", "element_ids": [ids["first"], ids["third"]]}],
        )
    assert nested_error.value.code == "FRAME_SELECTION_ALREADY_NESTED"

    with pytest.raises(CanvasBatchError) as overlap_error:
        await application.frame_elements(
            "mock-project",
            [
                {"item_ref": "one", "element_ids": [ids["third"]]},
                {"item_ref": "two", "element_ids": [ids["third"]]},
            ],
        )
    assert overlap_error.value.code == "BATCH_VALIDATION_FAILED"
    assert overlap_error.value.items == [
        {
            "item_ref": "one",
            "status": "not_applied",
            "error_code": "BATCH_VALIDATION_FAILED",
            "reason": "The atomic batch was not written because another item failed validation.",
        },
        {
            "item_ref": "two",
            "status": "failed",
            "error_code": "FRAME_SELECTION_OVERLAP",
            "reason": "Frame selections in one batch cannot overlap.",
        },
    ]
    assert (await application.elements("mock-project", [frame_id]))["elements"][0]["child_element_ids"] == [ids["first"], ids["second"]]


@pytest.mark.asyncio
async def test_layout_uses_direct_parent_local_coordinates_and_rejects_cross_container_flow(tmp_path) -> None:
    """布局只使用直接父级兄弟节点，并拒绝跨容器依赖流程。"""
    repository, application, ids = await _create_positioned_elements(tmp_path)
    framed = await application.frame_elements(
        "mock-project",
        [{"item_ref": "frame", "element_ids": [ids["first"], ids["second"]]}],
    )
    frame_id = framed["items"][0]["frame_element_id"]

    def add_local_child(project):
        """添加一个测试用的 Frame 子节点，坐标使用局部空间。"""
        frame = project.canvas.get_element(frame_id)
        frame.children.append(CanvasElement("local-target", "image", ElementProperties(width=100, height=80)))

    await repository.transaction("mock-project", add_local_child)
    result = await application.layout(
        "mock-project",
        [{"item_ref": "local", "element_id": "local-target", "layout": {"strategy": "row_incremental"}}],
    )
    assert result["items"][0]["element_id"] == "local-target"
    local_target = (await repository.read("mock-project")).canvas.get_element("local-target")
    assert local_target.properties.x == pytest.approx(300 + 120 + 200 - (100 - 320 / 18))

    await application.connections(
        "mock-project",
        [{"item_ref": "cross", "source_element_id": ids["third"], "target_element_id": "local-target"}],
    )
    with pytest.raises(CanvasDomainError) as cross_error:
        await application.layout(
            "mock-project",
            [{"item_ref": "flow", "element_id": "local-target", "layout": {"strategy": "dependency_flow"}}],
        )
    assert cross_error.value.code == "LAYOUT_CROSS_CONTAINER_UNSUPPORTED"


@pytest.mark.asyncio
async def test_frame_tools_reject_content_main_and_retry_but_allow_connections(tmp_path) -> None:
    """Frame 只允许结构相关操作，普通 Content 和生成操作必须有明确门禁。"""
    _, application, ids = await _create_positioned_elements(tmp_path)
    framed = await application.frame_elements(
        "mock-project",
        [{"item_ref": "frame", "element_ids": [ids["first"], ids["second"]]}],
    )
    frame_id = framed["items"][0]["frame_element_id"]
    frame_content_id = framed["items"][0]["content_id"]

    with pytest.raises(CanvasDomainError) as content_error:
        await application.add_contents(
            "mock-project",
            [{"item_ref": "content", "element_id": frame_id, "content": {"source": "user", "content_type": "text", "content": [{"text": "no"}]}}],
        )
    assert content_error.value.code == "FRAME_CONTENT_MANAGED_INTERNAL"

    with pytest.raises(CanvasDomainError) as retry_error:
        await application.retry_content(
            "mock-project",
            [{"item_ref": "retry", "element_id": frame_id, "content_id": frame_content_id}],
        )
    assert retry_error.value.code == "CONTENT_RETRY_NOT_ALLOWED"

    with pytest.raises(CanvasDomainError) as main_error:
        await application.select_main(
            "mock-project",
            [{"item_ref": "main", "element_id": frame_id, "content_id": frame_content_id}],
        )
    assert main_error.value.code == "FRAME_CONTENT_MANAGED_INTERNAL"

    connection = await application.connections(
        "mock-project",
        [{"item_ref": "frame-link", "source_element_id": frame_id, "target_element_id": ids["third"]}],
    )
    assert connection["items"][0]["status"] == "added"


@pytest.mark.asyncio
async def test_wait_returns_stable_not_applicable_error_for_frame_task(tmp_path) -> None:
    """即使出现错误绑定，等待工具也必须明确拒绝 Frame 任务。"""
    repository = CanvasRepository(tmp_path)
    tasks = InMemoryGenerationTaskRepository()
    application = CanvasApplicationFactory.create(repository, generation_tasks=tasks)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{"item_ref": "frame", "element_type": "frame"}],
    )
    await tasks.put(GenerationTask(
        generation_task_id="frame-task",
        provider_task_id="provider-task",
        project_path="mock-project",
        element_id=created["items"][0]["element_id"],
        content_id=created["items"][0]["content_id"],
        element_type="frame",
        capability_name="invalid",
        status="processing",
    ))

    result = await application.wait("mock-project", ["frame-task"], max_wait_seconds=1)

    assert result["items"][0]["status"] == "not_applicable"
    assert result["items"][0]["error_code"] == "FRAME_GENERATION_NOT_APPLICABLE"


def test_strategy_registries_return_typed_plans() -> None:
    """布局、Content 和 Connection Registry 都应返回独立的强类型计划。"""
    canvas = CanvasDocument(elements=[CanvasElement("source", "text"), CanvasElement("target", "text")])
    layout_plan = LayoutStrategyRegistry().get("row_incremental").plan(
        canvas,
        canvas.get_element("source"),
        LayoutStrategyRequest("source", {"strategy": "row_incremental"}),
    )
    content_plan = ContentStrategyRegistry().plan(
        ContentCommand(source="user", content_type="text", fields=TextContentFields(content=[{"children": [{"type": "text", "text": "mock"}]}]), content_id="content-1"),
        "text",
    )
    connection_plan = ConnectionStrategyRegistry().plan(canvas, "source", "target")

    assert isinstance(layout_plan, LayoutMutationPlan)
    assert isinstance(content_plan, ContentMutationPlan)
    assert isinstance(connection_plan, ConnectionMutationPlan)


def test_dependency_flow_centers_target_between_multiple_sources() -> None:
    """多上游依赖布局应按来源整体居中，不受 Connection 顺序影响。"""
    canvas = CanvasDocument(elements=[
        CanvasElement("source-top", "video", ElementProperties(x=0, y=0, width=200, height=100)),
        CanvasElement("source-bottom", "video", ElementProperties(x=0, y=300, width=200, height=100)),
        CanvasElement("target", "video", ElementProperties(width=100, height=100)),
    ])
    canvas.connections.extend([
        CanvasConnection("connection-bottom", "source-bottom", "target"),
        CanvasConnection("connection-top", "source-top", "target"),
    ])

    layout_plan = LayoutStrategyRegistry().get("dependency_flow").plan(
        canvas,
        canvas.get_element("target"),
        LayoutStrategyRequest("target", {"strategy": "dependency_flow"}),
    )

    assert layout_plan.properties.x == pytest.approx(760)
    assert layout_plan.properties.y == pytest.approx(150)


def test_generation_capability_registry_selects_model_specific_capability() -> None:
    """同一 Element 类型可根据模型选择不同的执行方式。"""
    class Port:
        execution_mode = "sync"

    default = GenerationCapability("default-image", "image", "sync", Port())
    model_specific = GenerationCapability("async-image-model", "image", "async", Port(), Port(), "model-x")
    registry = GenerationCapabilityRegistry([default, model_specific])

    assert registry.get("image", "model-x").name == "async-image-model"
    assert registry.get("image", "other-model").name == "default-image"
    assert registry.get_by_name("async-image-model", "image").execution_mode == "async"
