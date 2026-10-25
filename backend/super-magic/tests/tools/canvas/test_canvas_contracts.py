"""Canvas 模型调用契约、批量错误和 sidecar 边界测试。"""

from __future__ import annotations

import inspect
import json

import pytest
from pydantic import ValidationError

import app.tools.canvas.tools as canvas_tools
import tests.tools.canvas.helpers  # noqa: F401
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import I18nManager
from app.tools.canvas.application.commands import AddElementCommand, FrameElementsCommand
from app.tools.canvas.bootstrap import CanvasApplicationFactory
from app.tools.canvas.domain.errors import CanvasBatchError, CanvasDomainError, CanvasProtocolError
from app.tools.canvas.domain.models import CanvasElement
from app.tools.canvas.generation import (
    GenerationCapability,
    GenerationCapabilityRegistry,
    GenerationQueryResult,
    GenerationSubmission,
    InMemoryGenerationTaskRepository,
)
from app.tools.canvas.presentation import error_result as _error_result
from app.tools.canvas.presentation.model_content import elements_content, items_content, overview_content
from app.tools.canvas.repository import CanvasRepository
from app.tools.canvas.tools import (
    AddCanvasContents,
    AddCanvasElements,
    ContentInput,
    ElementInput,
    EstimateCanvasContentPoints,
    FrameCanvasElements,
    GenerationOverrideInput,
    InitializeCanvas,
    LayoutCanvasElements,
    ManageCanvasConnections,
    QueryCanvasElementDetails,
    QueryCanvasOverview,
    RetryCanvasContentGeneration,
    SearchCanvasImagePrompts,
    SearchCanvasImages,
    SelectCanvasMainContent,
    VideoPointEstimateItemInput,
    WaitCanvasGeneration,
)
from app.tools.canvas.tools.agent_write_policy import CanvasAgentWritePolicy


def test_content_input_exposes_one_stable_model_schema() -> None:
    """Content Schema 不应把多个联合分支同时暴露给大模型。"""
    schema = AddCanvasElements.Params.model_json_schema()["$defs"]["ContentInput"]

    assert "anyOf" not in schema
    assert "oneOf" not in schema
    assert schema["required"] == ["source", "content_type"]
    assert schema["examples"][0] == {
        "source": "user",
        "content_type": "text",
        "content": "标题文本",
    }


def test_agent_write_policy_rejects_read_only_element_creation() -> None:
    """Agent 写入策略允许媒体类型，并拒绝基础文本类型。"""
    CanvasAgentWritePolicy.validate_creation([
        AddElementCommand(item_ref="image", element_type="image"),
    ])

    with pytest.raises(CanvasDomainError) as raised:
        CanvasAgentWritePolicy.validate_creation([
            AddElementCommand(item_ref="title", element_type="text"),
        ])

    assert raised.value.code == "ELEMENT_MUTATION_NOT_ALLOWED"
    assert "text" in raised.value.message
    assert "image" in raised.value.message


@pytest.mark.asyncio
async def test_agent_write_policy_rejects_read_only_frame_selection(tmp_path) -> None:
    """Frame 工具不能把只读 Element 纳入新 Frame。"""
    repository = CanvasRepository(tmp_path)
    await repository.initialize("mock-project")
    await repository.transaction(
        "mock-project",
        lambda project: project.canvas.elements.append(CanvasElement("text-1", "text")),
    )

    with pytest.raises(CanvasDomainError) as raised:
        await CanvasAgentWritePolicy.validate_frame_selection(
            repository,
            "mock-project",
            [FrameElementsCommand(item_ref="frame", element_ids=("text-1",))],
        )

    assert raised.value.code == "ELEMENT_MUTATION_NOT_ALLOWED"


def test_each_canvas_tool_owns_feedback_hooks() -> None:
    """每个 Canvas 工具都必须独立实现三类用户反馈钩子。"""
    tools = [
        InitializeCanvas,
        QueryCanvasOverview,
        QueryCanvasElementDetails,
        AddCanvasElements,
        FrameCanvasElements,
        AddCanvasContents,
        RetryCanvasContentGeneration,
        SelectCanvasMainContent,
        LayoutCanvasElements,
        ManageCanvasConnections,
        WaitCanvasGeneration,
        EstimateCanvasContentPoints,
        SearchCanvasImagePrompts,
        SearchCanvasImages,
    ]
    hooks = {
        "get_before_tool_call_friendly_action_and_remark",
        "get_after_tool_call_friendly_action_and_remark",
        "get_tool_detail",
    }
    for tool_class in tools:
        assert hooks <= tool_class.__dict__.keys(), tool_class.__name__


def test_canvas_tool_schemas_reject_unknown_top_level_parameters() -> None:
    """全部 Canvas 工具向模型暴露的 Schema 应与 extra=forbid 运行时策略一致。"""
    tools = [
        InitializeCanvas,
        QueryCanvasOverview,
        QueryCanvasElementDetails,
        AddCanvasElements,
        FrameCanvasElements,
        AddCanvasContents,
        RetryCanvasContentGeneration,
        SelectCanvasMainContent,
        LayoutCanvasElements,
        ManageCanvasConnections,
        WaitCanvasGeneration,
        EstimateCanvasContentPoints,
        SearchCanvasImagePrompts,
        SearchCanvasImages,
    ]

    for tool_class in tools:
        parameters = tool_class().to_param()["function"]["parameters"]
        assert parameters["additionalProperties"] is False, tool_class.__name__


