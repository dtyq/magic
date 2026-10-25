"""Task defaults must reproduce first-send behavior without editing the topic."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.tools.super_magic.context import ProductConfigurationError
from app.tools.super_magic.execution_config import resolve_task_configuration
from app.tools.super_magic.tasks import _submit


def context(mode="general", model="selected-model"):
    task = SimpleNamespace(
        create_async=AsyncMock(return_value={"task_id": "30"}),
        mode_async=AsyncMock(return_value={"models": {"1": {"model_id": "default-model", "model_status": "normal"}}, "groups": [{"model_ids": ["1"]}]}),
        custom_models_async=AsyncMock(return_value={"list": []}),
        model_config_async=AsyncMock(return_value={}),
        execution_modes_async=AsyncMock(return_value={"default_agent_code": "general", "list": [{"mode": {"identifier": "general"}}]}),
    )
    return SimpleNamespace(
        auth=object(),
        agent=SimpleNamespace(
            get_chat_client_message=lambda: SimpleNamespace(agent_mode=mode, model_id=model),
            model_context=SimpleNamespace(configured_text_model_id="configured-model", text_model_id="transient-model"),
            get_super_magic_product_context=lambda: SimpleNamespace(topic=SimpleNamespace(id="99")),
        ),
        sdk=SimpleNamespace(task=task, topic=SimpleNamespace(get_async=AsyncMock(return_value={"project_id": "10", "topic_name": "New topic", "topic_mode": ""})), project=SimpleNamespace(get_async=AsyncMock(return_value={"project_mode": "general"}))),
    )


@pytest.mark.asyncio
async def test_first_task_on_empty_topic_inherits_chat_configuration():
    ctx = context()
    receipt = await _submit(ctx, "10", "20", "Build a report")
    body = ctx.sdk.task.create_async.call_args.args[1]
    assert body["agent_mode"] == "general"
    assert body["model_id"] == "selected-model"
    assert receipt["topic_name"] == "New topic"
    ctx.sdk.task.model_config_async.assert_not_called()
    ctx.sdk.project.get_async.assert_not_called()


@pytest.mark.asyncio
async def test_configured_model_does_not_use_transient_compaction_model():
    ctx = context(model="")
    config = await resolve_task_configuration(ctx, {}, "10", "20")
    assert config.model_id == "configured-model"


@pytest.mark.asyncio
async def test_target_agent_is_preserved_and_incompatible_source_model_is_replaced():
    ctx = context()
    ctx.sdk.task.execution_modes_async.return_value = {
        "models": {"1": {"model_id": "default-model", "model_status": "normal"}},
        "list": [{"mode": {"identifier": "SMA-123"}, "groups": [{"model_ids": ["1"]}]}],
    }
    config = await resolve_task_configuration(ctx, {"topic_mode": "custom_agent", "agent_code": "SMA-123"}, "10", "20")
    assert config.agent_mode == "SMA-123"
    assert config.model_id == "default-model"
    assert [call.args[1] for call in ctx.sdk.task.model_config_async.call_args_list] == ["20", "project_id_10", "default_SMA-123", "default"]


@pytest.mark.asyncio
async def test_project_model_preference_skips_disabled_topic_model():
    ctx = context(mode="other-mode")
    ctx.sdk.task.model_config_async.side_effect = [{"model": {"model_id": "disabled-model"}}, {"model": {"model_id": "default-model"}}]
    config = await resolve_task_configuration(ctx, {"topic_mode": "general"}, "10", "20")
    assert config.model_id == "default-model"
    assert [call.args[1] for call in ctx.sdk.task.model_config_async.call_args_list] == ["20", "project_id_10"]


@pytest.mark.asyncio
async def test_custom_text_model_can_be_used_across_modes():
    ctx = context(mode="other-mode", model="private-text")
    ctx.sdk.task.custom_models_async.return_value = {"list": [{"model_id": "private-text", "model_type": 3}, {"model_id": "image", "model_type": 0}]}
    config = await resolve_task_configuration(ctx, {"topic_mode": "general"}, "10", "20")
    assert config.model_id == "private-text"
    ctx.sdk.task.model_config_async.assert_not_called()


@pytest.mark.asyncio
async def test_source_custom_agent_is_resolved_from_initiating_topic():
    ctx = context(mode="custom_agent")
    ctx.sdk.topic.get_async.return_value = {"topic_mode": "custom_agent", "agent_code": "SMA-123"}
    config = await resolve_task_configuration(ctx, {}, "10", "20")
    assert config.agent_mode == "SMA-123"
    ctx.sdk.topic.get_async.assert_awaited_once_with(ctx.auth, "99")


@pytest.mark.asyncio
async def test_missing_chat_configuration_uses_project_mode_and_saved_model():
    ctx = context(mode="", model="")
    ctx.agent.model_context.configured_text_model_id = ""
    ctx.sdk.project.get_async.return_value = {"project_mode": "design"}
    ctx.sdk.task.model_config_async.return_value = {"model": {"model_id": "default-model"}}
    config = await resolve_task_configuration(ctx, {}, "10", "20")
    assert (config.agent_mode, config.model_id) == ("design", "default-model")


@pytest.mark.asyncio
async def test_unavailable_platform_default_falls_back_to_general():
    ctx = context(mode="", model="")
    ctx.agent.model_context.configured_text_model_id = ""
    ctx.sdk.project.get_async.return_value = {}
    ctx.sdk.task.execution_modes_async.return_value = {"default_agent_code": "SMA-hidden", "list": []}
    config = await resolve_task_configuration(ctx, {}, "10", "20")
    assert config.agent_mode == "general"


@pytest.mark.asyncio
async def test_invalid_custom_agent_does_not_submit_or_change_topic():
    ctx = context()
    ctx.sdk.topic.get_async.return_value = {"project_id": "10", "topic_mode": "custom_agent"}
    with pytest.raises(ProductConfigurationError):
        await _submit(ctx, "10", "20", "Build a report")
    ctx.sdk.task.create_async.assert_not_called()


@pytest.mark.asyncio
async def test_project_mismatch_stops_before_configuration_or_submission():
    ctx = context()
    with pytest.raises(ValueError):
        await _submit(ctx, "11", "20", "Build a report")
    ctx.sdk.task.create_async.assert_not_called()
    ctx.sdk.task.mode_async.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_name", ["StartTopicTask", "SendTopicMessage"])
async def test_both_entry_points_submit_empty_topics_with_inherited_configuration(monkeypatch, tool_name):
    from app.tools.super_magic import tasks
    from app.tools.super_magic.display import ProductTool
    ctx = context()

    async def run(self, tool_context, action, operation, *, format_result, **kwargs):
        return format_result(await operation(ctx))

    monkeypatch.setattr(ProductTool, "run_product", run)
    result = await getattr(tasks, tool_name)().execute(None, tasks.StartTopicTaskParams(project_id="10", topic_id="20", content="Build a report"))
    assert result.ok and result.data["status"] == "accepted"
    assert ctx.sdk.task.create_async.call_args.args[1]["model_id"] == "selected-model"
