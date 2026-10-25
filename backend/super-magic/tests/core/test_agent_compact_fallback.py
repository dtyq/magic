import asyncio
from types import SimpleNamespace

import pytest

from agentlang.exceptions import ResourceLimitExceededException
from agentlang.chat_history import CompactionConfig
from agentlang.llms.factory import LLMFactory
from agentlang.tools.tool_result import ToolResult
from app.core import ai_abilities
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection
from app.core.models.agent_runtime import AgentProviderType, AgentTarget

import app.service  # noqa: F401  # Ensure service package finishes initialization before importing Agent.
from app.magic.background_compact import (
    BackgroundCompactState,
    build_messages_digest,
    start_background_compact,
)
from app.magic.agent import Agent, AgentLoopState
from app.magic.compact_request_tracker import CompactRequestTracker


def _make_compact_request_tracker(pending: bool = False) -> CompactRequestTracker:
    tracker = CompactRequestTracker()
    if pending:
        tracker.start(reason="test")
    return tracker


class _FakeCompactAgent:
    _PROVIDER_RATE_LIMIT_STATUS_CODES = Agent._PROVIDER_RATE_LIMIT_STATUS_CODES
    _NON_RETRYABLE_STATUS_CODES = Agent._NON_RETRYABLE_STATUS_CODES
    _GENERATION_SPLIT_RECOVERY_PROMPT = Agent._GENERATION_SPLIT_RECOVERY_PROMPT
    _call_llm_with_retry = Agent._call_llm_with_retry
    _try_fallback_compact_model_once = Agent._try_fallback_compact_model_once
    _restore_pre_compact_model = Agent._restore_pre_compact_model
    _has_pending_compact_request = Agent._has_pending_compact_request
    _fallback_compact_request_to_main_model = Agent._fallback_compact_request_to_main_model
    _finish_compact_request = Agent._finish_compact_request
    _require_current_text_model_id = Agent._require_current_text_model_id
    _reset_generation_failure_streak = staticmethod(Agent._reset_generation_failure_streak)

    def __init__(self, failures: list[Exception]):
        model_context = AgentModelContext()
        model_context.apply_selection(AgentModelSelection(
            configured_text_model_id="mock-default-text",
            text_model_id="mock-runtime-text",
        ))
        model_context.activate_compact_text_model("mock-compact-text")

        self.agent_context = SimpleNamespace(model_context=model_context)
        self.failures = list(failures)
        self.calls: list[dict[str, object]] = []
        self.recovery_messages: list[str] = []
        self._compact_request_tracker = _make_compact_request_tracker(pending=True)

    async def _prepare_and_call_llm(self, **kwargs):
        self.calls.append({
            "use_stream": kwargs.get("use_stream"),
            "non_stream_timeout": kwargs.get("non_stream_timeout"),
            "model_id": self.agent_context.model_context.current_text_model_id,
        })
        if self.failures:
            raise self.failures.pop(0)
        return SimpleNamespace(content="mock compact result")

    def _find_context_window_error(self, exception: Exception):
        return None

    def _extract_chunk_count(self, exception: Exception) -> int:
        return 0

    async def _try_inject_output_recovery_message(self, loop_state, prompt: str, source: str) -> bool:
        self.recovery_messages.append(source)
        return True

    async def _interruptible_sleep(self, seconds: float) -> None:
        return None

    def _log_compaction_event(self, event_type: str, message: str) -> None:
        return None

    async def _dispatch_before_llm_retry_event(self, **kwargs):
        return SimpleNamespace(
            allow_retry=None,
            disable_streaming=False,
            skip_backoff=False,
            reason="",
        )

    async def _dispatch_llm_request_succeeded_event(self, **kwargs):
        return None


class _FakeForceCompactAgent:
    _has_pending_compact_request = Agent._has_pending_compact_request
    _try_compact_chat_history_force = Agent._try_compact_chat_history_force

    def __init__(self):
        self.build_called = False
        self._compact_request_tracker = _make_compact_request_tracker(pending=True)
        self._bg_compact_state = BackgroundCompactState()
        self.chat_history = SimpleNamespace(
            messages=[
                SimpleNamespace(content="mock user message"),
                SimpleNamespace(content="mock assistant message"),
                SimpleNamespace(content="mock tool result"),
                SimpleNamespace(content="mock latest message"),
            ]
        )

    def _build_compact_request(self) -> str:
        self.build_called = True
        return "mock compact request"


