import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.tools.slide_transitions import (
    SlideTransition, UpdateSlideTransitionsParams, merge_transitions, update_project_content,
)
from app.tools.slide_transition_storage import (
    ProjectSnapshot, TransitionStorageError, read_project_snapshot, save_project_snapshot,
)
from app.tools.update_slide_transitions import UpdateSlideTransitions
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.exceptions import ApiError

SLIDES = ["cover.html", "chapter.html", "end.html"]
FADE = {"effect": "fade", "duration_ms": 400, "easing": "ease-in-out"}
PUSH = {"effect": "push", "duration_ms": 300, "easing": "linear", "direction": "left"}
STORAGE = "app.tools.slide_transition_storage"


def params(**changes):
    expected_slides = changes.pop("expected_slides", SLIDES)
    operations = changes.pop("operations", None)
    return UpdateSlideTransitionsParams.model_validate({
        "project_path": "deck", "expected_slides": expected_slides,
        "operations": operations if operations is not None else [{
            "operation": "set_slides", "slide_paths": [SLIDES[1]], "transition": FADE, **changes,
        }],
    })


def config():
    return {"type": "slide", "slides": SLIDES.copy(), "name": "Test",
            "hidden_slides": [SLIDES[2]], "unknown": {"keep": [1, 2]},
            "transitions": {"default": PUSH, "slides": {SLIDES[0]: {"effect": "none"}}}}


@pytest.mark.parametrize("setting", [
    {"effect": "spin"}, {"effect": "none", "duration_ms": 400},
    {"effect": "none", "easing": None}, {**FADE, "duration_ms": 125},
    {**FADE, "duration_ms": 99}, {**FADE, "duration_ms": 2050},
    {**FADE, "duration_ms": True}, {**FADE, "duration_ms": "400"},
    {**FADE, "duration_ms": 400.0}, {**FADE, "easing": "steps(4)"},
    {**FADE, "direction": "left"}, {**FADE, "direction": None},
    {**PUSH, "direction": None}, {**PUSH, "direction": "diagonal"},
    {**FADE, "script": "alert(1)"}, {"effect": "fade", "duration_ms": 400},
])
def test_rejects_invalid_parameters(setting):
    with pytest.raises(ValidationError):
        SlideTransition.model_validate(setting)


@pytest.mark.parametrize("effect", ["fade", "zoom", "push", "cover", "wipe"])
def test_supported_effects(effect):
    setting = {**FADE, "effect": effect}
    if effect in {"push", "cover", "wipe"}:
        setting["direction"] = "up"
    assert SlideTransition.model_validate(setting).effect == effect


def test_partial_scope_preserves_settings_and_unknown_fields():
    original = config()
    changed = merge_transitions(original, params())
    assert changed["transitions"]["default"] == PUSH
    assert changed["transitions"]["slides"] == {SLIDES[0]: {"effect": "none"}, SLIDES[1]: FADE}
    assert changed["unknown"] == original["unknown"]
    assert changed["slides"] == original["slides"]
    assert changed["hidden_slides"] == original["hidden_slides"]
    assert SLIDES[1] not in original["transitions"]["slides"]


def test_clear_override_is_different_from_none():
    original = config()
    changed = merge_transitions(original, params(operation="clear_overrides", transition=None, slide_paths=[SLIDES[0]]))
    assert changed["transitions"] == {"default": PUSH}
    changed = merge_transitions(original, params(transition={"effect": "none"}))
    assert changed["transitions"]["slides"][SLIDES[1]] == {"effect": "none"}


def test_all_pages_and_default_only_are_distinct():
    original = config()
    changed = merge_transitions(original, params(operation="set_default", slide_paths=[]))
    assert changed["transitions"]["slides"] == original["transitions"]["slides"]
    changed = merge_transitions(original, params(operation="set_default", slide_paths=[], clear_overrides=True, transition={"effect": "none"}))
    assert changed["transitions"] == {"default": {"effect": "none"}}


def test_reordered_deck_is_rejected():
    changed = config()
    changed["slides"].reverse()
    with pytest.raises(ValueError, match="order changed"):
        merge_transitions(changed, params())


@pytest.mark.parametrize("path", ["../a.html", "/a.html", "a/../b.html", "./a.html", "a//b.html", "__proto__", "https://a.html", "a.html#x"])
def test_rejects_unsafe_paths(path):
    with pytest.raises(ValidationError):
        params(slide_paths=[path])


def test_json_wrapper_and_nested_fields_are_preserved():
    source = "window.magicProjectConfig = " + json.dumps(config()) + ";\nwindow.magicProjectConfigure(window.magicProjectConfig);\n"
    output = update_project_content(source, params())
    assert output.endswith(";\nwindow.magicProjectConfigure(window.magicProjectConfig);\n")
    assert json.loads(output.split(" = ", 1)[1].split(";\n", 1)[0])["unknown"] == config()["unknown"]


