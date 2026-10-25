import json
from unittest.mock import AsyncMock, patch

import pytest

from app.path_manager import PathManager
from app.service.mention.utils.micro_app_prompt import (
    clear_micro_app_project_scope,
    extract_micro_app_app_ids,
    get_current_micro_app_mention_state,
    get_mentioned_micro_app_ids,
    get_micro_app_project_scopes,
    persist_micro_app_project_scopes,
    resolve_magicbase_project_id,
    sync_micro_app_project_scope_from_prompt,
    sync_micro_app_scope_from_mentions,
)


def _use_tmp_runtime(tmp_path, monkeypatch):
    runtime_dir = tmp_path / ".runtime"
    monkeypatch.setattr(
        PathManager,
        "get_runtime_dir",
        classmethod(lambda cls: runtime_dir),
    )
    monkeypatch.setattr(
        PathManager,
        "get_client_message_metadata_file",
        classmethod(lambda cls: tmp_path / "metadata.json"),
    )
    return runtime_dir


def _read_scope_file(runtime_dir):
    return json.loads((runtime_dir / "micro-app" / "scope.json").read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def isolate_runtime_scope(tmp_path, monkeypatch):
    _use_tmp_runtime(tmp_path, monkeypatch)


def test_extract_micro_app_app_ids_from_rich_text():
    prompt = (
        '{"type":"doc","content":[{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-1"}}},{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-1"}}},{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-2"}}}]}'
    )
    assert extract_micro_app_app_ids(prompt) == ["app-1", "app-2"]


def test_extract_micro_app_app_ids_ignores_plain_text_mentions_and_urls():
    assert extract_micro_app_app_ids("@Demo App https://example.test/micro-app://app-1") == []


@pytest.mark.asyncio
async def test_persist_micro_app_project_scopes_writes_runtime_scope_file(tmp_path, monkeypatch):
    runtime_dir = _use_tmp_runtime(tmp_path, monkeypatch)
    metadata_file = tmp_path / "metadata.json"
    metadata_file.write_text(json.dumps({"authorization": "keep-me"}), encoding="utf-8")
    scopes = {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
    }

    await persist_micro_app_project_scopes(scopes)

    saved = _read_scope_file(runtime_dir)
    assert saved["scopes"] == scopes
    assert saved["mentioned_app_ids"] == ["app-1"]
    assert "legacy_project_id" not in saved
    assert json.loads(metadata_file.read_text(encoding="utf-8")) == {"authorization": "keep-me"}


@pytest.mark.asyncio
async def test_persist_micro_app_project_scopes_writes_multiple_apps(
    tmp_path, monkeypatch
):
    runtime_dir = _use_tmp_runtime(tmp_path, monkeypatch)
    scopes = {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }

    await persist_micro_app_project_scopes(scopes)

    saved = _read_scope_file(runtime_dir)
    assert saved["scopes"] == scopes
    assert saved["mentioned_app_ids"] == ["app-1", "app-2"]
    assert "legacy_project_id" not in saved


@pytest.mark.asyncio
async def test_get_micro_app_project_scopes_normalizes_registry(tmp_path, monkeypatch):
    runtime_dir = _use_tmp_runtime(tmp_path, monkeypatch)
    scope_file = runtime_dir / "micro-app" / "scope.json"
    scope_file.parent.mkdir(parents=True)
    scope_file.write_text(
        json.dumps(
            {
                "scopes": {
                    "app-1": {"project_id": "project-1", "app_name": "App One"},
                    "": {"project_id": "ignored"},
                    "app-2": {"project_id": ""},
                }
            }
        ),
        encoding="utf-8",
    )

    assert get_micro_app_project_scopes() == {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
    }


def test_get_mentioned_micro_app_ids_ignores_unresolved_ids(tmp_path, monkeypatch):
    runtime_dir = _use_tmp_runtime(tmp_path, monkeypatch)
    scope_file = runtime_dir / "micro-app" / "scope.json"
    scope_file.parent.mkdir(parents=True)
    scope_file.write_text(
        json.dumps(
            {
                "scopes": {"app-1": {"project_id": "project-1", "app_name": "App One"}},
                "mentioned_app_ids": ["app-1", "app-2"],
            }
        ),
        encoding="utf-8",
    )

    assert get_mentioned_micro_app_ids() == ["app-1"]
    assert resolve_magicbase_project_id() == "project-1"


def test_resolve_magicbase_project_id_auto_selects_single_scope():
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=["app-1"],
        ),
    ):
        assert resolve_magicbase_project_id() == "project-1"


def test_resolve_magicbase_project_id_accepts_app_id_for_single_scope():
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=["app-1"],
        ),
    ):
        assert resolve_magicbase_project_id("app-1") == "project-1"


