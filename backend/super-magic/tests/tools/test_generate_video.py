from pathlib import Path

import pytest

from app.i18n import i18n
from app.infrastructure.magic_service.exceptions import ApiError
from app.tools.generate_video import GenerateVideo, GenerateVideoParams
from app.tools.get_video import GetVideo, GetVideoParams

VIDEO_CONFIG = {
    "supported_inputs": ["text_prompt", "image", "reference_videos", "reference_audios"],
    "generation": {
        "durations": [5, 10],
        "aspect_ratios": ["16:9"],
        "resolutions": ["768p"],
        "sizes": [{"value": "1366x768", "label": "16:9", "resolution": "768p"}],
        "supports_watermark": True,
    },
    "input_modes": {
        "standard": {"supported_fields": [], "task": "generate"},
        "omni_reference": {
            "supported_fields": ["reference_images", "reference_videos", "reference_audios"],
            "task": "generate",
        },
        "keyframe_guided": {"supported_fields": ["frames"], "task": "generate"},
    },
}


class _ModelContext:
    video_model_id = "MiniMax-H3"

    class video:
        video_generation_config = VIDEO_CONFIG


class _AgentContext:
    model_context = _ModelContext()


class _ToolContext:
    def get_extension(self, name):
        return _AgentContext() if name == "agent_context" else None


@pytest.mark.asyncio
async def test_tool_action_is_localized_for_ui():
    tool = GenerateVideo()
    try:
        i18n.set_language("zh_CN")
        zh_detail = await tool.get_before_tool_call_friendly_action_and_remark(
            "generate_video", None, {}
        )
        i18n.set_language("en_US")
        en_detail = await tool.get_before_tool_call_friendly_action_and_remark(
            "generate_video", None, {}
        )

        assert zh_detail["action"] == "生成视频"
        assert zh_detail["tool_name"] == "generate_video"
        assert en_detail["action"] == "Generate video"
    finally:
        i18n.reset_language()


def test_prompt_hint_keeps_video_and_audio_requirements():
    hint = GenerateVideo().get_prompt_hint()

    assert "generate_canvas_videos" not in hint
    assert "仅用于通用模式生成普通视频" in hint
    assert "Use only for regular video generation in general mode" in hint
    assert "旁白或对白" in hint
    assert "逐字保留" in hint
    assert all(word in hint for word in ("主体", "动作", "场景", "镜头", "光线", "节奏"))
    assert "用户要求时的音频要求" in hint
    assert "audio requirements when requested" in hint
    assert "do not call generate_images" in GenerateVideo._failure_content("test")
    assert "Generation failed" in GenerateVideo._failure_content("test")
    assert "Failure does not deduct points" in GenerateVideo._failure_content("test")
    assert "必须先调用 ask_user" in hint
    assert "保留原始要求继续尝试" in hint
    assert "风险降低调整" in hint
    assert "明确忽略附件或引用素材" in hint
    assert "不分析素材" in hint
    assert 'action="estimate_points"' in hint
    assert "结束当前轮并等待用户确认" in hint
    assert "完整逐字复制 Final Prompt" in hint
    assert "积分预估失败时，不得直接生成" in hint
    assert "使用 ask_user 提供选项" in hint
    assert "不得概括、改写或遗漏" in hint
    assert "口型同步和对应动作" in hint
    assert "explicitly ignores attachments or reference media" in hint
    assert "end the current turn and wait for confirmation" in hint
    assert "copy the complete Final Prompt verbatim" in hint
    assert "If estimation fails, do not generate directly" in hint
    assert "lip sync" in hint
    assert "matching actions" in hint
    assert "get_video" in hint
    assert 'action="query"' not in hint


def test_prompt_hint_is_structured_and_preserves_user_language():
    hint = GenerateVideo().get_prompt_hint()

    assert "**调用时机**" in hint
    assert "**Prompt 写法**" in hint
    assert "**When to call**" in hint
    assert "**Prompt writing**" in hint
    assert "prompt、video_name 使用用户所用的语言" in hint
    assert "output_path" not in hint.split("**语言规则**", 1)[1].split("-->", 1)[0]
    assert "用户所用的语言" in hint
    assert "保留原文" in hint
    assert "same language the user is using" in hint
    assert "complete or detailed prompt" in hint
    assert "crafted prompt" not in hint


