from types import SimpleNamespace

import pytest

from agentlang.exceptions import ResourceLimitExceededException
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection

import app.service  # noqa: F401  # Ensure service package finishes initialization before importing Agent.
from app.magic.agent import Agent, AgentLoopState


class _FakeCompactAgent:
    _PROVIDER_RATE_LIMIT_STATUS_CODES = Agent._PROVIDER_RATE_LIMIT_STATUS_CODES
    _NON_RETRYABLE_STATUS_CODES = Agent._NON_RETRYABLE_STATUS_CODES
    _PROGRESSIVE_RECOVERY_PROMPTS = Agent._PROGRESSIVE_RECOVERY_PROMPTS
    _call_llm_with_retry = Agent._call_llm_with_retry
    _try_fallback_compact_model_once = Agent._try_fallback_compact_model_once
    _restore_pre_compact_model = Agent._restore_pre_compact_model

    def __init__(self, failures: list[Exception]):
        model_context = AgentModelContext()
        model_context.apply_selection(AgentModelSelection(
            configured_text_model_id="mock-default-text",
            text_model_id="mock-runtime-text",
        ))
        model_context.activate_compact_text_model("mock-compact-text")

        self.agent_context = SimpleNamespace(model_context=model_context)
        self.llm_id = "mock-default-text"
        self.failures = list(failures)
        self.calls: list[dict[str, object]] = []
        self.recovery_messages: list[str] = []

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


class _FakeForceCompactAgent:
    _has_pending_compact_request = Agent._has_pending_compact_request
    _try_compact_chat_history_force = Agent._try_compact_chat_history_force

    def __init__(self):
        self.build_called = False
        self._compact_request_pending_llm_call = True
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
    _mark_compact_request_pending_llm_call = Agent._mark_compact_request_pending_llm_call
    _clear_compact_request_pending_llm_call = Agent._clear_compact_request_pending_llm_call
    _restore_pre_compact_model = Agent._restore_pre_compact_model
    _restore_stale_compact_model_before_loop = Agent._restore_stale_compact_model_before_loop

    def __init__(self, last_content: str, compact_request_pending: bool = False):
        model_context = AgentModelContext()
        model_context.apply_selection(AgentModelSelection(
            configured_text_model_id="mock-default-text",
            text_model_id="mock-runtime-text",
        ))
        model_context.activate_compact_text_model("mock-compact-text")

        self.agent_context = SimpleNamespace(model_context=model_context)
        self.llm_id = "mock-default-text"
        self.chat_history = SimpleNamespace(messages=[SimpleNamespace(content=last_content)])
        self._compact_request_pending_llm_call = compact_request_pending


@pytest.mark.asyncio
async def test_compact_model_failure_falls_back_to_runtime_model_once():
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


@pytest.mark.asyncio
async def test_compact_model_fallback_is_not_repeated_after_runtime_failure():
    agent = _FakeCompactAgent([
        RuntimeError("mock compact model blocked"),
        RuntimeError("mock runtime model failed"),
    ])

    with pytest.raises(RuntimeError, match="mock runtime model failed"):
        await agent._call_llm_with_retry(AgentLoopState())

    assert [call["model_id"] for call in agent.calls] == [
        "mock-compact-text",
        "mock-runtime-text",
    ]
    assert not agent.agent_context.model_context.has_active_compact_text_model()


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
    agent._clear_compact_request_pending_llm_call()
    assert not agent._has_pending_compact_request()


def test_stale_compact_model_restores_before_loop_without_pending_request():
    agent = _FakeLoopCompactAgent("mock assistant used another tool")

    agent._restore_stale_compact_model_before_loop()

    model_context = agent.agent_context.model_context
    assert not model_context.has_active_compact_text_model()
    assert model_context.current_text_model_id == "mock-runtime-text"