def test_resolve_magicbase_project_id_requires_app_id_for_multiple_scopes():
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={
                "app-1": {"project_id": "project-1", "app_name": "App One"},
                "app-2": {"project_id": "project-2", "app_name": "App Two"},
            },
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=["app-1", "app-2"],
        ),
    ):
        with pytest.raises(ValueError, match="Pass app_id"):
            resolve_magicbase_project_id()
        assert resolve_magicbase_project_id("app-2") == "project-2"


def test_resolve_magicbase_project_id_does_not_auto_select_partial_scope():
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=["app-1", "app-2"],
        ),
    ):
        with pytest.raises(ValueError, match="Pass app_id"):
            resolve_magicbase_project_id()
        assert resolve_magicbase_project_id("app-1") == "project-1"
        with pytest.raises(ValueError, match="not in the current mention scope"):
            resolve_magicbase_project_id("app-2")


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_resolves_via_sdk():
    mentions = [
        {
            "type": "micro_app",
            "app_id": "app-1",
            "project_id": "forged-project",
            "app_name": "App One",
        }
    ]
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(return_value="trusted-project"),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=[],
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.persist_micro_app_project_scopes"
        ) as persist_mock,
    ):
        scopes = await sync_micro_app_scope_from_mentions(mentions)

    assert scopes == {
        "app-1": {"project_id": "trusted-project", "app_name": "App One"}
    }
    persist_mock.assert_awaited_once_with(
        scopes,
        mentioned_app_ids=["app-1"],
    )


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_skips_when_sdk_fails(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    mentions = [{"type": "micro_app", "app_id": "app-1", "project_id": "forged-project"}]
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.persist_micro_app_project_scopes"
        ) as persist_mock,
        patch(
            "app.service.mention.utils.micro_app_prompt.clear_micro_app_project_scope"
        ) as clear_mock,
    ):
        scopes = await sync_micro_app_scope_from_mentions(mentions)

    assert scopes == {}
    persist_mock.assert_not_called()
    clear_mock.assert_not_called()


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_keeps_scope_without_micro_apps(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    with patch(
        "app.service.mention.utils.micro_app_prompt.clear_micro_app_project_scope"
    ) as clear_mock:
        scopes = await sync_micro_app_scope_from_mentions(
            [{"type": "file", "file_path": "./notes.md"}]
        )

    assert scopes == {}
    clear_mock.assert_not_called()


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_binds_multiple_mentions():
    mentions = [
        {"type": "micro_app", "app_id": "app-1", "app_name": "App One"},
        {"type": "micro_app", "app_id": "app-2", "app_name": "App Two"},
    ]
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(side_effect=lambda app_id: f"project-{app_id.split('-')[1]}"),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=[],
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.persist_micro_app_project_scopes"
        ) as persist_mock,
    ):
        scopes = await sync_micro_app_scope_from_mentions(mentions)
    assert scopes == {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }
    persist_mock.assert_awaited_once_with(
        scopes,
        mentioned_app_ids=["app-1", "app-2"],
    )


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_keeps_partial_bind_incomplete():
    mentions = [
        {"type": "micro_app", "app_id": "app-1", "app_name": "App One"},
        {"type": "micro_app", "app_id": "app-2", "app_name": "App Two"},
    ]
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(side_effect=lambda app_id: "project-1" if app_id == "app-1" else None),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=[],
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.persist_micro_app_project_scopes"
        ) as persist_mock,
    ):
        scopes = await sync_micro_app_scope_from_mentions(mentions)

    assert scopes == {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    persist_mock.assert_awaited_once_with(
        scopes,
        mentioned_app_ids=["app-1"],
    )


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_merges_into_existing(tmp_path, monkeypatch):
    _use_tmp_runtime(tmp_path, monkeypatch)
    await persist_micro_app_project_scopes(
        {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    )
    with patch(
        "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
        new=AsyncMock(return_value="project-2"),
    ):
        scopes = await sync_micro_app_scope_from_mentions(
            [{"type": "micro_app", "app_id": "app-2", "app_name": "App Two"}]
        )

    assert scopes == {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }
    assert get_micro_app_project_scopes() == scopes
    assert get_mentioned_micro_app_ids() == ["app-1", "app-2"]


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_keeps_existing_when_new_resolve_fails(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    existing = {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    await persist_micro_app_project_scopes(existing)
    with patch(
        "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
        new=AsyncMock(return_value=None),
    ):
        scopes = await sync_micro_app_scope_from_mentions(
            [{"type": "micro_app", "app_id": "app-2", "app_name": "App Two"}]
        )

    assert scopes == existing
    assert get_micro_app_project_scopes() == existing
    assert get_current_micro_app_mention_state() == (["app-2"], ["app-2"])
    with pytest.raises(ValueError, match="historical default"):
        resolve_magicbase_project_id()
    with pytest.raises(ValueError, match="could not be resolved"):
        resolve_magicbase_project_id("app-2")


@pytest.mark.asyncio
async def test_sync_micro_app_scope_from_mentions_overwrites_existing_app(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    await persist_micro_app_project_scopes(
        {"app-1": {"project_id": "old-project", "app_name": "Old Name"}}
    )
    with patch(
        "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
        new=AsyncMock(return_value="new-project"),
    ):
        scopes = await sync_micro_app_scope_from_mentions(
            [{"type": "micro_app", "app_id": "app-1", "app_name": "New Name"}]
        )

    assert scopes == {"app-1": {"project_id": "new-project", "app_name": "New Name"}}
    assert get_micro_app_project_scopes() == scopes


@pytest.mark.asyncio
async def test_clear_micro_app_project_scope_deletes_runtime_scope_file(tmp_path, monkeypatch):
    runtime_dir = _use_tmp_runtime(tmp_path, monkeypatch)
    await persist_micro_app_project_scopes(
        {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    )
    scope_file = runtime_dir / "micro-app" / "scope.json"
    assert scope_file.is_file()

    await clear_micro_app_project_scope()

    assert not scope_file.exists()


@pytest.mark.asyncio
async def test_sync_micro_app_project_scope_from_prompt_binds_multiple_apps():
    prompt = (
        '{"type":"doc","content":[{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-1"}}},{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-2"}}}]}'
    )
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(side_effect=lambda app_id: f"project-{app_id.split('-')[1]}"),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_micro_app_project_scopes",
            return_value={},
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.get_mentioned_micro_app_ids",
            return_value=[],
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.persist_micro_app_project_scopes"
        ) as persist_mock,
    ):
        assert await sync_micro_app_project_scope_from_prompt(prompt) is None
        persist_mock.assert_awaited_once_with(
            {
                "app-1": {"project_id": "project-1", "app_name": "app-1"},
                "app-2": {"project_id": "project-2", "app_name": "app-2"},
            },
            mentioned_app_ids=["app-1", "app-2"],
        )


@pytest.mark.asyncio
async def test_sync_micro_app_project_scope_from_prompt_keeps_scope_when_no_apps(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    scopes = {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    await persist_micro_app_project_scopes(scopes)

    with patch(
        "app.service.mention.utils.micro_app_prompt.clear_micro_app_project_scope"
    ) as clear_mock:
        assert await sync_micro_app_project_scope_from_prompt("plain follow-up") is None

    clear_mock.assert_not_called()
    assert get_micro_app_project_scopes() == scopes


@pytest.mark.asyncio
async def test_sync_micro_app_project_scope_from_prompt_keeps_existing_when_resolve_fails(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    existing = {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    await persist_micro_app_project_scopes(existing)
    prompt = (
        '{"type":"doc","content":[{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-2"}}}]}'
    )
    with (
        patch(
            "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "app.service.mention.utils.micro_app_prompt.clear_micro_app_project_scope"
        ) as clear_mock,
    ):
        assert await sync_micro_app_project_scope_from_prompt(prompt) is None

    clear_mock.assert_not_called()
    assert get_micro_app_project_scopes() == existing
    assert get_current_micro_app_mention_state() == (["app-2"], ["app-2"])
    with pytest.raises(ValueError, match="historical default"):
        resolve_magicbase_project_id()


@pytest.mark.asyncio
async def test_sync_micro_app_project_scope_from_prompt_merges_into_existing(
    tmp_path, monkeypatch
):
    _use_tmp_runtime(tmp_path, monkeypatch)
    await persist_micro_app_project_scopes(
        {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    )
    prompt = (
        '{"type":"doc","content":[{"type":"mention","attrs":{"type":"micro_app",'
        '"data":{"app_id":"app-2"}}}]}'
    )
    with patch(
        "app.service.mention.utils.micro_app_prompt.resolve_micro_app_project_id",
        new=AsyncMock(return_value="project-2"),
    ):
        await sync_micro_app_project_scope_from_prompt(prompt)

    assert get_micro_app_project_scopes() == {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "app-2"},
    }


@pytest.mark.asyncio
async def test_format_bound_micro_app_scope_context_renders_typed_links(tmp_path, monkeypatch):
    from app.service.mention.utils.micro_app_prompt import (
        format_bound_micro_app_scope_context,
    )

    _use_tmp_runtime(tmp_path, monkeypatch)
    scope_file = tmp_path / ".runtime" / "micro-app" / "scope.json"
    scope_file.parent.mkdir(parents=True)
    scope_file.write_text(
        json.dumps(
            {
                "scopes": {"app-1": {"project_id": "project-1", "app_name": "App One"}},
                "mentioned_app_ids": ["app-1"],
            }
        ),
        encoding="utf-8",
    )

    context = await format_bound_micro_app_scope_context()
    assert "[App One](micro-app://app-1)" in context
    assert "project_id: project-1" in context
    assert "use-magicbase" in context
    assert "built-in system skill" in context
    assert "read_skills" in context
    assert "project_id" in context
    assert "Only load" in context
    assert "mounted read-only" in context
    assert "Do not create, edit, delete, move, or rename files" in context