def test_video_parameter_descriptions_are_bilingual_and_actionable():
    properties = GenerateVideoParams.model_json_schema()["properties"]

    for field_name in (
        "action",
        "prompt",
        "video_name",
        "output_path",
        "input_mode",
        "reference_image_paths",
        "frame_start_path",
        "duration_seconds",
        "size",
        "audio_policy",
    ):
        description = properties[field_name]["description"]
        assert "<!--zh:" in description
        assert "-->" in description
        assert description.rstrip().endswith(".")

    assert "生成时" in properties["prompt"]["description"]
    assert "用户未明确指定时省略" in properties["input_mode"]["description"]
    assert "通常省略" in properties["output_path"]["description"]
    assert "默认 videos" in properties["output_path"]["description"]
    assert "用户所用的语言" not in properties["output_path"]["description"]


def test_audio_policy_is_normalized_and_reaches_generation_payload():
    params = GenerateVideoParams(prompt="小猫游泳", model_id="veo-3.1", audio_policy="mute")
    config = {
        "generation": {
            "sizes": [{"value": "1366x768", "label": "16:9", "resolution": "768p"}],
            "durations": [5],
        }
    }

    assert GenerateVideo._build_generation(params, config, "veo-3.1")["generate_audio"] is False


def test_generate_audio_policy_allows_unknown_capability():
    GenerateVideo._validate_audio_policy(
        "generate",
        {},
        "unknown-video-model",
    )


@pytest.mark.parametrize(
    ("policy", "capability", "message"),
    [
        ("generate", {"supports_generate_audio": False}, "generated audio"),
        ("mute", {"supports_native_mute": False, "mute_fallback": "compose"}, "Canvas Video Edit"),
        ("mute", {"supports_native_mute": False, "mute_fallback": "unsupported"}, "Canvas Video Edit"),
    ],
)
def test_audio_policy_rejects_unsupported_regular_video_strategy(policy, capability, message):
    with pytest.raises(ValueError, match=message):
        GenerateVideo._validate_audio_policy(policy, capability, "minimax-h3")


@pytest.mark.asyncio
async def test_provider_asset_uri_is_forwarded_without_workspace_lookup(tmp_path):
    """Provider 素材 URI 必须原样透传，不能被当作本地文件解析。"""
    tool = GenerateVideo(base_dir=tmp_path)

    result = await tool._resolve_input_uri("asset://virtual-human-asset-id")

    assert result == "asset://virtual-human-asset-id"


def test_video_params_support_estimate_points_action():
    params = GenerateVideoParams(
        action="estimate_points",
        prompt="小猫游泳",
    )

    assert params.action == "estimate_points"


def test_video_params_do_not_expose_internal_polling_controls():
    properties = GenerateVideoParams.model_json_schema()["properties"]

    assert "poll_interval_seconds" not in properties
    assert "poll_timeout_seconds" not in properties
    assert "operation_id" not in properties


def test_tool_is_only_declared_by_general_agent():
    root = Path(__file__).parents[2]
    assert "- generate_video" in (root / "agents/magic.agent").read_text()
    assert "- generate_video" not in (root / "agents/design.agent").read_text()


def test_design_agent_preloads_canvas_manager_image_references():
    """设计 Agent 应预加载统一 Canvas Skill 的图片 reference。"""
    root = Path(__file__).parents[2]
    design_source = (root / "agents/design.agent").read_text()
    preload_section = design_source.split("  preload:", 1)[1].split(
        "  system_skills:", 1
    )[0]

    assert "- name: canvas-manager" in preload_section
    assert "- SKILL.md" in preload_section
    assert "- references/image-generation.md" in preload_section
    assert "- references/image-search.md" in preload_section
    assert "- references/prompt-library.md" in preload_section