@pytest.mark.parametrize("source", [
    'window.magicProjectConfig = {"slides":[],"slides":[]};window.magicProjectConfigure(window.magicProjectConfig);',
    'window.magicProjectConfig = {"type":"slide","slides":[]};alert(1);',
    'window.magicProjectConfig = (() => ({}))();',
])
def test_ambiguous_or_executable_config_rejected(source):
    with pytest.raises(ValueError):
        update_project_content(source, params())


@pytest.mark.asyncio
async def test_snapshot_matches_remote_and_mounted_metadata_revision():
    client = SimpleNamespace(get_file_metadata=AsyncMock(return_value={"id": "42", "version": 7, "latest_version": 2, "name": "magic.project.js", "is_directory": False}))
    with patch(f"{STORAGE}.get_file_id_from_xattr", AsyncMock(return_value="42")), patch(f"{STORAGE}.get_metadata_version_from_xattr", AsyncMock(return_value="7")), patch(f"{STORAGE}._read_remote_content", AsyncMock(return_value="content")), patch(f"{STORAGE}.async_read_text", AsyncMock(return_value="content")):
        assert await read_project_snapshot(client, Path("/workspace/deck/magic.project.js")) == ProjectSnapshot("42", 7, "content")


@pytest.mark.asyncio
async def test_stale_mount_rejected_even_with_stable_remote_revision():
    client = SimpleNamespace(get_file_metadata=AsyncMock(return_value={"id": "42", "version": 7, "name": "magic.project.js"}))
    with patch(f"{STORAGE}.get_file_id_from_xattr", AsyncMock(return_value="42")), patch(f"{STORAGE}.get_metadata_version_from_xattr", AsyncMock(return_value="7")), patch(f"{STORAGE}._read_remote_content", AsyncMock(return_value="new")), patch(f"{STORAGE}.async_read_text", AsyncMock(return_value="old")):
        with pytest.raises(TransitionStorageError, match="not synchronized"):
            await read_project_snapshot(client, Path("/workspace/deck/magic.project.js"))


@pytest.mark.asyncio
async def test_save_uses_metadata_revision_and_preserves_file_identity():
    original = ProjectSnapshot("42", 7, "old")
    saved = ProjectSnapshot("42", 8, "new")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={"success_files": [{"file_id": "42", "data": {"revision": 8}}]}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, saved])):
        assert await save_project_snapshot(client, Path("/file"), original, "new") == saved
    client.save_file_content.assert_awaited_once_with("42", "new", 7)


@pytest.mark.asyncio
async def test_preflight_conflict_never_submits():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock())
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=ProjectSnapshot("42", 8, "other"))):
        with pytest.raises(TransitionStorageError, match="changed"):
            await save_project_snapshot(client, Path("/file"), original, "new")
    client.save_file_content.assert_not_awaited()


@pytest.mark.asyncio
async def test_server_conflict_never_retries():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={"error_files": [{"file_id": "42", "error_code": 51152}]}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=original)):
        with pytest.raises(TransitionStorageError, match="Version conflict"):
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_timeout_confirms_commit_without_resubmitting():
    original = ProjectSnapshot("42", 7, "old")
    saved = ProjectSnapshot("42", 8, "new")
    client = SimpleNamespace(save_file_content=AsyncMock(side_effect=TimeoutError))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, saved])):
        assert await save_project_snapshot(client, Path("/file"), original, "new") == saved
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_acknowledged_save_with_stale_mount_is_unknown():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={"success_files": [{"file_id": "42", "data": {"revision": 8}}]}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=original)), patch(f"{STORAGE}.CONFIRM_TIMEOUT_SECONDS", 0.01):
        with pytest.raises(TransitionStorageError, match="outcome is unknown") as error:
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert error.value.outcome == "unknown"
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_cancel_propagates_without_retrying_save():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(side_effect=asyncio.CancelledError))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=original)):
        with pytest.raises(asyncio.CancelledError):
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_client_uses_existing_protected_route_and_rejects_missing_user_auth():
    client = MagicServiceClient.__new__(MagicServiceClient)
    client._request_user_file_json = AsyncMock(return_value={})
    await client.save_file_content("42", "content", 7)
    client._request_user_file_json.assert_awaited_once_with("POST", "/api/v1/super-agent/file/save", [{"file_id": "42", "content": "content", "expected_revision": 7}])
    client._build_json_headers = lambda: {"Authorization": "service-key"}
    with pytest.raises(ApiError, match="User authorization"):
        await MagicServiceClient._request_user_file_json(client, "POST", "/save", [])


@pytest.mark.asyncio
async def test_tool_interrupts_waiting_work():
    event = asyncio.Event()
    event.set()
    tool = SimpleNamespace(_update=AsyncMock())
    context = SimpleNamespace(get_extension=lambda _: SimpleNamespace(get_interruption_event=lambda: event))
    with patch("app.tools.update_slide_transitions.start_tool_keep_alive", return_value=None):
        with pytest.raises(asyncio.CancelledError):
            await UpdateSlideTransitions.execute(tool, context, params())


