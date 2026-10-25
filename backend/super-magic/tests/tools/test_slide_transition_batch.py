import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.tools.slide_transitions import UpdateSlideTransitionsParams, merge_transitions
from app.tools.slide_transition_storage import (
    ProjectSnapshot, TransitionStorageError, save_project_snapshot,
)
from app.tools.update_slide_transitions import UpdateSlideTransitions


SLIDES = ["cover.html", "body.html", "summary.html"]
FADE = {"effect": "fade", "duration_ms": 400, "easing": "ease-in-out"}
PUSH = {"effect": "push", "duration_ms": 450, "easing": "linear", "direction": "left"}
ZOOM = {"effect": "zoom", "duration_ms": 450, "easing": "ease-in-out"}
STORAGE = "app.tools.slide_transition_storage"
TOOL = "app.tools.update_slide_transitions"


def batch(operations):
    return UpdateSlideTransitionsParams.model_validate({
        "project_path": "deck", "expected_slides": SLIDES, "operations": operations,
    })


def operations():
    return [
        {"operation": "set_default", "transition": FADE, "clear_overrides": True},
        {"operation": "set_slides", "slide_paths": [SLIDES[1]], "transition": PUSH},
        {"operation": "set_slides", "slide_paths": [SLIDES[2]], "transition": ZOOM},
    ]


def deck():
    return {"type": "slide", "slides": SLIDES, "unknown": {"keep": True},
            "transitions": {"default": {"effect": "none"}, "slides": {SLIDES[0]: PUSH}}}


def test_default_and_different_page_settings_are_merged_together():
    original = deck()
    updated = merge_transitions(original, batch(operations()))
    assert updated["transitions"] == {"default": FADE, "slides": {SLIDES[1]: PUSH, SLIDES[2]: ZOOM}}
    assert updated["unknown"] == original["unknown"]
    assert original["transitions"]["slides"] == {SLIDES[0]: PUSH}


def test_multiple_pages_can_share_a_setting_and_restore_another_page():
    updated = merge_transitions(deck(), batch([
        {"operation": "set_slides", "slide_paths": SLIDES[1:], "transition": FADE},
        {"operation": "clear_overrides", "slide_paths": [SLIDES[0]]},
    ]))
    assert updated["transitions"]["slides"] == {SLIDES[1]: FADE, SLIDES[2]: FADE}
    assert updated["transitions"]["default"] == {"effect": "none"}


@pytest.mark.parametrize("invalid", [
    [],
    [operations()[0], operations()[0]],
    [operations()[1], operations()[0]],
    [operations()[1], {"operation": "clear_overrides", "slide_paths": [SLIDES[1]]}],
    [operations()[0], {"operation": "set_slides", "slide_paths": [SLIDES[1]], "transition": {"effect": "spin"}}],
])
def test_invalid_or_ambiguous_batches_are_rejected(invalid):
    with pytest.raises(ValidationError):
        batch(invalid)


@pytest.mark.asyncio
@pytest.mark.parametrize("settings", [
    operations(),
    [operations()[0]],
    [operations()[1]],
    [{"operation": "set_slides", "slide_paths": SLIDES[1:], "transition": PUSH}],
])
async def test_tool_submits_one_protected_save_for_the_entire_batch(settings):
    source = "window.magicProjectConfig = " + json.dumps(deck()) + ";\nwindow.magicProjectConfigure(window.magicProjectConfig);"
    original = ProjectSnapshot("42", 7, source)
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))
    connection = MagicMock()
    connection.return_value.__aenter__.return_value = client
    tool = UpdateSlideTransitions(base_dir="/workspace")

    async def confirmed(*args):
        if client.save_file_content.await_count:
            return ProjectSnapshot("42", 8, client.save_file_content.await_args.args[1])
        return original

    with patch(f"{TOOL}.MagicServiceClient", connection), patch(f"{TOOL}.async_realpath", AsyncMock(side_effect=lambda path, **kwargs: Path(path))), patch(f"{TOOL}.read_project_snapshot", AsyncMock(return_value=original)), patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=confirmed)):
        result = await tool._update(batch(settings))
    assert result.ok
    assert result.data["revision"] == 8
    assert len(result.data["operations"]) == len(settings)
    assert client.save_file_content.await_count == 1
    assert client.save_file_content.await_args.args[::2] == ("42", 7)
    detail = await tool.get_tool_detail(None, result)
    if settings == [operations()[0]]:
        assert "body.html" not in detail.data.content
    else:
        assert "body.html" in detail.data.content


@pytest.mark.asyncio
async def test_unknown_target_in_last_operation_never_partially_saves():
    source = "window.magicProjectConfig = " + json.dumps(deck()) + ";\nwindow.magicProjectConfigure(window.magicProjectConfig);"
    original = ProjectSnapshot("42", 7, source)
    client = SimpleNamespace(save_file_content=AsyncMock())
    connection = MagicMock()
    connection.return_value.__aenter__.return_value = client
    tool = UpdateSlideTransitions(base_dir="/workspace")
    with patch(f"{TOOL}.MagicServiceClient", connection), patch(f"{TOOL}.async_realpath", AsyncMock(side_effect=lambda path, **kwargs: Path(path))), patch(f"{TOOL}.read_project_snapshot", AsyncMock(return_value=original)):
        with pytest.raises(TransitionStorageError, match="existing slide"):
            await tool._update(batch([operations()[0], {"operation": "set_slides", "slide_paths": ["missing.html"], "transition": FADE}]))
    client.save_file_content.assert_not_awaited()