def test_image_only_request_uses_image_reference_mode():
    config = {
        "input_modes": {
            "standard": {"supported_fields": [], "task": "generate"},
            "image_reference": {
                "supported_fields": ["reference_images"],
                "task": "generate",
            },
        }
    }
    params = GenerateVideoParams(prompt="让图片动起来", reference_image_paths=["image.png"])

    assert GenerateVideo._infer_input_mode(params, config) == "image_reference"


def test_text_request_fails_when_model_has_no_standard_mode():
    config = {
        "input_modes": {
            "image_reference": {
                "supported_fields": ["reference_images"],
                "task": "generate",
            },
        }
    }
    params = GenerateVideoParams(prompt="小猫游泳")

    with pytest.raises(ValueError, match="does not support text-to-video generation"):
        GenerateVideo._infer_input_mode(params, config)


@pytest.mark.parametrize(
    ("parameter", "value", "expected"),
    [
        ("aspect_ratio", "9:16", "Size 1366x768 requires aspect ratio 16:9"),
        ("resolution", "1080p", "Size 1366x768 requires resolution 768p"),
    ],
)
def test_explicit_size_must_match_explicit_generation_parameters(parameter, value, expected):
    config = {
        "generation": {
            "durations": [5],
            "aspect_ratios": ["16:9", "9:16"],
            "resolutions": ["768p", "1080p"],
            "sizes": [
                {"value": "1366x768", "label": "16:9", "resolution": "768p"},
                {"value": "1920x1080", "label": "16:9", "resolution": "1080p"},
            ],
        }
    }
    params = GenerateVideoParams(
        prompt="小猫游泳",
        size="1366x768",
        duration_seconds=5,
        **{parameter: value},
    )

    with pytest.raises(ValueError, match=expected):
        GenerateVideo._build_generation(params, config)


def test_duration_seconds_must_be_positive():
    with pytest.raises(ValueError, match="Duration must be greater than 0"):
        GenerateVideoParams(prompt="小猫游泳", duration_seconds=0)


def test_real_agent_string_arguments_are_normalized():
    params = GenerateVideoParams(
        prompt="小猫游泳",
        model_id="minimax-h3",
        input_mode="text_to_video",
        task="text_to_video",
        duration_seconds="5",
        fps="30",
        seed="",
        watermark="None",
    )

    assert params.input_mode == "standard"
    assert params.task == "generate"
    assert params.duration_seconds == 5
    assert params.fps == 30
    assert params.seed is None
    assert params.watermark is None


@pytest.mark.parametrize("input_mode", ["text_prompt", "text", "text_only"])
def test_text_input_mode_aliases_are_normalized_to_standard(input_mode):
    params = GenerateVideoParams(
        prompt="小猫游泳",
        input_mode=input_mode,
    )

    assert params.input_mode == "standard"


def test_model_id_match_is_case_insensitive_and_keeps_context_config():
    model_id, config = GenerateVideo._resolve_model_config(_ToolContext(), "minimax-h3")

    assert model_id == "MiniMax-H3"
    assert config is VIDEO_CONFIG