def test_safe_object_literal_with_comments_and_nested_unknown_fields():
    source = '''// Deck configuration
window.magicProjectConfig = {
    type: 'slide', slides: ['cover.html', 'chapter.html', 'end.html',],
    unknown: {caption: "brace }; and // inside a string", enabled: true,},
};
window.magicProjectConfigure(window.magicProjectConfig);
'''
    output = update_project_content(source, params())
    assert output.startswith("// Deck configuration\n")
    assert '"brace }; and // inside a string"' in output
    assert '"enabled": true' in output


@pytest.mark.parametrize("value", ["alert(1)", "function() {}", "window.x", "{get x(){return 1}}", "NaN", "Infinity", "{...other}"])
def test_object_literal_rejects_executable_values(value):
    source = 'window.magicProjectConfig = {type:"slide",slides:[],value:' + value + '};window.magicProjectConfigure(window.magicProjectConfig);'
    with pytest.raises(ValueError):
        update_project_content(source, params())


@pytest.mark.asyncio
async def test_authenticated_client_forwards_user_identity_and_metadata_endpoint():
    from unittest.mock import MagicMock
    response = SimpleNamespace(status=200, json=AsyncMock(return_value={"code": 1000, "data": {"file": {"id": "42", "version": 7, "latest_version": 2}}}))
    request = MagicMock()
    request.return_value.__aenter__.return_value = response
    client = MagicServiceClient.__new__(MagicServiceClient)
    client.config = SimpleNamespace(api_base_url="https://magic.example/api/v1")
    client.session = SimpleNamespace(request=request)
    client._build_json_headers = lambda: {"User-Authorization": "user-token", "Magic-Authorization": "sandbox-token"}
    metadata = await client.get_file_metadata("42")
    assert metadata["version"] == 7
    assert request.call_args.args == ("POST", "https://magic.example/api/v1/open-api/magicfs/files/42/queries")
    assert request.call_args.kwargs["headers"]["User-Authorization"] == "user-token"


@pytest.mark.asyncio
async def test_agent_and_tool_registration_and_transition_reference():
    import app.tools
    from app.tools.core import tool_factory
    from agentlang.agent.define.parser import parse_agent_file
    from app.utils.async_file_utils import async_read_text
    root = Path(__file__).parents[2]
    source = await async_read_text(root / "agents/slider.agent")
    define = parse_agent_file(source)[0]
    assert "UpdateSlideTransitions" in app.tools.__all__
    assert "update_slide_transitions" not in define.tools_config
    assert UpdateSlideTransitions.code_mode_only is True
    assert tool_factory.is_code_mode_only_tool("update_slide_transitions") is True
    assert "update_slide_transitions" not in tool_factory.get_llm_direct_tool_names()
    assert tool_factory.get_tool_instance("update_slide_transitions").allow_code_mode() is True
    assert "creating-slides" in define.skills_config.get_system_skill_names()
    reference = await async_read_text(root / "agents/skills/creating-slides/references/slide-transitions.md")
    assert "expected_slides" in reference
    assert "Do not automatically retry" in reference
    assert "run_sdk_snippet" in reference
    assert 'tool.call("update_slide_transitions"' in reference


@pytest.mark.asyncio
@pytest.mark.parametrize("code_mode", [False, True])
async def test_executor_requires_code_mode_for_transition_updates(code_mode):
    from agentlang.context.tool_context import ToolContext
    from agentlang.tools.tool_result import ToolResult
    from app.tools.core.tool_executor import ToolExecutor
    context = ToolContext(tool_name="update_slide_transitions", tool_call_id="transition-test")
    context.register_extension("is_code_mode", code_mode)
    # 隔离文件服务写入；保留真实执行器入口、注册策略和参数校验。
    with patch.object(UpdateSlideTransitions, "_update", AsyncMock(return_value=ToolResult(content="Saved and confirmed."))) as update:
        result = await ToolExecutor().execute_tool_call(context, params().model_dump(mode="json", exclude_none=True))
    assert result.ok is code_mode
    if code_mode:
        update.assert_awaited_once()
        assert update.await_args.args[0].expected_slides == SLIDES
    else:
        assert "Code Mode only" in result.content
        update.assert_not_awaited()


@pytest.mark.asyncio
async def test_replaced_file_identity_cannot_confirm_a_save():
    original = ProjectSnapshot("42", 7, "old")
    replaced = ProjectSnapshot("43", 8, "new")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, replaced])):
        with pytest.raises(TransitionStorageError, match="replaced"):
            await save_project_snapshot(client, Path("/file"), original, "new")


@pytest.mark.asyncio
async def test_permission_denied_does_not_attempt_confirmation_or_retry():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(side_effect=ApiError("Forbidden", status_code=403)))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=original)) as read:
        with pytest.raises(TransitionStorageError, match="permission") as error:
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert error.value.outcome == "permission"
    assert read.await_count == 1
    assert client.save_file_content.await_count == 1