@pytest.mark.asyncio
async def test_delayed_mount_confirmation_does_not_resubmit_after_three_reads():
    original = ProjectSnapshot("42", 7, "old")
    saved = ProjectSnapshot("42", 8, "new")
    pending = TransitionStorageError("Mounted copy is not synchronized", "conflict", diagnostics={"content_matches": False})
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={"success_files": [{"file_id": "42", "data": {"revision": 8}}]}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, pending, pending, pending, saved])), patch(f"{STORAGE}.CONFIRM_POLL_SECONDS", 0), patch(f"{STORAGE}.logger.info") as log:
        assert await save_project_snapshot(client, Path("/file"), original, "new") == saved
    client.save_file_content.assert_awaited_once_with("42", "new", 7)
    event = json.loads(log.call_args.args[1])
    assert event["last_sync_difference"] == {"content_matches": False}
    assert event["response_state"] == "received"
    assert event["acknowledged_revision"] == 8
    assert event["confirmed_revision"] == 8


@pytest.mark.asyncio
async def test_newer_unrelated_content_is_a_conflict_not_a_retry():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, ProjectSnapshot("42", 9, "another edit")])) as read:
        with pytest.raises(TransitionStorageError, match="another edit") as error:
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert error.value.outcome == "conflict"
    assert read.await_count == 2
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_confirmation_deadline_cancels_a_hanging_read_without_resaving():
    original = ProjectSnapshot("42", 7, "old")
    cancelled = asyncio.Event()
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))

    async def hanging_read(*args):
        if not client.save_file_content.await_count:
            return original
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=hanging_read)), patch(f"{STORAGE}.CONFIRM_TIMEOUT_SECONDS", 0.01):
        with pytest.raises(TransitionStorageError, match="outcome is unknown"):
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert cancelled.is_set()
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_cancellation_during_confirmation_propagates():
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, asyncio.CancelledError])):
        with pytest.raises(asyncio.CancelledError):
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_permission_loss_after_commit_is_unknown_and_stops_confirmation():
    from app.infrastructure.magic_service.exceptions import ApiError
    original = ProjectSnapshot("42", 7, "old")
    client = SimpleNamespace(save_file_content=AsyncMock(return_value={}))
    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=[original, ApiError("Forbidden", status_code=403)])) as read:
        with pytest.raises(TransitionStorageError, match="may already have committed") as error:
            await save_project_snapshot(client, Path("/file"), original, "new")
    assert error.value.outcome == "unknown"
    assert read.await_count == 2
    assert client.save_file_content.await_count == 1


@pytest.mark.asyncio
async def test_unchanged_batch_has_no_write_and_reports_no_changes():
    source = "window.magicProjectConfig = " + json.dumps(deck()) + ";\nwindow.magicProjectConfigure(window.magicProjectConfig);"
    original = ProjectSnapshot("42", 7, source)
    client = SimpleNamespace(save_file_content=AsyncMock())
    connection = MagicMock()
    connection.return_value.__aenter__.return_value = client
    tool = UpdateSlideTransitions(base_dir="/workspace")
    request = batch([{"operation": "set_default", "transition": {"effect": "none"}}])
    with patch(f"{TOOL}.MagicServiceClient", connection), patch(f"{TOOL}.async_realpath", AsyncMock(side_effect=lambda path, **kwargs: Path(path))), patch(f"{TOOL}.read_project_snapshot", AsyncMock(return_value=original)), patch(f"{STORAGE}.read_project_snapshot", AsyncMock(return_value=original)):
        result = await tool._update(request)
    assert result.ok
    assert "No changes were needed" in result.content
    assert result.extra_info["outcome"] == "unchanged"
    assert result.data["revision"] == 7
    client.save_file_content.assert_not_awaited()


@pytest.mark.asyncio
async def test_timeout_log_preserves_prior_sync_difference_and_submission_state():
    original = ProjectSnapshot("42", 7, "old", "parent")
    mismatch = {"mounted_revision": "7", "remote_revision": 8, "content_matches": False, "remote_size": 3}
    client = SimpleNamespace(save_file_content=AsyncMock(side_effect=TimeoutError))
    reads = 0

    async def read(*args):
        nonlocal reads
        reads += 1
        if reads == 1:
            return original
        if reads == 2:
            raise TransitionStorageError("Not synchronized", "conflict", diagnostics=mismatch)
        await asyncio.Event().wait()

    with patch(f"{STORAGE}.read_project_snapshot", AsyncMock(side_effect=read)), patch(f"{STORAGE}.CONFIRM_TIMEOUT_SECONDS", 0.02), patch(f"{STORAGE}.CONFIRM_POLL_SECONDS", 0), patch(f"{STORAGE}.logger.warning") as log:
        with pytest.raises(TransitionStorageError, match="unknown"):
            await save_project_snapshot(client, Path("/workspace/deck/magic.project.js"), original, "new")
    event = json.loads(log.call_args.args[1])
    assert event["last_sync_difference"] == mismatch
    assert event["last_read_error"]["error_type"] == "TimeoutError"
    assert event["response_state"] == "unavailable"
    assert event["submission_error_type"] == "TimeoutError"
    assert event["file_id"] == "42"
    assert event["parent_id"] == "parent"
    assert event["workspace_type"] == ".workspace"
    assert event["file_name"] == "magic.project.js"
    assert event["operation"] == "direct_overwrite"
    assert event["remote_size"] == 3
    assert client.save_file_content.await_count == 1


def test_operation_schema_description_is_english():
    schema = UpdateSlideTransitionsParams.model_json_schema()
    assert schema["$defs"]["SlideTransitionOperation"]["description"] == "One default or shared page transition update."