@pytest.mark.asyncio
async def test_generate_creates_task_without_querying_or_downloading(monkeypatch, tmp_path):
    tool = GenerateVideo(base_dir=tmp_path)
    requests = []

    class FakeMagicServiceClient:
        async def create_video(self, payload, request_id=""):
            requests.append(("create", payload, request_id))
            return {"id": "op-1", "status": "queued"}

        async def get_video_operation(self, operation_id, request_id=""):
            raise AssertionError("generate must not query the created task")

    tool._magic_service_client = FakeMagicServiceClient()
    monkeypatch.setattr(tool, "_business_params", lambda: {})

    result = await tool.execute_purely(
        _ToolContext(),
        GenerateVideoParams(
            prompt="小猫游泳，中文旁白：出发吧",
            duration_seconds=5,
            aspect_ratio="16:9",
            video_name="cat",
        ),
    )

    assert result.ok is True
    assert result.videos == []
    assert result.content == (
        'Video task created successfully. Task ID: op-1. Current status: queued. '
        'Continue with get_video using this task ID.'
    )
    assert result.data == {
        "operation": {"id": "op-1", "status": "queued"},
        "operation_id": "op-1",
        "status": "queued",
    }
    assert result.extra_info == {
        "operation_id": "op-1",
        "status": "queued",
    }
    assert requests[0][:2] == (
        "create",
        {
            "model_id": "MiniMax-H3",
            "task": "generate",
            "prompt": "小猫游泳，中文旁白：出发吧",
            "input_mode": "standard",
            "generation": {
                "aspect_ratio": "16:9",
                "duration_seconds": 5,
                "resolution": "768p",
                "size": "1366x768",
            },
        },
    )
    assert requests[0][2]
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_estimate_points_does_not_create_or_poll(monkeypatch, tmp_path):
    tool = GenerateVideo(base_dir=tmp_path)
    requests = []

    class FakeMagicServiceClient:
        async def estimate_video_points(self, payload, request_id=""):
            requests.append((payload, request_id))
            return {"resource_type": "video", "points": 12, "detail": {}}

        async def create_video(self, payload, request_id=""):
            raise AssertionError("estimate_points must not create a video")

        async def get_video_operation(self, operation_id, request_id=""):
            raise AssertionError("estimate_points must not poll")

    tool._magic_service_client = FakeMagicServiceClient()
    monkeypatch.setattr(tool, "_business_params", lambda: {})

    result = await tool.execute_purely(
        _ToolContext(),
        GenerateVideoParams(
            action="estimate_points",
            prompt="小猫在泳池里游泳",
            duration_seconds=5,
            aspect_ratio="16:9",
            resolution="768p",
        ),
    )

    assert result.ok is True
    assert result.videos == []
    assert result.data["points"] == 12
    assert result.data["prompt"] == "小猫在泳池里游泳"
    assert result.data["generation"]["duration_seconds"] == 5
    assert "12 points" in result.content
    assert "<final_prompt>小猫在泳池里游泳</final_prompt>" in result.content
    assert "copy the complete Final Prompt verbatim" in result.content
    assert "Do not summarize narration or dialogue" in result.content
    assert len(requests) == 1
    assert requests[0][1]


@pytest.mark.asyncio
async def test_estimate_failure_requires_user_choice_before_generation(tmp_path):
    tool = GenerateVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def estimate_video_points(self, payload, request_id=""):
            raise ApiError("estimate endpoint unavailable", status_code=405)

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        _ToolContext(),
        GenerateVideoParams(action="estimate_points", prompt="小猫游泳"),
    )

    assert result.ok is False
    assert "Point estimation failed" in result.content
    assert "estimate endpoint unavailable" in result.content
    assert "use the ask_user tool" in result.content
    assert "continue without point estimation" in result.content
    assert "revise the request" in result.content
    assert "cancel" in result.content
    assert "do not generate until the user chooses" in result.content
    assert result.data["error_code"] == "estimate_failed"
    assert result.data["points_deducted"] is False
    assert result.extra_info["error_code"] == "estimate_failed"
    assert result.extra_info["points_deducted"] is False