class _FakeLoopCompactAgent:
    _has_pending_compact_request = Agent._has_pending_compact_request
    _restore_pre_compact_model = Agent._restore_pre_compact_model
    _restore_stale_compact_model_before_loop = Agent._restore_stale_compact_model_before_loop
    _finish_compact_request = Agent._finish_compact_request
    _require_current_text_model_id = Agent._require_current_text_model_id

    def __init__(self, last_content: str, compact_request_pending: bool = False):
        model_context = AgentModelContext()
        model_context.apply_selection(AgentModelSelection(
            configured_text_model_id="mock-default-text",
            text_model_id="mock-runtime-text",
        ))
        model_context.activate_compact_text_model("mock-compact-text")

        self.agent_context = SimpleNamespace(model_context=model_context)
        self.chat_history = SimpleNamespace(messages=[SimpleNamespace(content=last_content)])
        self._compact_request_tracker = _make_compact_request_tracker(
            pending=compact_request_pending
        )

    def _log_compaction_event(self, event_type: str, message: str) -> None:
        return None


class _FakeCompactToolResultAgent(_FakeLoopCompactAgent):
    _process_tool_call_results = Agent._process_tool_call_results

    def __init__(self):
        super().__init__("mock latest message", compact_request_pending=True)
        self.compact_executed = False
        self.capture_compact_history_result = False
        self.appended_tool_messages: list[dict[str, object]] = []

        async def append_tool_message(**kwargs):
            self.appended_tool_messages.append(kwargs)

        self.chat_history.append_tool_message = append_tool_message

    async def _execute_history_compact(self, summary: str) -> None:
        self.compact_executed = True


class _FakeChatHistory:
    def __init__(self, messages: list[SimpleNamespace], token_count: int):
        self.messages = messages
        self.token_count = token_count
        self.added_messages: list[object] = []
        self.replacement_messages: list[object] | None = None

    async def tokens_count(self) -> int:
        return self.token_count

    async def add_message(self, message: object) -> None:
        self.added_messages.append(message)
        self.messages.append(message)

    async def replace_messages(self, messages: list[object]) -> None:
        self.replacement_messages = messages
        self.messages = messages


def _background_compact_context(
    messages: list[SimpleNamespace],
    registered_cleanups: dict[str, object],
) -> tuple[SimpleNamespace, SimpleNamespace, AgentTarget]:
    target = AgentTarget(
        provider_type=AgentProviderType.CLAW,
        agent_name="mock-agent",
    )
    snapshot = SimpleNamespace(messages=tuple(messages))
    context = SimpleNamespace(
        context_id="parent-context",
        get_agent_target=lambda: target,
        register_run_cleanup=lambda key, callback: registered_cleanups.update({key: callback}),
    )
    return context, snapshot, target


def _mock_snapshot_capture(monkeypatch, snapshot: SimpleNamespace) -> None:
    async def capture(_service, _source):
        return snapshot

    monkeypatch.setattr(
        "app.service.agent_context_snapshot_service.AgentContextSnapshotService.capture",
        capture,
    )


class _FakePrecompactAgent:
    _try_compact_chat_history = Agent._try_compact_chat_history
    _trigger_foreground_compact = Agent._trigger_foreground_compact
    _has_pending_compact_request = Agent._has_pending_compact_request
    _require_current_text_model_id = Agent._require_current_text_model_id

    def __init__(self, token_count: int, *, pending: bool = False):
        self.agent_context = SimpleNamespace(
            model_context=SimpleNamespace(current_text_model_id="mock-runtime-text")
        )
        self.compaction_config = CompactionConfig(
            compaction_threshold_tokens=100,
            min_compaction_threshold_tokens=0,
            early_compact_ratio=0.8,
            max_conversation_rounds=100,
        )
        self.chat_history = _FakeChatHistory(
            messages=[
                SimpleNamespace(role="system", content="system", show_in_ui=False),
                SimpleNamespace(role="user", content="question", show_in_ui=True),
                SimpleNamespace(role="assistant", content="answer", show_in_ui=True),
            ],
            token_count=token_count,
        )
        self._bg_compact_state = BackgroundCompactState()
        self._compact_request_tracker = _make_compact_request_tracker(pending=pending)
        self.background_start_count = 0
        self.built_compact_request = False

    async def _start_background_compact(self) -> None:
        self.background_start_count += 1

    def _build_compact_request(self) -> str:
        self.built_compact_request = True
        return "mock compact request"

    def _log_compaction_event(self, event_type: str, message: str) -> None:
        return None


