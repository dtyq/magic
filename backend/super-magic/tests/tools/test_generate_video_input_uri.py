import pytest
from pydantic import ValidationError

from agentlang.context.tool_context import ToolContext
from app.service.file_service import WorkspaceFileURLError
from app.core.entity.tool.tool_result import VideoToolResult
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection
from app.core.models.media_model import VideoModelSpec
from app.tools.design.tools.generate_canvas_videos import GenerateCanvasVideos, GenerateCanvasVideosParams, VideoTaskSpec
from app.tools.design.tools.base_generate_canvas_elements import ElementDetail
from app.tools.generate_video import GenerateVideo, GenerateVideoParams, MagicServiceVideoError


@pytest.mark.asyncio
async def test_resolve_input_uri_uses_workspace_file_service_url_for_local_path(monkeypatch, tmp_path):
    image_path = tmp_path / "images" / "ref.jpg"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"fake-image")

    tool = GenerateVideo(base_dir=str(tmp_path))
    calls = []

    async def fake_get_workspace_file_url(self, file_path, expires_in=3600, options=None):
        calls.append((file_path, expires_in, options))
        return "https://cdn.example.com/workspace/ref.jpg"

    monkeypatch.setattr(
        "app.tools.generate_video.FileService.get_workspace_file_url",
        fake_get_workspace_file_url,
    )

    result = await tool._resolve_input_uri("images/ref.jpg")

    assert result == "https://cdn.example.com/workspace/ref.jpg"
    assert calls == [(image_path.resolve(), 7200, None)]


@pytest.mark.asyncio
async def test_resolve_input_uri_raises_when_workspace_file_service_fails(
    monkeypatch,
    tmp_path,
):
    image_path = tmp_path / "images" / "ref.jpg"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"fake-image")

    tool = GenerateVideo(base_dir=str(tmp_path))
    calls = []

    async def fake_get_workspace_file_url(self, file_path, expires_in=3600, options=None):
        calls.append((file_path, expires_in, options))
        raise WorkspaceFileURLError("missing magicfs xattr")

    monkeypatch.setattr(
        "app.tools.generate_video.FileService.get_workspace_file_url",
        fake_get_workspace_file_url,
    )

    with pytest.raises(ValueError, match="无法将本地文件转换为可访问 URL"):
        await tool._resolve_input_uri("images/ref.jpg")
    assert calls == [(image_path.resolve(), 7200, None)]


@pytest.mark.asyncio
async def test_build_create_payload_uses_explicit_video_edit_mode_and_task(tmp_path):
    tool = GenerateVideo(base_dir=str(tmp_path))

    payload, _, _ = await tool._build_create_payload(
        GenerateVideoParams(
            prompt="把参考视频改成水彩风格",
            input_mode="video_edit",
            task="edit",
            reference_video_paths=["https://cdn.example.com/source.mp4"],
        ),
        model_id="kling-v3-omni",
        video_id="video-1",
    )

    assert payload["input_mode"] == "video_edit"
    assert payload["task"] == "edit"
    assert payload["inputs"]["reference_videos"] == [
        {"uri": "https://cdn.example.com/source.mp4"}
    ]


def test_video_task_spec_normalizes_input_mode_aliases_from_llm():
    task = VideoTaskSpec(
        prompt="把参考视频改成水彩风格",
        name="水彩视频编辑",
        width=1280,
        height=720,
        inputMode="video_editing",
        task="edit",
    )

    assert task.input_mode == "video_edit"
    assert task.task == "edit"


def test_video_task_spec_requires_reference_image_tokens():
    with pytest.raises(ValidationError, match=r"\[image1\].*\[image2\]"):
        VideoTaskSpec(
            prompt="两只猫依次从箱子里跳出来",
            name="箱子跳猫",
            width=1280,
            height=720,
            reference_image_paths=["images/white-cat.jpg", "images/black-cat.jpg"],
        )


def test_video_task_spec_allows_reference_image_tokens():
    task = VideoTaskSpec(
        prompt="白色小猫 [image1] 从黑色箱子探头，黑色小猫 [image2] 从白色箱子跳出",
        name="箱子跳猫",
        width=1280,
        height=720,
        reference_image_paths=["images/white-cat.jpg", "images/black-cat.jpg"],
    )

    assert task.reference_image_paths == ["images/white-cat.jpg", "images/black-cat.jpg"]


def test_video_task_spec_requires_video_and_audio_tokens():
    with pytest.raises(ValidationError, match=r"\[video1\].*\[audio1\]"):
        VideoTaskSpec(
            prompt="参考视频节奏和音频氛围生成广告片",
            name="广告片",
            width=1280,
            height=720,
            reference_video_paths=["videos/ref.mp4"],
            reference_audio_paths=["audios/ref.mp3"],
        )


def test_generate_canvas_videos_params_guides_missing_canvas_dimensions():
    with pytest.raises(ValidationError) as exc:
        GenerateCanvasVideosParams(
            project_path="demo-project",
            tasks=[
                {
                    "prompt": "生成一个 16:9 的 720p 广告短片",
                    "name": "广告短片",
                    "size": "1280x720",
                }
            ],
        )

    message = str(exc.value)
    assert "requires width and height" in message
    assert "tasks.0.width" in message
    assert "tasks.0.height" in message
    assert "current video model's supported size/default_size" in message