def test_content_input_accepts_text_and_rejects_incomplete_generation() -> None:
    """文本使用 content 字段，生成内容必须提供 prompt。"""
    text = ContentInput(source="user", content_type="text", content="mock text")
    assert text.content == "mock text"

    with pytest.raises(ValidationError, match="source=generated requires prompt"):
        ContentInput(source="generated", content_type="image")

    with pytest.raises(ValidationError, match="source=generated image requires name"):
        ContentInput(source="generated", content_type="image", prompt="mock prompt")

    image = ContentInput(
        source="generated",
        content_type="image",
        prompt="mock prompt",
        name="mock image",
    )
    assert image.to_command().generation_parameters.name == "mock image"


def test_generated_media_inherits_name_from_element_when_content_name_is_missing() -> None:
    """生成图片和视频缺少 Content 名称时应兼容使用外层 Element 名称。"""
    image = ElementInput.model_validate({
        "item_ref": "image",
        "element_type": "image",
        "name": "外层图片名称",
        "content": {
            "source": "generated",
            "content_type": "image",
            "prompt": "mock prompt",
        },
    })
    assert image.content is not None
    assert image.content.name == "外层图片名称"
    assert image.to_command().content is not None
    assert image.to_command().content.generation_parameters is not None
    assert image.to_command().content.generation_parameters.name == "外层图片名称"

    video = ElementInput.model_validate({
        "item_ref": "video",
        "element_type": "video",
        "name": "外层视频名称",
        "content": {
            "source": "generated",
            "content_type": "video",
            "prompt": "mock prompt",
        },
    })
    assert video.content is not None
    assert video.content.name == "外层视频名称"

    explicit = ElementInput.model_validate({
        "item_ref": "explicit",
        "element_type": "image",
        "name": "外层名称",
        "content": {
            "source": "generated",
            "content_type": "image",
            "name": "Content 名称",
            "prompt": "mock prompt",
        },
    })
    assert explicit.content is not None
    assert explicit.content.name == "Content 名称"


def test_storyboard_persists_model_and_nested_aspect_ratio_configuration() -> None:
    """Storyboard Content 必须保留模型、尺寸、分辨率和嵌套画面比例。"""
    storyboard = ContentInput(
        source="user",
        content_type="storyboard",
        generationConfig={
            "model_id": "mock-image-model",
            "size": "1600x900",
            "resolution": "2K",
            "aspect_ratio": "16:9",
        },
        shots=[{"id": "S01", "description": "mock shot"}],
    )

    assert storyboard.to_command().fields.to_dict()["generationConfig"] == {
        "model_id": "mock-image-model",
        "size": "1600x900",
        "resolution": "2K",
        "image_generation_config": {"aspect_ratio": "16:9"},
    }


def test_composition_content_persists_element_sequences_and_output_in_generation_parameters() -> None:
    """最终视频合成参数必须保存 Element 顺序和本次导出配置。"""
    content = ContentInput(
        source="generated",
        content_type="video",
        task="compose",
        composition={
            "videoSequence": ["video-1", "video-2"],
            "audioSequence": ["audio-1"],
        },
        output={"format": "mp4", "aspectRatio": "9:16", "resolution": "720p", "audioPolicy": "preserve"},
    )

    command = content.to_command()
    assert command.is_composition
    assert command.generation_parameters is not None
    assert command.generation_parameters.to_dict()["composition"] == {
        "videoSequence": ["video-1", "video-2"],
        "audioSequence": ["audio-1"],
        "output": {"format": "mp4", "audioPolicy": "preserve", "aspectRatio": "9:16", "resolution": "720p"},
    }


def test_composition_content_requires_element_sequences() -> None:
    """最终视频合成必须使用与 Video Edit 一致的 Element 顺序字段。"""
    with pytest.raises(ValidationError):
        ContentInput(
            source="generated",
            content_type="video",
            task="compose",
            composition={"audios": []},
            output={"format": "mp4"},
        )


def test_video_generation_mode_and_task_survive_input_conversions() -> None:
    """视频 input_mode 和 task 应贯穿公开输入、命令和重试覆盖。"""
    content = ContentInput(
        source="generated",
        content_type="video",
        prompt="mock video",
        input_mode="video_edit",
        task="edit",
    )
    parameters = content.to_command().generation_parameters

    assert parameters is not None
    assert parameters.input_mode == "video_edit"
    assert parameters.task == "edit"

    override = GenerationOverrideInput(input_mode="keyframe_guided", task="generate")
    override_command = override.to_command()
    assert override_command.to_dict() == {
        "input_mode": "keyframe_guided",
        "task": "generate",
    }

    estimate_item = VideoPointEstimateItemInput(
        item_ref="shot-1",
        prompt="mock video",
        input_mode="image_reference",
        task="generate",
    )
    estimate_parameters = estimate_item.to_parameters()
    assert estimate_parameters.input_mode == "image_reference"
    assert estimate_parameters.task == "generate"


def test_video_edit_content_uses_element_id_sequence() -> None:
    """Video Edit 按协议接收有序的 Video Element ID 数组。"""
    content = ContentInput(
        source="user",
        content_type="video-edit",
        videoSequence=["video-element-1", "video-element-2"],
    )

    assert content.video_sequence == ["video-element-1", "video-element-2"]
    assert content.model_dump(by_alias=True)["videoSequence"] == [
        "video-element-1",
        "video-element-2",
    ]