class _FakeRunningBackgroundState:
    is_completed = False
    is_running = True
    is_idle = False
    elapsed_seconds = 1.25

    def __init__(self):
        self.reset_count = 0

    def reset(self) -> None:
        self.reset_count += 1


class _FakeHardThresholdAgent(_FakePrecompactAgent):
    def __init__(self):
        super().__init__(token_count=120)
        self._bg_compact_state = _FakeRunningBackgroundState()
        self.wait_count = 0
        self.applied_summary: str | None = None
        self.foreground_count = 0

    async def _wait_for_background_compact(self) -> str:
        self.wait_count += 1
        return "captured background summary"

    async def _apply_background_compact(self, summary: str) -> bool:
        self.applied_summary = summary
        return True

    async def _trigger_foreground_compact(
        self,
        token_count: int,
        compaction_threshold_tokens: int,
        message_count: int,
    ) -> bool:
        self.foreground_count += 1
        return True


class _FakeTimedOutBackgroundAgent(_FakeHardThresholdAgent):
    async def _wait_for_background_compact(self) -> None:
        self.wait_count += 1
        return None


class _FakeHorizon:
    def __init__(self):
        self.reset_count = 0

    async def on_context_reset(self) -> None:
        self.reset_count += 1


class _FakeAgentContext:
    def __init__(self):
        self.horizon = _FakeHorizon()
        self.blocker_count = 0

    def increment_cancel_blocker(self) -> None:
        self.blocker_count += 1

    def decrement_cancel_blocker(self) -> None:
        self.blocker_count -= 1


class _FakeApplyBackgroundAgent:
    _build_compacted_summary_message = Agent._build_compacted_summary_message
    _apply_background_compact = Agent._apply_background_compact

    def __init__(self):
        self.system_prompt = "system prompt"
        self.agent_context = _FakeAgentContext()
        self.backup_count = 0
        self.rehydrate_count = 0
        self.snapshot_messages = [
            SimpleNamespace(role="system", content="system", show_in_ui=False),
            SimpleNamespace(role="user", content="before compact", show_in_ui=True),
        ]
        self.new_message = SimpleNamespace(
            role="user",
            content="message after background snapshot",
            show_in_ui=True,
        )
        self.chat_history = _FakeChatHistory(
            messages=[*self.snapshot_messages, self.new_message],
            token_count=150,
        )
        self._bg_compact_state = BackgroundCompactState(
            snapshot_message_count=len(self.snapshot_messages),
            snapshot_digest=build_messages_digest(self.snapshot_messages),
        )

    async def _backup_before_compact(self) -> None:
        self.backup_count += 1

    async def _rehydrate_media_models_after_context_reset(self) -> None:
        self.rehydrate_count += 1


@pytest.mark.asyncio
async def test_compact_model_failure_falls_back_to_current_text_model_once():
    agent = _FakeCompactAgent([RuntimeError("mock compact model blocked")])

    result = await agent._call_llm_with_retry(AgentLoopState())

    assert result.content == "mock compact result"
    assert [call["model_id"] for call in agent.calls] == [
        "mock-compact-text",
        "mock-runtime-text",
    ]
    assert agent.calls[0]["use_stream"] is True
    assert agent.calls[1]["use_stream"] is False
    assert not agent.agent_context.model_context.has_active_compact_text_model()
    assert not agent._has_pending_compact_request()