@pytest.mark.asyncio
async def test_query_existing_operation_does_not_create_new_task(tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    requests = []

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            requests.append((operation_id, request_id))
            return {
                "id": "op-existing",
                "status": "failed",
                "error": {"code": "content_policy", "message": "blocked"},
            }

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-existing", wait_mode="once"),
    )

    assert result.ok is False
    assert result.extra_info["operation_id"] == "op-existing"
    assert result.extra_info["error_code"] == "content_policy"
    assert result.extra_info["points_deducted"] is False
    assert result.data["operation"]["status"] == "failed"
    assert "ask_user" in result.content
    assert "Failure does not deduct points" in result.content
    assert requests[0][0] == "op-existing"
    assert requests[0][1]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "expected_content"),
    [
        ("failed", "Video generation failed: provider error; Failure does not deduct points."),
        ("canceled", "Video generation was canceled; Failure does not deduct points."),
    ],
)
async def test_query_terminal_failure_has_consistent_structure(
    tmp_path, status, expected_content
):
    tool = GetVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            return {
                "id": operation_id,
                "status": status,
                "error": {"code": "provider_error", "message": "provider error"},
            }

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-terminal", wait_mode="once"),
    )

    assert result.ok is False
    assert result.content == expected_content
    assert result.data["operation_id"] == "op-terminal"
    assert result.data["status"] == status
    assert result.data["error_code"] == "provider_error"
    assert result.data["points_deducted"] is False
    assert result.extra_info["operation_id"] == "op-terminal"
    assert result.extra_info["status"] == status
    assert result.extra_info["error_code"] == "provider_error"
    assert result.extra_info["points_deducted"] is False


@pytest.mark.asyncio
async def test_query_processing_returns_immediately_and_keeps_operation_id(tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    requests = []

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            requests.append((operation_id, request_id))
            return {"id": operation_id, "status": "processing"}

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-processing", wait_mode="once"),
    )

    assert result.ok is True
    assert result.content == (
        'Video task is still processing. Task ID: op-processing. Current status: processing. '
        "Call get_video again later."
    )
    assert result.data == {
        "operation": {"id": "op-processing", "status": "processing"},
        "operation_id": "op-processing",
        "status": "processing",
    }
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_query_succeeded_downloads_video_once(monkeypatch, tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    requests = []

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            requests.append((operation_id, request_id))
            return {
                "id": operation_id,
                "status": "succeeded",
                "output": {"video_url": "https://cdn/video.mp4"},
            }

    async def fake_download(_tool_context, url, output_path, video_name, override):
        return str(tmp_path / "videos/video.mp4"), "videos/video.mp4"

    tool._magic_service_client = FakeMagicServiceClient()
    monkeypatch.setattr(tool, "_download_video", fake_download)

    result = await tool.execute_purely(
        _ToolContext(),
        GetVideoParams(
            operation_id="op-succeeded",
            wait_mode="once",
            video_name="cat",
        ),
    )

    assert result.ok is True
    assert result.content == "Video generated successfully. Saved to: videos/video.mp4."
    assert result.videos == [str(tmp_path / "videos/video.mp4")]
    assert result.data["operation_id"] == "op-succeeded"
    assert result.data["status"] == "succeeded"
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_query_succeeded_without_video_url_returns_structured_failure(tmp_path):
    tool = GetVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            return {"id": operation_id, "status": "succeeded", "output": {}}

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-no-url", wait_mode="once"),
    )

    assert result.ok is False
    assert result.content == (
        "Video request is invalid: Video task succeeded but output.video_url is missing."
    )
    assert result.data["operation_id"] == "op-no-url"
    assert result.data["status"] == "succeeded"
    assert result.data["error_code"] == "invalid_request"
    assert result.data["points_deducted"] is False


@pytest.mark.asyncio
async def test_generate_missing_operation_id_returns_structured_failure(
    monkeypatch, tmp_path
):
    tool = GenerateVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def create_video(self, payload, request_id=""):
            return {"status": "queued"}

    tool._magic_service_client = FakeMagicServiceClient()
    monkeypatch.setattr(tool, "_business_params", lambda: {})

    result = await tool.execute_purely(
        _ToolContext(),
        GenerateVideoParams(prompt="小猫游泳"),
    )

    assert result.ok is False
    assert result.content == (
        "Video request is invalid: Video API response is missing operation_id."
    )
    assert result.data["operation_id"] is None
    assert result.data["status"] == "unknown"
    assert result.data["error_code"] == "invalid_request"
    assert result.data["points_deducted"] is False