def test_video_edit_content_does_not_store_export_configuration() -> None:
    """Video Edit 只保存剪辑方案，不保存导出配置。"""
    content = ContentInput(
        source="user",
        content_type="video-edit",
        videoSequence=["video-element-1"],
    )

    assert content.output is None


@pytest.mark.parametrize(
    ("values", "message"),
    [
        ({"videoSequence": []}, "at least 1 item"),
        ({"videoSequence": ["video-1", "video-1"]}, "videoSequence IDs must be unique"),
        ({"videoSequence": ["video-1"], "audioSequence": ["audio-1", "audio-2"]}, "at most 1 item"),
        ({"videoSequence": [" "]}, "videoSequence IDs must not be empty"),
    ],
)
def test_video_edit_content_rejects_invalid_sequences(values, message) -> None:
    """Video Edit 输入层必须拒绝空序列、重复 ID、空白 ID 和多音频。"""
    with pytest.raises(ValidationError, match=message):
        ContentInput(source="user", content_type="video-edit", **values)


def test_non_video_edit_content_rejects_video_edit_fields() -> None:
    """非 Video Edit Content 不能静默接收视频剪辑字段。"""
    with pytest.raises(ValidationError, match="only allowed for video-edit Content"):
        ContentInput(
            source="user",
            content_type="storyboard",
            videoSequence=["video-1"],
        )


@pytest.mark.parametrize(
    "output",
    [
        {"format": "MP4"},
        {"format": "mov"},
        {"format": None},
        {"codec": "h264"},
        {"resolution": 1080},
        {"audioPolicy": "invalid"},
    ],
)
def test_video_edit_content_rejects_invalid_output(output) -> None:
    """Video Edit 输出配置必须保持旧工具的 MP4 和字段类型约束。"""
    with pytest.raises(ValidationError):
        ContentInput(
            source="user",
            content_type="video-edit",
            videoSequence=["video-1"],
            output=output,
        )


def test_wait_schema_uses_tasks_with_generation_task_id() -> None:
    """等待工具保持技术方案约定的 tasks 结构。"""
    schema = WaitCanvasGeneration.Params.model_json_schema()

    assert schema["required"] == ["project_path", "tasks"]
    assert schema["properties"]["tasks"]["items"]["$ref"].endswith("/$defs/WaitTask")


@pytest.mark.asyncio
async def test_atomic_batch_error_preserves_each_item_and_rolls_back(tmp_path) -> None:
    """批量预检失败时返回逐项状态，并且不留下半完成节点。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    with pytest.raises(CanvasBatchError) as raised:
        await application.add_elements(
            "mock-project",
            [
                {"item_ref": "valid", "element_type": "text"},
                {"item_ref": "invalid", "element_type": "unsupported"},
            ],
        )

    assert raised.value.items[0]["item_ref"] == "valid"
    assert raised.value.items[0]["status"] == "not_applied"
    assert raised.value.items[1]["item_ref"] == "invalid"
    assert raised.value.items[1]["status"] == "failed"
    assert raised.value.items[1]["error_code"] == "INVALID_ELEMENT"
    assert (await application.overview("mock-project", 1, 50))["total_elements"] == 0


def test_batch_error_content_is_model_actionable() -> None:
    """批量错误的 ToolResult.content 必须包含逐项定位和下一步动作。"""
    result = _error_result(CanvasBatchError([
        {
            "item_ref": "valid",
            "status": "not_applied",
            "error_code": "BATCH_VALIDATION_FAILED",
            "reason": "Atomic batch not written.",
        },
        {
            "item_ref": "invalid",
            "status": "failed",
            "error_code": "INVALID_ELEMENT",
            "reason": "Unsupported Element type.",
        },
    ]))

    assert result.ok is False
    assert "item_ref=valid | status=not_applied" in result.content
    assert "item_ref=invalid | status=failed | error_code=INVALID_ELEMENT" in result.content
    assert "correct only the failed items" in result.content


def test_model_content_contains_follow_up_and_specific_error_action() -> None:
    """模型结果必须包含可串联的下一步和稳定错误处理建议。"""
    success = items_content(
        "Canvas Elements added successfully.",
        {"items": [{"item_ref": "text", "status": "completed", "element_id": "element-1"}]},
        "call query_canvas_element_details with the returned element_id",
    )
    assert "Next: call query_canvas_element_details" in success

    failed = _error_result(CanvasDomainError("CONTENT_NOT_FOUND", "Content content-1 does not exist."))
    assert "content-1" in failed.content
    assert "Action:" in failed.content


def test_unsupported_canvas_version_guides_user_to_ui_upgrade() -> None:
    """不支持的画布版本必须指导模型让用户在画布界面升级。"""
    failed = _error_result(
        CanvasProtocolError(
            "UNSUPPORTED_CANVAS_VERSION",
            "Only the current Canvas project format is supported.",
        )
    )

    assert failed.ok is False
    assert failed.data == {
        "error_code": "CANVAS_PROJECT_NOT_SUPPORTED",
        "error": "Only the current Canvas project format is supported.",
    }
    assert "older format" in failed.content
    assert "open the Canvas in the UI and click Upgrade" in failed.content
    assert "retry the operation" in failed.content
    assert "Do not inspect, migrate, or write the project file directly" in failed.content


@pytest.mark.asyncio
async def test_invalid_user_sidecar_is_visible_and_blocks_writes(tmp_path) -> None:
    """不支持的 user sidecar 不能被静默忽略或在写操作中覆盖。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [{"item_ref": "text", "element_type": "text"}],
    )
    element_id = created["items"][0]["element_id"]
    user_sidecar = tmp_path / "mock-project" / "element-details-user.json"
    user_sidecar.write_text(json.dumps({"elements": []}), encoding="utf-8")

    details = await application.elements("mock-project", [element_id])
    assert details["details_complete"] is False
    assert details["warnings"] == ["Some user-provided Content details are temporarily unavailable."]

    with pytest.raises(ValueError, match="UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE"):
        await application.add_contents(
            "mock-project",
            [{
                "item_ref": "append",
                "element_id": element_id,
                "content": {"source": "user", "content_type": "text", "content": "new"},
            }],
        )

    assert user_sidecar.read_text(encoding="utf-8") == json.dumps({"elements": []})