@pytest.mark.asyncio
async def test_compact_model_fallback_keeps_pending_during_main_model_retry():
    agent = _FakeCompactAgent([RuntimeError("mock compact model blocked")])
    pending_seen_during_retry: list[bool] = []

    original_prepare = agent._prepare_and_call_llm

    async def prepare_and_check_pending(**kwargs):
        pending_seen_during_retry.append(agent._has_pending_compact_request())
        return await original_prepare(**kwargs)

    agent._prepare_and_call_llm = prepare_and_check_pending

    result = await agent._call_llm_with_retry(AgentLoopState())

    assert result.content == "mock compact result"
    assert pending_seen_during_retry == [True, True]
    assert [call["model_id"] for call in agent.calls] == [
        "mock-compact-text",
        "mock-runtime-text",
    ]
    assert not agent._has_pending_compact_request()
    assert not agent.agent_context.model_context.has_active_compact_text_model()


@pytest.mark.asyncio
async def test_compact_model_fallback_is_not_repeated_after_current_text_model_failure():
    agent = _FakeCompactAgent([
        RuntimeError("mock compact model blocked"),
        RuntimeError("mock current text model failed"),
    ])

    with pytest.raises(RuntimeError, match="mock current text model failed"):
        await agent._call_llm_with_retry(AgentLoopState())

    assert [call["model_id"] for call in agent.calls] == [
        "mock-compact-text",
        "mock-runtime-text",
    ]
    assert not agent.agent_context.model_context.has_active_compact_text_model()
    assert not agent._has_pending_compact_request()


@pytest.mark.asyncio
async def test_compact_model_resource_limit_does_not_fallback():
    agent = _FakeCompactAgent([ResourceLimitExceededException(error_code=12000)])

    with pytest.raises(ResourceLimitExceededException):
        await agent._call_llm_with_retry(AgentLoopState())

    assert [call["model_id"] for call in agent.calls] == ["mock-compact-text"]
    assert agent.agent_context.model_context.has_active_compact_text_model()


@pytest.mark.asyncio
async def test_reactive_compact_skips_duplicate_pending_request():
    agent = _FakeForceCompactAgent()

    assert not await agent._try_compact_chat_history_force()
    assert not agent.build_called


def test_pending_compact_request_keeps_compact_model_before_loop():
    agent = _FakeLoopCompactAgent("mock latest message", compact_request_pending=True)

    agent._restore_stale_compact_model_before_loop()

    model_context = agent.agent_context.model_context
    assert model_context.has_active_compact_text_model()
    assert model_context.current_text_model_id == "mock-compact-text"


def test_compact_pending_does_not_depend_on_last_message_content():
    agent = _FakeLoopCompactAgent("must call compact_chat_history now")

    assert not agent._has_pending_compact_request()


def test_pending_compact_flag_keeps_model_even_when_last_message_changes():
    agent = _FakeLoopCompactAgent("mock latest message after command processing", compact_request_pending=True)

    agent._restore_stale_compact_model_before_loop()

    model_context = agent.agent_context.model_context
    assert model_context.has_active_compact_text_model()
    assert model_context.current_text_model_id == "mock-compact-text"
    agent._finish_compact_request(reason="test cleanup", restore_model=False)
    assert not agent._has_pending_compact_request()


def test_finish_compact_request_clears_pending_when_model_already_restored():
    agent = _FakeLoopCompactAgent("mock latest message", compact_request_pending=True)
    agent.agent_context.model_context.restore_pre_compact_text_model()

    agent._finish_compact_request(reason="test cleanup", restore_model=True)

    assert not agent._has_pending_compact_request()
    assert not agent.agent_context.model_context.has_active_compact_text_model()
    assert agent.agent_context.model_context.current_text_model_id == "mock-runtime-text"


def test_stale_compact_model_restores_before_loop_without_pending_request():
    agent = _FakeLoopCompactAgent("mock assistant used another tool")

    agent._restore_stale_compact_model_before_loop()

    model_context = agent.agent_context.model_context
    assert not model_context.has_active_compact_text_model()
    assert model_context.current_text_model_id == "mock-runtime-text"