@pytest.mark.asyncio
async def test_execute_purely_exposes_4018_error_as_raw_error(monkeypatch, tmp_path):
    tool = GenerateVideo(base_dir=str(tmp_path))
    explicit_error = "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。 (code=4018)"

    async def fake_build_create_payload(params, model_id, video_id, video_generation_config=None):
        return {}, {}, None

    async def fake_request_json(**kwargs):
        raise MagicServiceVideoError(explicit_error, code=4018)

    monkeypatch.setattr(tool, "_build_create_payload", fake_build_create_payload)
    monkeypatch.setattr(tool, "_request_json", fake_request_json)

    result = await tool.execute_purely(
        None,
        GenerateVideoParams(prompt="生成测试视频", model_id="mock-video-model", output_path="videos"),
    )

    assert not result.ok
    assert result.content == explicit_error
    assert result.extra_info["error"] == explicit_error
    assert result.extra_info["error_code"] == "4018"
    assert result.extra_info["raw_error"] == explicit_error


def test_magic_service_error_uses_structured_response_code():
    response = {
        "code": 4018,
        "message": "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。",
    }

    error = GenerateVideo._build_magic_service_error(response)

    assert isinstance(error, MagicServiceVideoError)
    assert error.code == "4018"
    assert str(error) == "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。 (code=4018)"
    assert GenerateVideo._is_llm_visible_magic_service_error(error)
    assert not GenerateVideo._is_llm_visible_magic_service_error(str(error))


def test_generate_video_reads_runtime_video_model_context():
    model_context = AgentModelContext()
    model_context.apply_selection(AgentModelSelection(
        configured_text_model_id="mock-text-model",
        text_model_id="mock-text-model",
        video_model=VideoModelSpec.from_values(
            model_id="mock-video-model",
            video_generation_config={"sizes": [{"value": "mock-video-size"}]},
        ),
    ))
    tool_context = ToolContext()
    tool_context.register_extension("agent_context", type("MockAgentContext", (), {"model_context": model_context})())

    assert GenerateVideo._resolve_model("", tool_context) == "mock-video-model"
    assert GenerateVideo._resolve_video_generation_config("mock-video-model", tool_context) == {
        "sizes": [{"value": "mock-video-size"}],
    }


def test_generate_video_requires_video_model_when_context_has_none():
    model_context = AgentModelContext()
    tool_context = ToolContext()
    tool_context.register_extension("agent_context", type("MockAgentContext", (), {"model_context": model_context})())

    with pytest.raises(ValueError, match="未指定视频模型"):
        GenerateVideo._resolve_model("", tool_context)


def test_extract_magic_service_error_message_keeps_compatibility():
    response = {
        "error": {
            "code": 4018,
            "message": "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。",
            "request_id": "req-1",
        }
    }

    message = GenerateVideo._extract_magic_service_error_message(response)

    assert message == "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。 (code=4018, request_id=req-1)"


def test_generate_canvas_videos_prefers_provider_error_for_llm_visibility():
    explicit_error = "输入图片可能包含真人或人脸，请更换无真人、无肖像的素材后再试。 (code=4018)"
    result = VideoToolResult(
        ok=False,
        content="视频生成失败: Image generation service may be unavailable",
        videos=[],
        extra_info={"error": explicit_error, "error_code": "4018"},
    )

    assert GenerateCanvasVideos._extract_generate_error_message(result) == explicit_error


def test_generate_canvas_videos_keeps_non_visible_provider_error_wrapped():
    result = VideoToolResult(
        ok=False,
        content="视频生成失败: Image generation service may be unavailable",
        videos=[],
        extra_info={"error": "内部服务错误 (code=5000)", "error_code": "5000"},
    )

    assert GenerateCanvasVideos._extract_generate_error_message(result) == result.content


@pytest.mark.asyncio
async def test_execute_video_task_carries_error_message_to_result(tmp_path):
    explicit_error = "该提示词包含政治问题 (code=4018, request_id=req-1)"
    tool = GenerateCanvasVideos()

    class FakeGenerateTool:
        async def execute_purely(self, tool_context, params):
            return VideoToolResult(
                ok=False,
                content="视频生成失败",
                videos=[],
                extra_info={"error": explicit_error, "error_code": "4018"},
            )

    tool._generate_tool = FakeGenerateTool()
    task = VideoTaskSpec(
        prompt="森林中的小路。",
        name="错误信息测试",
        width=1280,
        height=720,
    )
    placeholder = ElementDetail(
        id="element-1",
        type="video",
        name="错误信息测试",
        x=0,
        y=0,
        width=1280,
        height=720,
    )

    result = await tool._execute_task_item(
        idx=0,
        task=task,
        placeholder=placeholder,
        tool_context=None,
        project_path=tmp_path,
        resolved_output_path="demo/videos",
    )

    assert not result.success
    assert result.error_message == explicit_error
    assert result.placeholder_update.errorMessage == explicit_error
