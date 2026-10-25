import asyncio
from dataclasses import fields

import pytest

from app.core.horizon import store as horizon_store_module
from app.core.horizon.migration import CURRENT_VERSION
from app.core.horizon.models import (
    FileContextRecord,
    HorizonState,
    ImageModelState,
    ManualContextWindowState,
    PendingNotification,
    VideoModelState,
)
from app.core.horizon.store import (
    HorizonStore,
    _assert_codec_covers_horizon_state,
)
from app.utils.async_file_utils import async_exists, async_read_json, async_write_json
from app.core.entity.user_context import UserContextSnapshot


def _full_horizon_state(agent_id: str = "agent-1") -> HorizonState:
    return HorizonState(
        agent_id=agent_id,
        file_records={
            "/workspace/example.txt": FileContextRecord(
                path="/workspace/example.txt",
                file_hash="hash",
                file_mtime_ms=123.0,
                file_size_bytes=7,
                file_content="content",
                tool_name="read_file",
                truncated=False,
                metadata={"source": "test"},
                read_at="2026-07-24T00:00:00+00:00",
                read_ranges=[(1, 2)],
            )
        },
        pending_notifications=[
            PendingNotification(
                pushed_at="2026-07-24T00:00:00+00:00",
                source="test",
                content="notification",
            )
        ],
        loaded_skills=["skill-a"],
        image_model=ImageModelState(model_id="image-model", sizes=[{"value": "1:1"}]),
        video_model=VideoModelState(model_id="video-model", config={"duration": 5}),
        manual_context_windows={
            "text-model": ManualContextWindowState(user_manual_max_context_tokens=128_000)
        },
        llm_model_id="text-model",
        llm_model_name="Text Model",
        process_started_at_ns=123,
        user_preferred_language="zh-CN",
        workspace_files="workspace tree",
        client_context="client context",
        cli_status="cli status",
        context_usage_baseline_used=100,
        context_usage_baseline_total=200,
        context_usage_baseline_used_pct=50,
        initial_context_injected=True,
        last_injected_date="2026-07-24",
    )


@pytest.mark.asyncio
async def test_horizon_store_round_trip_keeps_existing_schema(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    state = _full_horizon_state()

    await store.save(state)

    document = await async_read_json(store.path)
    assert document["version"] == CURRENT_VERSION
    assert set(document) - {"version"} == {
        state_field.name for state_field in fields(HorizonState)
    }
    assert await store.load() == state


@pytest.mark.asyncio
async def test_user_identity_snapshot_round_trip_and_legacy_default(tmp_path):
    """来源身份随快照保存，历史文件缺字段时仍可恢复。"""
    snapshot = UserContextSnapshot.model_validate({
        "user_id": "mock-user", "organization_code": "mock-org", "status": "available",
        "attempted_at": "2026-10-15T00:00:00+00:00",
        "context": {
            "captured_at": "2026-10-15T00:00:00+00:00",
            "user": {"id": "mock-user", "magic_id": "mock-account", "third_platform_id": "00123"},
            "organization": {"code": "mock-org"},
            "subscription": {"status": "unsupported"}, "points": {"status": "unsupported"},
        },
    })
    store = HorizonStore(str(tmp_path), "mock-agent", "mock-agent-id")
    state = HorizonState(agent_id="mock-agent-id", user_context=snapshot, user_context_baseline=snapshot)
    await store.save(state)
    restored = await store.load()
    assert restored.user_context.context.user.third_platform_id == "00123"
    assert restored.user_context_baseline.context.user.third_platform_id == "00123"
    document = await async_read_json(store.path)
    for key in ("user_context", "user_context_baseline"):
        del document[key]["context"]["user"]["third_platform_id"]
    await async_write_json(store.path, document)
    restored = await store.load()
    assert restored.user_context.context.user.third_platform_id == ""
    assert restored.user_context_baseline.context.user.third_platform_id == ""


@pytest.mark.asyncio
async def test_horizon_store_save_overwrites_formal_path_without_rename(tmp_path, monkeypatch):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    initial_state = _full_horizon_state()
    next_state = _full_horizon_state()
    next_state.loaded_skills = ["skill-b"]
    await store.save(initial_state)

    async def fail_rename(*args, **kwargs):
        raise AssertionError("Horizon save must not rename a temporary file")

    monkeypatch.setattr(horizon_store_module, "async_rename", fail_rename, raising=False)

    await store.save(next_state)

    assert await store.load() == next_state
    assert not await async_exists(store.path.with_suffix(".tmp"))


@pytest.mark.asyncio
async def test_horizon_store_serializes_concurrent_saves(tmp_path, monkeypatch):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    active_writes = 0
    max_active_writes = 0

    async def fake_write_path(path, state):
        nonlocal active_writes, max_active_writes
        active_writes += 1
        max_active_writes = max(max_active_writes, active_writes)
        await asyncio.sleep(0.01)
        active_writes -= 1

    monkeypatch.setattr(HorizonStore, "_write_path", staticmethod(fake_write_path))

    await asyncio.gather(
        store.save(_full_horizon_state()),
        store.save(_full_horizon_state()),
    )

    assert max_active_writes == 1


@pytest.mark.asyncio
async def test_horizon_store_does_not_partially_load_corrupted_nested_data(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    await async_write_json(
        store.path,
        {
            "version": CURRENT_VERSION,
            "agent_id": "agent-1",
            "pending_notifications": [{"pushed_at": "now", "source": "test"}],
        },
    )

    assert await store.load() is None
    with pytest.raises(KeyError):
        await HorizonStore.load_for_session("test-agent", "agent-1", tmp_path)


def test_horizon_codec_coverage_fails_when_a_field_is_missing():
    with pytest.raises(RuntimeError, match="missing=.*agent_id"):
        _assert_codec_covers_horizon_state("test", set())


@pytest.mark.asyncio
async def test_a_legacy_document_with_retired_workspace_fields_still_loads(tmp_path):
    """升级前写下的状态文件带着已经退役的字段，不能因此拒绝加载。

    工作区条目基线随"集合差不再是变更来源"一起删掉了；旧文件里多出来的键必须被忽略，
    否则一次升级就会让所有进行中的会话失去 Horizon 状态。
    """
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    document = horizon_store_module._encode_state(_full_horizon_state())
    document["workspace_entries"] = [{"path": "example.txt"}]
    document["workspace_entries_complete"] = True
    await async_write_json(store.path, document)

    state = await store.load()

    assert state is not None
    assert state.workspace_files == "workspace tree"


@pytest.mark.asyncio
async def test_horizon_fork_write_retargets_agent_without_mutating_source(tmp_path):
    state = _full_horizon_state("parent")
    target_path = tmp_path / "child.horizon.json"

    await HorizonStore.write_fork_state(
        state,
        target_agent_id="child",
        horizon_path=target_path,
    )

    assert state.agent_id == "parent"
    assert (await async_read_json(target_path))["agent_id"] == "child"