@pytest.mark.asyncio
async def test_blank_compact_tool_result_restores_model_and_clears_pending_request():
    agent = _FakeCompactToolResultAgent()

    should_exit, final_response, inject_horizon = await agent._process_tool_call_results([
        ToolResult(
            content="mock compact result",
            system="COMPACT_HISTORY",
            extra_info={"summary": "  "},
        )
    ])

    model_context = agent.agent_context.model_context
    assert (should_exit, final_response, inject_horizon) == (False, None, True)
    assert not agent.compact_executed
    assert not agent._has_pending_compact_request()
    assert not model_context.has_active_compact_text_model()
    assert model_context.current_text_model_id == "mock-runtime-text"


def test_compact_model_validation_does_not_use_llm_fallback(monkeypatch: pytest.MonkeyPatch):
    calls: list[bool] = []

    monkeypatch.setattr(
        ai_abilities,
        "get_ability_config",
        lambda ability, key, default=None: "missing-compact-model",
    )

    def fake_get_model_config(
        model_id: str,
        expected_type: str | None = None,
        allow_fallback: bool = True,
    ):
        calls.append(allow_fallback)
        if allow_fallback:
            return SimpleNamespace(
                model_id="auto",
                provider="openai",
                name="auto",
                api_key="mock-api-key",
                api_base_url="https://llm.example.com/v1",
            )
        raise ValueError(f"missing exact model: {model_id}")

    monkeypatch.setattr(LLMFactory, "get_model_config", fake_get_model_config)

    assert ai_abilities.get_compact_model_id() is None
    assert calls == [False]


@pytest.mark.asyncio
async def test_precompact_starts_background_at_early_threshold_without_injecting_request():
    agent = _FakePrecompactAgent(token_count=90)

    assert not await agent._try_compact_chat_history()

    assert agent.background_start_count == 1
    assert not agent.built_compact_request
    assert not agent.chat_history.added_messages


@pytest.mark.asyncio
async def test_precompact_does_not_start_background_when_pending_compact_request_exists():
    agent = _FakePrecompactAgent(token_count=120, pending=True)

    assert not await agent._try_compact_chat_history()

    assert agent.background_start_count == 0
    assert not agent.built_compact_request
    assert not agent.chat_history.added_messages


@pytest.mark.asyncio
async def test_hard_threshold_waits_for_running_background_compact_before_foreground_injection():
    agent = _FakeHardThresholdAgent()

    assert await agent._try_compact_chat_history()

    assert agent.wait_count == 1
    assert agent.applied_summary == "captured background summary"
    assert agent.foreground_count == 0
    assert agent._bg_compact_state.reset_count == 0


@pytest.mark.asyncio
async def test_hard_threshold_falls_back_to_foreground_when_background_compact_times_out():
    agent = _FakeTimedOutBackgroundAgent()

    assert await agent._try_compact_chat_history()

    assert agent.wait_count == 1
    assert agent.applied_summary is None
    assert agent.foreground_count == 1
    assert agent._bg_compact_state.reset_count == 1


@pytest.mark.asyncio
async def test_apply_background_compact_preserves_messages_after_snapshot():
    agent = _FakeApplyBackgroundAgent()

    assert await agent._apply_background_compact("summarized history")

    replacement = agent.chat_history.replacement_messages
    assert replacement is not None
    assert [message.role for message in replacement] == ["system", "user", "user"]
    assert "summarized history" in replacement[1].content
    assert replacement[2] is agent.new_message
    assert agent.backup_count == 1
    assert agent.agent_context.horizon.reset_count == 1
    assert agent.rehydrate_count == 1
    assert agent.agent_context.blocker_count == 0
    assert agent._bg_compact_state.is_idle


@pytest.mark.asyncio
async def test_apply_background_compact_rejects_changed_snapshot_prefix():
    agent = _FakeApplyBackgroundAgent()
    agent.chat_history.messages[1] = SimpleNamespace(
        role="user",
        content="rewritten before compact",
        show_in_ui=True,
    )

    assert not await agent._apply_background_compact("summarized history")

    assert agent.chat_history.replacement_messages is None
    assert agent.backup_count == 0
    assert agent.agent_context.horizon.reset_count == 0
    assert agent.rehydrate_count == 0
    assert agent.agent_context.blocker_count == 0
    assert agent._bg_compact_state.is_idle