@pytest.mark.asyncio
async def test_payload_includes_all_supported_inputs_and_generation_fields(monkeypatch, tmp_path):
    tool = GenerateVideo(base_dir=tmp_path)
    monkeypatch.setattr(tool, "_resolve_input_uri", _identity_uri)

    payload = await tool._build_payload(
        _ToolContext(),
        GenerateVideoParams(
            prompt="产品视频",
            task="generate",
            input_mode="omni_reference",
            reference_image_paths=["image.png"],
            reference_video_paths=["video.mp4"],
            reference_audio_paths=["audio.mp3"],
            size="1366x768",
            duration_seconds=5,
            aspect_ratio="16:9",
            resolution="768p",
            fps=24,
            seed=7,
            watermark=True,
        ),
    )

    assert payload["inputs"] == {
        "reference_images": [{"uri": "image.png"}],
        "reference_videos": [{"uri": "video.mp4"}],
        "reference_audios": [{"uri": "audio.mp3"}],
    }
    assert payload["input_mode"] == "omni_reference"
    assert payload["task"] == "generate"
    assert payload["generation"] == {
        "size": "1366x768",
        "duration_seconds": 5,
        "aspect_ratio": "16:9",
        "resolution": "768p",
        "fps": 24,
        "seed": 7,
        "watermark": True,
    }


@pytest.mark.asyncio
async def test_missing_model_fails_explicitly(tmp_path):
    result = await GenerateVideo(base_dir=tmp_path).execute_purely(
        None,
        GenerateVideoParams(prompt="小猫游泳"),
    )

    assert result.ok is False
    assert "No video model is available" in result.content


@pytest.mark.asyncio
async def test_query_error_preserves_operation_id(tmp_path):
    tool = GetVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def get_video_operation(self, operation_id, request_id=""):
            raise ApiError("missing", status_code=404)

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-error", wait_mode="once"),
    )

    assert result.ok is False
    assert result.extra_info["operation_id"] == "op-error"
    assert result.extra_info["error_code"] == "not_found"
    assert result.extra_info["points_deducted"] is False
    assert result.content == "Video task was not found. Check the task ID before querying again."


@pytest.mark.asyncio
async def test_generate_content_restriction_guides_agent_to_ask_user(tmp_path):
    tool = GenerateVideo(base_dir=tmp_path)

    class FakeMagicServiceClient:
        async def create_video(self, payload, request_id=""):
            raise ApiError(
                "request blocked",
                status_code=400,
                response_data={
                    "error": {"code": "content_policy", "message": "blocked"}
                },
            )

    tool._magic_service_client = FakeMagicServiceClient()

    result = await tool.execute_purely(
        _ToolContext(),
        GenerateVideoParams(prompt="测试视频"),
    )

    assert result.ok is False
    assert result.extra_info["error_code"] == "content_policy"
    assert result.extra_info["points_deducted"] is False
    assert "ask_user" in result.content
    assert "risk-reduced adjustment" in result.content


@pytest.mark.asyncio
@pytest.mark.parametrize("chunks", [[b"12", RuntimeError("interrupted")], [b"12345"]])
async def test_download_failure_leaves_no_target_or_temp(monkeypatch, tmp_path, chunks):
    tool = GenerateVideo(base_dir=tmp_path)
    monkeypatch.setattr("app.tools.generate_video.aiohttp.ClientSession", lambda: _FakeSession(chunks))
    monkeypatch.setattr("app.tools.generate_video.MAX_DOWNLOAD_BYTES", 4)

    with pytest.raises((RuntimeError, ValueError)):
        await tool._download_video(None, "https://cdn/video.mp4", "videos", "broken", False)

    output = tmp_path / "videos"
    assert not (output / "broken.mp4").exists()
    assert list(output.glob("*.part")) == []


async def _identity_uri(value):
    return value


class _FakeContent:
    def __init__(self, chunks):
        self.chunks = chunks

    async def iter_chunked(self, _size):
        for chunk in self.chunks:
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk


class _FakeResponse:
    status = 200

    def __init__(self, chunks):
        self.content = _FakeContent(chunks)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False


class _FakeSession:
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    def get(self, *_args, **_kwargs):
        return _FakeResponse(self.chunks)
