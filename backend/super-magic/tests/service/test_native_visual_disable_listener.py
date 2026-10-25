from types import SimpleNamespace

import httpx
import pytest
from openai import APIStatusError

from agentlang.event.data import AfterLlmRequestSucceededEventData, BeforeLlmRetryEventData
from agentlang.event.dispatcher import EventDispatcher
from agentlang.event.event import Event, EventType
from app.core.models.agent_model_context import AgentModelContext
from app.core.models.agent_model_selection import AgentModelSelection
from app.magic.agent import Agent, AgentLoopState
from app.service.agent_event.native_visual_disable_listener_service import (
    NativeVisualDisableListenerService,
)


def _api_status_error(status_code: int = 400) -> APIStatusError:
    request = httpx.Request("POST", "https://provider.example/v1/chat/completions")
    response = httpx.Response(status_code, request=request)
    return APIStatusError(
        "mock provider error",
        response=response,
        body={"error": {"message": "bad image"}},
    )


def _make_model_context() -> AgentModelContext:
    model_context = AgentModelContext()
    model_context.apply_selection(AgentModelSelection(
        configured_text_model_id="mock-vision-model",
        text_model_id="mock-vision-model",
    ))
    return model_context


def _make_retry_event_data(
    *,
    model_context: AgentModelContext,
    status_code: int | None = 400,
    request_contains_native_images: bool = True,
    is_context_window_exceeded: bool = False,
    exception: Exception | None = None,
    chat_history: object | None = None,
) -> BeforeLlmRetryEventData:
    return BeforeLlmRetryEventData(
        agent_context=SimpleNamespace(
            model_context=model_context,
            chat_history=chat_history,
        ),
        exception=exception or _api_status_error(status_code or 400),
        status_code=status_code,
        model_id="mock-vision-model",
        use_stream=True,
        backoff_retry_count=0,
        streaming_disabled=False,
        request_contains_native_images=request_contains_native_images,
        supports_multimodal=True,
        is_context_window_exceeded=is_context_window_exceeded,
    )


def _make_succeeded_event_data(model_context: AgentModelContext) -> AfterLlmRequestSucceededEventData:
    return AfterLlmRequestSucceededEventData(
        agent_context=SimpleNamespace(model_context=model_context),
        model_id="mock-vision-model",
        use_stream=False,
    )


@pytest.mark.asyncio
async def test_native_visual_400_threshold_disables_model_after_two_failures(monkeypatch):
    model_context = _make_model_context()
    disabled_models: list[str] = []
    history = SimpleNamespace(disabled=0)

    async def _disable_native_visual_messages(*, exclude=None):
        history.disabled += 1
        return 2

    history.disable_native_visual_messages = _disable_native_visual_messages
    monkeypatch.setattr(model_context, "disable_multimodal_for_model", disabled_models.append)
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )

    first = _make_retry_event_data(model_context=model_context, chat_history=history)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, first)
    )
    assert first.allow_retry is True
    assert first.skip_backoff is True
    assert first.reason == "native_visual_400_retry"
    assert model_context.native_visual_400_failure_count == 1
    assert disabled_models == []
    assert history.disabled == 0

    second = _make_retry_event_data(model_context=model_context, chat_history=history)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, second)
    )
    assert second.allow_retry is True
    assert second.reason == "native_visual_400_fallback"
    assert model_context.native_visual_fallback_applied is True
    assert disabled_models == ["mock-vision-model"]
    assert history.disabled == 1


@pytest.mark.asyncio
async def test_native_visual_4xx_counts_413_and_400_together(monkeypatch):
    """400 和 413 都计入同一条 4xx 降级路径。"""
    model_context = _make_model_context()
    disabled_models: list[str] = []
    history = SimpleNamespace(disabled=0)

    async def _disable_native_visual_messages(*, exclude=None):
        history.disabled += 1
        return 1

    history.disable_native_visual_messages = _disable_native_visual_messages
    monkeypatch.setattr(model_context, "disable_multimodal_for_model", disabled_models.append)
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )

    first = _make_retry_event_data(
        model_context=model_context,
        status_code=413,
        exception=_api_status_error(413),
        chat_history=history,
    )
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, first)
    )
    assert first.allow_retry is True
    assert model_context.native_visual_400_failure_count == 1
    assert disabled_models == []

    second = _make_retry_event_data(
        model_context=model_context,
        status_code=400,
        exception=_api_status_error(400),
        chat_history=history,
    )
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, second)
    )
    assert second.allow_retry is True
    assert second.reason == "native_visual_400_fallback"
    assert disabled_models == ["mock-vision-model"]
    assert history.disabled == 1


@pytest.mark.asyncio
async def test_native_visual_400_counter_resets_after_non_4xx_failure(monkeypatch):
    """5xx 不计入视觉降级，并清零已有的 4xx 计数。"""
    model_context = _make_model_context()
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )

    first = _make_retry_event_data(model_context=model_context)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, first)
    )
    assert model_context.native_visual_400_failure_count == 1

    reset = _make_retry_event_data(model_context=model_context, status_code=500)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, reset)
    )
    assert model_context.native_visual_400_failure_count == 0
    assert reset.allow_retry is None

    again = _make_retry_event_data(model_context=model_context)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, again)
    )
    assert model_context.native_visual_400_failure_count == 1
    assert model_context.native_visual_fallback_applied is False