@pytest.mark.asyncio
async def test_start_background_compact_forks_isolated_agent_and_captures_summary(monkeypatch):
    calls: list[object] = []

    async def fake_run_compaction_agent(request) -> str:
        calls.append(request)
        return "summary from forked compact agent"

    monkeypatch.setattr(
        "app.service.agent_runner.run_compaction_agent",
        fake_run_compaction_agent,
    )
    state = BackgroundCompactState()
    messages = [
        SimpleNamespace(role="system", content="system", show_in_ui=False),
        SimpleNamespace(role="user", content="question", show_in_ui=True),
    ]
    registered_cleanups: dict[str, object] = {}
    agent_context, snapshot, target = _background_compact_context(messages, registered_cleanups)
    _mock_snapshot_capture(monkeypatch, snapshot)

    await start_background_compact(
        state=state,
        agent_context=agent_context,
        compact_instruction="Use a complete summary.",
        model_id="mock-compact-model",
    )

    assert state.snapshot_message_count == len(messages)
    assert state.snapshot_digest == build_messages_digest(messages)
    assert state._task is not None
    assert await state._task == "summary from forked compact agent"
    assert state.get_summary() == "summary from forked compact agent"
    assert len(calls) == 1
    request = calls[0]
    assert request.target is target
    assert request.parent_context is agent_context
    assert request.snapshot is snapshot
    assert request.models.text_model_id == "mock-compact-model"
    assert registered_cleanups


@pytest.mark.asyncio
async def test_background_compact_cleanup_only_cancels_own_generation(monkeypatch):
    second_task_started = asyncio.Event()
    release_second_task = asyncio.Event()
    calls = 0

    async def fake_run_compaction_agent(_request) -> str:
        nonlocal calls
        calls += 1
        if calls == 1:
            return "first summary"
        second_task_started.set()
        await release_second_task.wait()
        return "second summary"

    monkeypatch.setattr(
        "app.service.agent_runner.run_compaction_agent",
        fake_run_compaction_agent,
    )
    state = BackgroundCompactState()
    messages = [
        SimpleNamespace(role="system", content="system", show_in_ui=False),
        SimpleNamespace(role="user", content="question", show_in_ui=True),
    ]
    registered_cleanups: dict[str, object] = {}
    agent_context, snapshot, _target = _background_compact_context(messages, registered_cleanups)
    _mock_snapshot_capture(monkeypatch, snapshot)

    await start_background_compact(
        state=state,
        agent_context=agent_context,
        compact_instruction="Use a complete summary.",
        model_id="mock-compact-model",
    )
    first_cleanup = next(iter(registered_cleanups.values()))
    assert state._task is not None
    assert await state._task == "first summary"
    state.reset()

    await start_background_compact(
        state=state,
        agent_context=agent_context,
        compact_instruction="Use a complete summary.",
        model_id="mock-compact-model",
    )
    await second_task_started.wait()
    second_task = state._task

    await first_cleanup()

    assert state._task is second_task
    assert second_task is not None
    assert not second_task.done()

    release_second_task.set()
    assert await second_task == "second summary"


@pytest.mark.asyncio
async def test_start_background_compact_skips_failed_snapshot_without_forking(monkeypatch):
    calls: list[object] = []

    async def fake_run_compaction_agent(request) -> str:
        calls.append(request)
        return "summary should not be used"

    monkeypatch.setattr(
        "app.service.agent_runner.run_compaction_agent",
        fake_run_compaction_agent,
    )
    messages = [
        SimpleNamespace(role="system", content="system", show_in_ui=False),
        SimpleNamespace(role="user", content="question", show_in_ui=True),
    ]
    state = BackgroundCompactState(
        generation="failed-generation",
        snapshot_message_count=len(messages),
        snapshot_digest=build_messages_digest(messages),
    )
    state.mark_failed()
    registered_cleanups: dict[str, object] = {}
    agent_context, snapshot, _target = _background_compact_context(messages, registered_cleanups)
    _mock_snapshot_capture(monkeypatch, snapshot)

    await start_background_compact(
        state=state,
        agent_context=agent_context,
        compact_instruction="Use a complete summary.",
        model_id="mock-compact-model",
    )

    assert calls == []
    assert state.is_idle