@pytest.mark.asyncio
async def test_invalid_user_sidecar_blocks_layout_and_frame_writes(tmp_path) -> None:
    """所有 Canvas 结构写操作都必须尊重损坏 user sidecar 的保护边界。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")
    created = await application.add_elements(
        "mock-project",
        [
            {"item_ref": "one", "element_type": "text"},
            {"item_ref": "two", "element_type": "text"},
        ],
    )
    ids = created["created_element_ids"]
    user_sidecar = tmp_path / "mock-project" / "element-details-user.json"
    user_sidecar.write_text(json.dumps({"elements": []}), encoding="utf-8")

    with pytest.raises(ValueError, match="UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE"):
        await application.layout(
            "mock-project",
            [{"item_ref": "layout", "element_id": ids[0], "layout": {"strategy": "row_incremental"}}],
        )
    with pytest.raises(ValueError, match="UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE"):
        await application.frame_elements(
            "mock-project",
            [{"item_ref": "frame", "element_ids": ids}],
        )

    assert user_sidecar.read_text(encoding="utf-8") == json.dumps({"elements": []})


@pytest.mark.asyncio
async def test_single_item_keeps_specific_error_code(tmp_path) -> None:
    """单项工具错误保留稳定业务码，不被批量汇总码覆盖。"""
    repository = CanvasRepository(tmp_path)
    application = CanvasApplicationFactory.create(repository)
    await application.initialize("mock-project")

    with pytest.raises(CanvasDomainError) as raised:
        await application.add_elements(
            "mock-project",
            [{"item_ref": "invalid", "element_type": "unsupported"}],
        )

    assert raised.value.code == "INVALID_ELEMENT"


def test_element_details_content_does_not_dump_raw_element_dto() -> None:
    """详情 content 应提供可读摘要，而不是把内部 DTO 原样注入模型上下文。"""
    content = elements_content(
        {
            "project_path": "Canvas/Demo",
            "details_complete": True,
            "elements": [
                {
                    "element_id": "element-1",
                    "element_type": "text",
                    "name": "Title",
                    "parent_element_id": None,
                    "depth": 0,
                    "layout": {"x": 1, "y": 2},
                    "child_element_ids": [],
                    "active_content_id": "content-1",
                    "main_content_id": "content-1",
                    "contents": [
                        {
                            "content_id": "content-1",
                            "status": "completed",
                            "source": "user",
                            "payload": {"content": "Hello"},
                            "runtime": {"generationStatus": "completed"},
                        }
                    ],
                    "children": [],
                    "connections": [],
                }
            ],
            "connections": [],
        }
    )

    assert "Element element-1:" in content
    assert "content=Hello" in content
    assert "runtime={\"generationStatus\":\"completed\"}" in content
    assert '"element_id"' not in content
    assert '"contents"' not in content


def test_element_details_content_omits_defaults_and_keeps_actionable_fields() -> None:
    """详情模型文本应省略默认值，并保留多版本、任务和关系信息。"""
    content = elements_content(
        {
            "project_path": "Canvas/Demo",
            "details_complete": True,
            "elements": [
                {
                    "element_id": "element-1",
                    "element_type": "video",
                    "name": None,
                    "parent_element_id": None,
                    "depth": 0,
                    "layout": {"x": 0, "y": 0, "scale_x": 1, "scale_y": 1, "z_index": 0},
                    "child_element_ids": [],
                    "active_content_id": "content-2",
                    "main_content_id": "content-1",
                    "contents": [
                        {
                            "content_id": "content-1",
                            "status": "completed",
                            "source": "generated",
                            "retry_count": 0,
                        },
                        {
                            "content_id": "content-2",
                            "status": "processing",
                            "source": "generated",
                            "retry_count": 1,
                            "generation_task_id": "task-1",
                        },
                    ],
                    "children": [],
                    "connections": [
                        {
                            "connection_id": "connection-1",
                            "source_element_id": "element-0",
                            "target_element_id": "element-1",
                        }
                    ],
                }
            ],
            "connections": [
                {
                    "connection_id": "connection-1",
                    "source_element_id": "element-0",
                    "target_element_id": "element-1",
                }
            ],
        }
    )

    assert "details_complete" not in content
    assert "name=-" not in content
    assert "parent_element_id=-" not in content
    assert "depth=0" not in content
    assert "scale_x=1" not in content
    assert "z_index=0" not in content
    assert "active_content_id=content-2" in content
    assert "main_content_id=content-1" in content
    assert "retry_count=1" in content
    assert "generation_task_id=task-1" in content
    assert "connection_id=connection-1" in content
    assert content.count("connection_id=connection-1") == 1


@pytest.mark.asyncio
async def test_sidecar_write_validation_rolls_back_main_file(tmp_path) -> None:
    """sidecar 写后校验失败时，主文件不能留下半完成的修改。"""
    repository = CanvasRepository(tmp_path)
    await repository.initialize("mock-project")

    def mutate(project, metadata):
        project.canvas.elements.append(CanvasElement("temporary", "text"))
        return {"ok": True}, {"elements": []}

    with pytest.raises(ValueError, match="UNSUPPORTED_ELEMENT_DETAILS_STRUCTURE"):
        await repository.transaction_with_sidecar("mock-project", mutate)

    project = await repository.read("mock-project")
    assert project.canvas.get_element("temporary") is None


class RecoverableVideoPort:
    """用于验证新 Application 实例从 sidecar 恢复异步任务的 mock。"""

    execution_mode = "async"

    async def submit(self, request, tool_context):
        """返回固定的 Canvas 和 provider 任务标识。"""
        return GenerationSubmission(
            "async",
            "processing",
            generation_task_id="recoverable-canvas-task",
            provider_task_id="recoverable-provider-task",
        )

    async def query(self, request, tool_context):
        """返回固定完成结果。"""
        return GenerationQueryResult("completed", output_uri="mock/videos/recovered.mp4")


class FailingTaskRepository:
    """用于验证任务仓储失败时仍可从 Canvas sidecar 恢复的 mock。"""

    async def put(self, task):
        """模拟任务绑定写入失败。"""
        raise RuntimeError("mock task repository failure")

    async def get(self, generation_task_id):
        """该仓储不提供运行期任务记录。"""
        return None

    async def update(self, task):
        """模拟更新不可用。"""
        raise RuntimeError("mock task repository failure")


@pytest.mark.asyncio
async def test_async_generation_recovers_between_application_instances(tmp_path) -> None:
    """新的 Application 实例应能仅凭 sidecar 任务绑定继续等待。"""
    port = RecoverableVideoPort()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("recoverable-video", "video", "async", port, port),
    ])
    repository = CanvasRepository(tmp_path)
    first = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        generation_tasks=InMemoryGenerationTaskRepository(),
    )
    await first.initialize("mock-project")
    created = await first.add_elements(
        "mock-project",
        [{
            "item_ref": "video",
            "element_type": "video",
            "content": {"source": "generated", "content_type": "video", "prompt": "mock"},
        }],
    )
    assert created["items"][0]["generation_task_id"] == "recoverable-canvas-task"

    second = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        generation_tasks=InMemoryGenerationTaskRepository(),
    )
    waited = await second.wait("mock-project", ["recoverable-canvas-task"], max_wait_seconds=1)

    assert waited["items"][0]["status"] == "completed"
    assert waited["items"][0]["output_uri"] == "mock/videos/recovered.mp4"


@pytest.mark.asyncio
async def test_async_generation_recovers_when_task_repository_write_fails(tmp_path) -> None:
    """任务仓储写失败时，sidecar 绑定仍应支持后续等待恢复。"""
    port = RecoverableVideoPort()
    registry = GenerationCapabilityRegistry([
        GenerationCapability("recoverable-video", "video", "async", port, port),
    ])
    repository = CanvasRepository(tmp_path)
    first = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        generation_tasks=FailingTaskRepository(),
    )
    await first.initialize("mock-project")
    created = await first.add_elements(
        "mock-project",
        [{
            "item_ref": "video",
            "element_type": "video",
            "content": {"source": "generated", "content_type": "video", "prompt": "mock"},
        }],
    )
    assert created["items"][0]["generation_task_id"] == "recoverable-canvas-task"
    assert created["items"][0]["persistence_warning"]

    second = CanvasApplicationFactory.create(
        repository,
        generation_capabilities=registry,
        generation_tasks=InMemoryGenerationTaskRepository(),
    )
    waited = await second.wait("mock-project", ["recoverable-canvas-task"], max_wait_seconds=1)

    assert waited["items"][0]["status"] == "completed"


def test_feedback_and_content_are_separate_channels() -> None:
    """模型 content 只保留语义摘要，结构化 ID 留在 data 中。"""
    result = ToolResult(
        content="Canvas Elements added successfully.\n- item_ref=image | status=completed",
        data={"items": [{"item_ref": "image", "status": "completed", "element_id": "element-1"}]},
    )
    assert result.content.startswith("Canvas Elements added successfully.")
    assert "element-1" not in result.content
    assert result.data["items"][0]["element_id"] == "element-1"


def test_overview_content_omits_default_element_fields() -> None:
    """概览模型文本应省略默认值，但保留异常状态和层级关系。"""
    content = overview_content(
        {
            "project_path": "Canvas/Demo",
            "total_elements": 2,
            "total_connections": 1,
            "page": 1,
            "limit": 50,
            "has_more": False,
            "elements": [
                {
                    "element_id": "element-1",
                    "element_type": "image",
                    "name": None,
                    "x": None,
                    "y": None,
                    "width": None,
                    "height": None,
                    "content_count": 1,
                    "parent_element_id": None,
                    "depth": 0,
                    "child_count": 0,
                    "active_content_id": "content-1",
                    "main_content_id": "content-1",
                    "status": "completed",
                    "incoming": [],
                    "outgoing": [],
                },
                {
                    "element_id": "element-2",
                    "element_type": "video",
                    "name": "Shot 1",
                    "x": 10,
                    "y": 20,
                    "width": 1920,
                    "height": 1080,
                    "content_count": 2,
                    "parent_element_id": "frame-1",
                    "depth": 1,
                    "child_count": 1,
                    "active_content_id": "content-2",
                    "main_content_id": "content-1",
                    "status": "processing",
                    "incoming": ["element-1"],
                    "outgoing": [],
                },
            ],
        }
    )

    first_line = next(line for line in content.splitlines() if "element_id=element-1" in line)
    second_line = next(line for line in content.splitlines() if "element_id=element-2" in line)
    assert "contents=" not in first_line
    assert "parent_element_id=" not in first_line
    assert "depth=" not in first_line
    assert "child_count=" not in first_line
    assert "status=" not in first_line
    assert "name=Shot 1" in second_line
    assert "contents=2" in second_line
    assert "parent_element_id=frame-1" in second_line
    assert "depth=1" in second_line
    assert "child_count=1" in second_line
    assert "status=processing" in second_line
    assert "incoming=1" in second_line


@pytest.mark.asyncio
async def test_user_feedback_changes_with_query_targets_and_wait_state() -> None:
    """用户界面反馈应包含查询目标，并区分等待完成和超时。"""
    context = ToolContext()
    overview = QueryCanvasOverview()
    overview_feedback = await overview.get_before_tool_call_friendly_action_and_remark(
        overview.name,
        context,
        {"project_path": "Canvas/Demo", "page": 2, "limit": 7},
    )
    assert "第 2 页" in overview_feedback["remark"]
    assert "7" in overview_feedback["remark"]

    details = QueryCanvasElementDetails()
    details_feedback = await details.get_before_tool_call_friendly_action_and_remark(
        details.name,
        context,
        {"project_path": "Canvas/Demo", "element_ids": ["element-1", "element-2"]},
    )
    assert "element-1" in details_feedback["remark"]
    assert "element-2" in details_feedback["remark"]

    wait = WaitCanvasGeneration()
    wait_args = {
        "project_path": "Canvas/Demo",
        "tasks": [{"generation_task_id": "task-1"}],
        "max_wait_seconds": 5,
    }
    completed = await wait.get_after_tool_call_friendly_action_and_remark(
        wait.name,
        context,
        ToolResult(content="ok", data={"items": [{"status": "completed"}]}),
        0.1,
        wait_args,
    )
    timed_out = await wait.get_after_tool_call_friendly_action_and_remark(
        wait.name,
        context,
        ToolResult(content="ok", data={"items": [{"status": "processing", "timed_out": True}]}),
        0.1,
        wait_args,
    )
    assert completed["action"] != timed_out["action"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool_class", "arguments", "result", "zh_expected", "en_expected"),
    [
        pytest.param(
            InitializeCanvas,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="mock", data={"created": True}),
            ("正在准备画布项目", "画布项目已创建"),
            ("Preparing the Canvas project", "Canvas project created"),
            id="initialize",
        ),
        pytest.param(
            QueryCanvasOverview,
            {"project_path": "Canvas/Demo", "page": 2, "limit": 7},
            ToolResult(
                content="mock",
                data={"project_path": "Canvas/Demo", "total_elements": 3, "total_connections": 1},
            ),
            ("第 2 页", "共 3 个节点，1 条连线"),
            ("Page 2", "Elements: 3; connections: 1"),
            id="overview",
        ),
        pytest.param(
            QueryCanvasElementDetails,
            {"project_path": "Canvas/Demo", "element_ids": ["element-1", "element-2"]},
            ToolResult(content="mock", data={"elements": [{}, {}]}),
            ("目标节点", "已返回 2 个节点的详情"),
            ("Target elements", "Returned details for 2 elements"),
            id="element-details",
        ),
        pytest.param(
            AddCanvasElements,
            {"project_path": "Canvas/Demo", "items": [{}, {}]},
            ToolResult(content="mock", data={"items": [{"status": "completed"}, {"status": "failed"}]}),
            ("准备新增 2 个画布节点", "批量操作结果：已完成 1 个，处理中 0 个，失败 1 个，共 2 个"),
            ("Canvas elements to add: 2", "Batch operation result: 1 completed, 0 processing, 1 failed, 2 total"),
            id="add-elements",
        ),
        pytest.param(
            AddCanvasContents,
            {"project_path": "Canvas/Demo", "items": [{}, {}]},
            ToolResult(content="mock", data={"items": [{"status": "pending"}, {"status": "failed"}]}),
            ("准备为 2 个节点新增内容", "批量操作结果：已完成 0 个，处理中 1 个，失败 1 个，共 2 个"),
            ("Elements receiving new content: 2", "Batch operation result: 0 completed, 1 processing, 1 failed, 2 total"),
            id="add-contents",
        ),
        pytest.param(
            ManageCanvasConnections,
            {"project_path": "Canvas/Demo", "items": [{}, {}, {}]},
            ToolResult(
                content="mock",
                data={"items": [{"status": "added"}, {"status": "removed"}, {"status": "replaced"}]},
            ),
            ("准备更新 3 项画布连线", "新增 1 条，移除 1 条，替换 1 条"),
            ("Canvas connection updates: 3", "1 added, 1 removed, 1 replaced"),
            id="connections",
        ),
        pytest.param(
            FrameCanvasElements,
            {"project_path": "Canvas/Demo", "items": [{"element_ids": ["element-1", "element-2"]}]},
            ToolResult(content="mock", data={"items": [{"status": "created"}]}),
            ("准备将 2 个节点创建为画布分组", "已创建 1 个画布分组"),
            ("Preparing to create a canvas group from 2 element(s)", "Canvas groups created: 1"),
            id="frame",
        ),
        pytest.param(
            LayoutCanvasElements,
            {"project_path": "Canvas/Demo", "items": [{"layout": {"strategy": "row_incremental"}}]},
            ToolResult(content="mock", data={"items": [{"status": "completed"}]}),
            ("正在对 1 个节点应用布局策略", "已更新 1 个节点的布局"),
            ("Layout targets: 1", "Element layouts updated: 1"),
            id="layout",
        ),
        pytest.param(
            RetryCanvasContentGeneration,
            {"project_path": "Canvas/Demo", "items": [{}, {}]},
            ToolResult(
                content="mock",
                data={"items": [{"status": "pending"}, {"error_code": "CONTENT_RETRY_LIMIT_REACHED"}]},
            ),
            ("准备重试 2 项失败内容", "批量操作结果：已完成 0 个，处理中 1 个，失败 1 个，共 2 个"),
            ("Failed content items to retry: 2", "Batch operation result: 0 completed, 1 processing, 1 failed, 2 total"),
            id="retry",
        ),
        pytest.param(
            SelectCanvasMainContent,
            {"project_path": "Canvas/Demo", "items": [{}, {}]},
            ToolResult(content="mock", data={"items": [{}, {}]}),
            ("准备为 2 个节点选择主内容", "已为 2 个节点选择主内容"),
            ("Main content selections pending: 2", "Main content selections completed: 2"),
            id="select-main",
        ),
        pytest.param(
            WaitCanvasGeneration,
            {"project_path": "Canvas/Demo", "tasks": [{"generation_task_id": "task-1"}], "max_wait_seconds": 5},
            ToolResult(content="mock", data={"items": [{"status": "completed"}]}),
            ("正在等待 1 项生成任务", "生成任务已全部完成"),
            ("Generation tasks: 1", "All generation tasks completed"),
            id="wait",
        ),
        pytest.param(
            EstimateCanvasContentPoints,
            {"project_path": "Canvas/Demo", "items": [{}]},
            ToolResult(content="mock", data={"can_continue": True, "total_points": 12}),
            ("正在预估 1 段视频的生成积分", "预计需要 12 个视频生成积分"),
            ("Estimating video generation points for 1 video(s)", "Estimated 12 video generation points"),
            id="estimate-points",
        ),
        pytest.param(
            SearchCanvasImagePrompts,
            {"query": "香水"},
            ToolResult(content="mock", data={"results": [{}, {}]}),
            ("正在搜索提示词灵感：香水", "已搜索到 2 条提示词灵感"),
            ("Searching prompt inspirations for 香水", "Found 2 prompt inspirations"),
            id="search-prompts",
        ),
        pytest.param(
            SearchCanvasImages,
            {"topic_id": "topic-1"},
            ToolResult(content="mock", data={"items": [{"imported_count": 2}]}),
            ("正在搜索并导入参考图片：topic-1", "已导入 2 张参考图片"),
            ("Searching and importing reference images for topic-1", "Imported 2 reference images"),
            id="search-images",
        ),
    ],
)
async def test_canvas_tool_remarks_follow_current_language(
    tool_class: type,
    arguments: dict[str, object],
    result: ToolResult,
    zh_expected: tuple[str, str],
    en_expected: tuple[str, str],
) -> None:
    """全部 Canvas 工具的调用前后 remark 都应跟随当前语言。"""
    tool = tool_class()
    context = ToolContext()
    try:
        I18nManager.set_language("zh_CN")
        zh_before = await tool.get_before_tool_call_friendly_action_and_remark(
            tool.name,
            context,
            arguments,
        )
        zh_after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool.name,
            context,
            result,
            0.1,
            arguments,
        )

        I18nManager.set_language("en_US")
        en_before = await tool.get_before_tool_call_friendly_action_and_remark(
            tool.name,
            context,
            arguments,
        )
        en_after = await tool.get_after_tool_call_friendly_action_and_remark(
            tool.name,
            context,
            result,
            0.1,
            arguments,
        )
    finally:
        I18nManager.reset_language()

    assert zh_expected[0] in zh_before["remark"]
    assert zh_expected[1] in zh_after["remark"]
    assert en_expected[0] in en_before["remark"]
    assert en_expected[1] in en_after["remark"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tool_class", "arguments", "result", "zh_title", "en_title", "raw_value"),
    [
        pytest.param(
            InitializeCanvas,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "created": True}),
            "画布初始化",
            "Canvas initialization",
            "Canvas/Demo",
            id="initialize",
        ),
        pytest.param(
            QueryCanvasOverview,
            {"project_path": "Canvas/Demo"},
            ToolResult(
                content="MODEL-ONLY",
                data={
                    "project_path": "Canvas/Demo",
                    "total_elements": 1,
                    "total_connections": 0,
                    "page": 1,
                    "elements": [{"element_id": "element-1", "element_type": "image"}],
                },
            ),
            "画布概览",
            "Canvas overview",
            "element-1",
            id="overview",
        ),
        pytest.param(
            QueryCanvasElementDetails,
            {"project_path": "Canvas/Demo", "element_ids": ["element-1"]},
            ToolResult(
                content="MODEL-ONLY",
                data={"project_path": "Canvas/Demo", "elements": [{"element_id": "element-1", "element_type": "image"}]},
            ),
            "画布节点详情",
            "Canvas element details",
            "element-1",
            id="element-details",
        ),
        pytest.param(
            AddCanvasElements,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "image-1", "status": "completed", "element_id": "element-1", "element_type": "image"}]}),
            "新增画布节点",
            "Canvas elements added",
            "element-1",
            id="add-elements",
        ),
        pytest.param(
            AddCanvasContents,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "content-1", "status": "added", "element_id": "element-1", "content_id": "content-1"}]}),
            "新增画布内容版本",
            "Canvas content versions added",
            "content-1",
            id="add-contents",
        ),
        pytest.param(
            ManageCanvasConnections,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "link-1", "status": "added", "connection_id": "connection-1", "source_element_id": "element-1", "target_element_id": "element-2"}]}),
            "画布连线",
            "Canvas connections",
            "connection-1",
            id="connections",
        ),
        pytest.param(
            FrameCanvasElements,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "frame-1", "status": "created", "frame_element_id": "frame-element-1", "child_element_ids": ["element-1"]}]}),
            "已创建画布画框",
            "Canvas frames created",
            "frame-element-1",
            id="frames",
        ),
        pytest.param(
            LayoutCanvasElements,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "layout-1", "status": "completed", "element_id": "element-1", "layout": {"x": 10, "y": 20}}]}),
            "画布布局",
            "Canvas layout",
            "element-1",
            id="layout",
        ),
        pytest.param(
            RetryCanvasContentGeneration,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "retry-1", "status": "pending", "element_id": "element-1", "content_id": "content-1", "generation_task_id": "task-1"}]}),
            "画布内容重试",
            "Canvas content retry",
            "task-1",
            id="retry",
        ),
        pytest.param(
            SelectCanvasMainContent,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"item_ref": "main-1", "status": "completed", "element_id": "element-1", "main_content_id": "content-1"}]}),
            "画布主内容选择",
            "Canvas main content selection",
            "content-1",
            id="select-main",
        ),
        pytest.param(
            WaitCanvasGeneration,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"project_path": "Canvas/Demo", "items": [{"generation_task_id": "task-1", "status": "processing", "timed_out": False, "element_id": "element-1"}]}),
            "等待画布内容生成",
            "Canvas generation wait",
            "task-1",
            id="wait",
        ),
        pytest.param(
            EstimateCanvasContentPoints,
            {"project_path": "Canvas/Demo"},
            ToolResult(content="MODEL-ONLY", data={"production_rule": "video_generation", "items": [{"item_ref": "video-1", "status": "estimated", "points": 12}]}),
            "画布内容积分预估",
            "Canvas content point estimate",
            "video_generation",
            id="estimate",
        ),
        pytest.param(
            SearchCanvasImagePrompts,
            {"query": "香水"},
            ToolResult(content="MODEL-ONLY", data={"query": "香水", "results": [{}], "total_matched": 1}),
            "画布提示词库搜索",
            "Canvas prompt library search",
            "香水",
            id="prompt-search",
        ),
        pytest.param(
            SearchCanvasImages,
            {"topic_id": "perfume"},
            ToolResult(content="MODEL-ONLY", data={"topic_id": "perfume", "items": [{"item_ref": "image-1", "status": "completed", "imported_count": 1, "failed_count": 0}]}),
            "搜索并导入参考图片",
            "Search and import reference images",
            "perfume",
            id="image-search",
        ),
    ],
)
async def test_canvas_tool_details_follow_current_language_without_translating_values(
    tool_class: type,
    arguments: dict[str, object],
    result: ToolResult,
    zh_title: str,
    en_title: str,
    raw_value: str,
) -> None:
    """ToolDetail 应翻译展示文案，但保留模型结果之外的精确业务值。"""
    tool = tool_class()
    try:
        I18nManager.set_language("zh_CN")
        zh_detail = await tool.get_tool_detail(ToolContext(), result, arguments)
        I18nManager.set_language("en_US")
        en_detail = await tool.get_tool_detail(ToolContext(), result, arguments)
    finally:
        I18nManager.reset_language()

    assert zh_detail is not None
    assert en_detail is not None
    zh_content = zh_detail.data.content
    en_content = en_detail.data.content
    assert zh_title in zh_content
    assert en_title in en_content
    if raw_value == "video_generation":
        assert "视频生成" in zh_content
        assert "Video generation" in en_content
        assert "状态=已预估" in zh_content
        assert "Status=Estimated" in en_content
    else:
        assert raw_value in zh_content
        assert raw_value in en_content
    assert "MODEL-ONLY" not in zh_content
    assert "MODEL-ONLY" not in en_content


@pytest.mark.asyncio
async def test_overview_tool_detail_omits_default_hierarchy_fields() -> None:
    """概览详情卡片应省略默认父级、深度和子节点数量。"""
    tool = QueryCanvasOverview()
    result = ToolResult(
        content="MODEL-ONLY",
        data={
            "project_path": "Canvas/Demo",
            "total_elements": 1,
            "total_connections": 0,
            "page": 1,
            "elements": [
                {
                    "element_id": "element-1",
                    "element_type": "image",
                    "parent_element_id": None,
                    "depth": 0,
                    "child_count": 0,
                }
            ],
        },
    )
    detail = await tool.get_tool_detail(ToolContext(), result, {"project_path": "Canvas/Demo"})

    assert detail is not None
    content = detail.data.content
    assert "element-1" in content
    assert "父节点" not in content
    assert "深度" not in content
    assert "子节点" not in content