@pytest.mark.asyncio
async def test_native_visual_listener_resets_on_request_succeeded(monkeypatch):
    model_context = _make_model_context()
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )

    failed = _make_retry_event_data(model_context=model_context)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, failed)
    )
    assert model_context.native_visual_400_failure_count == 1

    succeeded = _make_succeeded_event_data(model_context)
    await NativeVisualDisableListenerService._handle_after_llm_request_succeeded(
        Event(EventType.AFTER_LLM_REQUEST_SUCCEEDED, succeeded)
    )
    assert model_context.native_visual_400_failure_count == 0


@pytest.mark.asyncio
async def test_native_visual_listener_ignores_context_window_400(monkeypatch):
    model_context = _make_model_context()
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )

    counted = _make_retry_event_data(model_context=model_context)
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, counted)
    )

    context_window = _make_retry_event_data(
        model_context=model_context,
        is_context_window_exceeded=True,
    )
    await NativeVisualDisableListenerService._handle_before_llm_retry(
        Event(EventType.BEFORE_LLM_RETRY, context_window)
    )
    assert model_context.native_visual_400_failure_count == 1
    assert context_window.allow_retry is None


class _FakeVisionRetryAgent:
    _PROVIDER_RATE_LIMIT_STATUS_CODES = Agent._PROVIDER_RATE_LIMIT_STATUS_CODES
    _NON_RETRYABLE_STATUS_CODES = Agent._NON_RETRYABLE_STATUS_CODES
    _GENERATION_SPLIT_RECOVERY_PROMPT = Agent._GENERATION_SPLIT_RECOVERY_PROMPT
    _call_llm_with_retry = Agent._call_llm_with_retry
    _dispatch_before_llm_retry_event = Agent._dispatch_before_llm_retry_event
    _dispatch_llm_request_succeeded_event = Agent._dispatch_llm_request_succeeded_event
    _extract_api_status_code = Agent._extract_api_status_code
    _find_context_window_error = Agent._find_context_window_error
    _iter_exception_chain = Agent._iter_exception_chain
    _reset_generation_failure_streak = staticmethod(Agent._reset_generation_failure_streak)
    _record_generation_failure = Agent._record_generation_failure
    _extract_emitted_text_chars = Agent._extract_emitted_text_chars

    def __init__(self, failures: list[Exception]):
        self.disabled_models: list[str] = []
        model_context = _make_model_context()
        model_context.disable_multimodal_for_model = self.disabled_models.append
        model_context.resolve_text_model = lambda: SimpleNamespace(
            model_id="mock-vision-model",
            config=SimpleNamespace(supports_multimodal=True),
        )
        dispatcher = EventDispatcher()
        self.agent_context = SimpleNamespace(
            model_context=model_context,
            add_event_listener=dispatcher.add_listener,
            dispatch_event=lambda event_type, data: dispatcher.dispatch(Event(event_type, data)),
        )
        NativeVisualDisableListenerService.register_standard_listeners(self.agent_context)
        self._last_llm_request_contains_native_images = True
        self.failures = list(failures)
        self.calls: list[dict[str, object]] = []

    async def _prepare_and_call_llm(self, **kwargs):
        self.calls.append({"use_stream": kwargs.get("use_stream")})
        if self.failures:
            raise self.failures.pop(0)
        return SimpleNamespace(content="mock vision retry result")

    async def _try_fallback_compact_model_once(self, exception, **kwargs):
        return None

    def _extract_chunk_count(self, exception: Exception) -> int:
        return 0

    async def _try_inject_output_recovery_message(self, loop_state, prompt: str, source: str) -> bool:
        return True

    async def _interruptible_sleep(self, seconds: float) -> None:
        return None


@pytest.mark.asyncio
async def test_retry_loop_honors_native_visual_allow_retry(monkeypatch):
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )
    agent = _FakeVisionRetryAgent([_api_status_error(), _api_status_error()])

    result = await agent._call_llm_with_retry(AgentLoopState())

    assert result.content == "mock vision retry result"
    assert [call["use_stream"] for call in agent.calls] == [True, False, False]
    assert agent.disabled_models == ["mock-vision-model"]
    assert agent.agent_context.model_context.native_visual_fallback_applied is False


@pytest.mark.asyncio
async def test_retry_loop_honors_native_visual_allow_retry_for_413(monkeypatch):
    monkeypatch.setattr(
        "app.service.agent_event.native_visual_disable_listener_service.config.get",
        lambda key, default=None: 2 if key == "llm.native_visual_400_failure_threshold" else default,
    )
    agent = _FakeVisionRetryAgent([_api_status_error(413), _api_status_error(413)])

    result = await agent._call_llm_with_retry(AgentLoopState())

    assert result.content == "mock vision retry result"
    assert agent.disabled_models == ["mock-vision-model"]


@pytest.mark.asyncio
async def test_retry_loop_still_raises_plain_400():
    agent = _FakeVisionRetryAgent([_api_status_error()])
    agent._last_llm_request_contains_native_images = False

    with pytest.raises(APIStatusError):
        await agent._call_llm_with_retry(AgentLoopState())

    assert agent.disabled_models == []
    assert [call["use_stream"] for call in agent.calls] == [True]
