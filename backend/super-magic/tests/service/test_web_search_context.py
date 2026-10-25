"""网络搜索偏好跨消息、子 Agent 和上下文压缩的契约。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from agentlang.agent.models import AgentRunRequest
from agentlang.chat_history.chat_history_models import SystemMessage, UserMessage
from app.core.context.agent_context import AgentContext
from app.core.entity.message.client_message import ChatClientMessage, ContextType
from app.core.horizon.agent_horizon import AgentHorizon
from app.core.horizon.models import HorizonInjectionPoint
from app.core.horizon.store import HorizonStore
from app.magic import agent as agent_module
from app.magic.agent import Agent
from app.magic.background_compact import BackgroundCompactState, build_messages_digest
from app.magic.compact_result import CompactResult
from app.service.agent_dispatcher import AgentDispatcher
from app.service.agent_runner import _inherit_parent_context
from app.utils import async_file_utils


def _message(dynamic_config=None):
    return ChatClientMessage(
        message_id="search-message", prompt="Analyze workspace files", dynamic_config=dynamic_config
    )


@pytest.mark.parametrize(
    "value, expected", [(False, False), (True, True), (None, None), ("false", None), (0, None), ([], None)]
)
def test_only_explicit_boolean_search_settings_are_parsed(value, expected):
    assert _message({"enable_web_search": value}).web_search_enabled is expected


def test_legacy_message_does_not_claim_search_is_enabled():
    assert _message().web_search_enabled is None


def test_reused_context_refreshes_search_setting_on_every_chat():
    context = AgentContext(isolated=True)
    for config, expected in [({"enable_web_search": False}, False), ({"enable_web_search": True}, True), (None, None)]:
        context.set_chat_client_message(_message(config))
        assert context.get_web_search_enabled() is expected


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "config, expected", [(None, None), ({"enable_web_search": True}, True), ({"enable_web_search": False}, False)]
)
async def test_dispatch_does_not_inherit_previous_search_setting(config, expected):
    dispatcher = AgentDispatcher.__new__(AgentDispatcher)
    dispatcher.get_last_dispatch_message = AsyncMock(
        return_value={
            "dynamic_config": {"enable_web_search": False, "message_version": "v2"},
        }
    )
    message = _message(config)

    await dispatcher._fill_from_last_dispatch_message(message)

    assert message.web_search_enabled is expected
    assert message.dynamic_config["message_version"] == "v2"
    if config is None:
        assert "enable_web_search" not in message.dynamic_config


@pytest.mark.parametrize("enabled", [True, False, None])
@pytest.mark.parametrize("forked", [True, False])
def test_subagent_inherits_current_preference_without_sharing_parent_message(enabled, forked):
    parent = AgentContext(isolated=True)
    parent.set_chat_client_message(_message({"enable_web_search": enabled}))
    child = AgentContext(isolated=True)

    _inherit_parent_context(child, parent, depth=1)
    child.set_subagent_forked(forked)

    assert child.get_web_search_enabled() is enabled
    assert child.get_chat_client_message() is None
    parent.set_web_search_enabled(not enabled)
    assert child.get_web_search_enabled() is enabled


@pytest.mark.asyncio
async def test_continue_restores_search_setting_from_serialized_chat():
    original = _message({"enable_web_search": False})
    restored = ChatClientMessage.model_validate_json(original.model_dump_json())
    restored.prompt = "Continue"
    dispatcher = AgentDispatcher.__new__(AgentDispatcher)
    dispatcher.get_last_dispatch_message = AsyncMock(return_value={})

    await dispatcher._fill_from_last_dispatch_message(restored)
    context = AgentContext(isolated=True)
    context.set_chat_client_message(restored)

    assert context.get_web_search_enabled() is False


@pytest.mark.asyncio
async def test_control_continue_inherits_last_effective_search_setting():
    dispatcher = AgentDispatcher.__new__(AgentDispatcher)
    dispatcher.get_last_dispatch_message = AsyncMock(
        return_value={
            "dynamic_config": {"enable_web_search": False},
        }
    )
    message = _message()
    message.context_type = ContextType.CONTINUE

    await dispatcher._fill_from_last_dispatch_message(message)

    assert message.web_search_enabled is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "config, expected", [(None, None), ({"enable_web_search": True}, True), ({"enable_web_search": False}, False)]
)
async def test_snapshot_does_not_resurrect_previous_search_setting(config, expected, tmp_path, monkeypatch):
    dispatcher = AgentDispatcher.__new__(AgentDispatcher)
    dispatcher.get_last_dispatch_message = AsyncMock(
        return_value={
            "dynamic_config": {"enable_web_search": False, "message_version": "v2"},
        }
    )
    dispatcher._last_dispatch_message_file = lambda: tmp_path / "dispatch.json"
    save = AsyncMock()
    monkeypatch.setattr(async_file_utils, "async_write_json", save)
    message = _message(config)

    await dispatcher._fill_from_last_dispatch_message(message)
    await dispatcher._save_last_dispatch_message(message)

    saved = save.await_args.args[1]
    assert saved["dynamic_config"].get("enable_web_search") is expected
    assert saved["dynamic_config"]["message_version"] == "v2"


@pytest.fixture
def agent(tmp_path, monkeypatch):
    context = AgentContext(isolated=True)
    # 使用真实通知队列和持久化，但不启用无关的用户资料、工作区观察。
    context._horizon = AgentHorizon(HorizonStore(str(tmp_path), "magic", "search-agent"), "search-agent")
    context.set_web_search_enabled(False)
    instance = Agent.__new__(Agent)
    instance.agent_context = context
    instance.agent_name = "magic"
    instance.id = "search-agent"
    instance.system_prompt = "system"
    instance.stream_mode = False
    messages = [SystemMessage(content="system"), UserMessage(content="Analyze workspace files")]
    instance.chat_history = SimpleNamespace(
        messages=messages,
        load=AsyncMock(),
        tokens_count=AsyncMock(return_value=100),
        append_user_message=AsyncMock(),
        _is_tool_call_sequence_complete=lambda: True,
    )

    async def replace_messages(replacement):
        instance.chat_history.messages = replacement

    instance.chat_history.replace_messages = AsyncMock(side_effect=replace_messages)
    instance._prepare_run_session = AsyncMock(return_value=SimpleNamespace(direct_response=None))
    instance._handle_agent_loop = AsyncMock(return_value="done")
    instance._refresh_user_context_after_main_run = AsyncMock()
    instance.set_agent_state = Mock()
    instance._backup_before_compact = AsyncMock()
    instance._rehydrate_media_models_after_context_reset = AsyncMock()
    instance._log_compaction_event = Mock()
    instance._finish_compact_request = Mock()
    instance._bg_compact_state = BackgroundCompactState(
        snapshot_message_count=len(messages),
        snapshot_digest=build_messages_digest(messages),
    )
    monkeypatch.setattr(agent_module, "build_memory_runtime_context", lambda context: "Memory runtime facts.")
    monkeypatch.setattr(agent_module.UserContextService, "refresh", AsyncMock())

    async def build_context_update(*, injection_point, **kwargs):
        return await context.horizon.build_context_update(injection_point)

    instance._build_horizon_context_update_safely = build_context_update
    return instance


@pytest.mark.asyncio
async def test_every_run_injects_current_state_as_hidden_context_and_consumes_notification(agent):
    await agent.agent_context.horizon.reload_from_store()
    for enabled, phrase in [(False, "Web search is disabled"), (True, "Web search is enabled")]:
        agent.agent_context.set_chat_client_message(_message({"enable_web_search": enabled}))

        assert await agent._run_once(AgentRunRequest(query="Analyze workspace files")) == "done"

        call = agent.chat_history.append_user_message.await_args
        assert phrase in call.args[0]
        assert call.kwargs == {"show_in_ui": False, "source": "horizon"}
        assert not agent.agent_context.horizon._state.pending_notifications

    # 单次工具循环无需重复注入；下一次完整运行才重新提供状态。
    update = await agent.agent_context.horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert "Web search is" not in (update or "")


@pytest.mark.asyncio
async def test_legacy_run_does_not_inject_search_state(agent):
    agent.agent_context.set_chat_client_message(_message())
    await agent._run_once(AgentRunRequest(query="Search workspace only"))
    assert "Web search is" not in agent.chat_history.append_user_message.await_args.args[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("background", [False, True])
async def test_compaction_reinjects_preference_without_relying_on_summary(agent, background):
    horizon = agent.agent_context.horizon
    await horizon.reload_from_store()
    agent._push_web_search_runtime_context()
    await horizon.build_context_update(HorizonInjectionPoint.BEFORE_FIRST_LLM)
    assert not horizon._state.pending_notifications
    result = CompactResult(summary="User is analyzing workspace files.", skill_suggestions=())

    if background:
        assert await agent._apply_background_compact(result)
    else:
        await agent._execute_history_compact(result)

    # 确认真实压缩路径已走到通知重建，不能被异常捕获后的降级返回掩盖。
    agent.chat_history.replace_messages.assert_awaited_once()
    agent._rehydrate_media_models_after_context_reset.assert_awaited_once()
    update = await horizon.build_context_update(HorizonInjectionPoint.AFTER_TOOL_RESULT)
    assert "Web search is disabled for this run" in update
    assert "do not call internet search tools" in update
