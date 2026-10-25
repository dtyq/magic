from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from agentlang.event.correlation_id_manager import CorrelationIdManager
from agentlang.llms.processors.processor_config import ProcessorConfig
from agentlang.llms.processors.processor_manager import ProcessorManager


class MockAgentContext:
    """提供 ProcessorManager 所需最小上下文契约。"""

    def __init__(self, message_version="v2", context_id="mock-context"):
        self._message_version = message_version
        self.context_id = context_id
        self.metadata = {}

    def get_message_version(self):
        return self._message_version

    def set_metadata(self, key, value):
        self.metadata[key] = value


@pytest.mark.asyncio
async def test_v2_stream_failure_keeps_scoped_fallback(monkeypatch):
    """V2 流式失败后应保留当前上下文的 request_id 供非流式降级复用。"""
    manager = CorrelationIdManager()
    context = MockAgentContext(context_id="mock-context-a")
    stream_call = AsyncMock(side_effect=RuntimeError("mock stream failure"))
    monkeypatch.setattr("agentlang.event.get_correlation_manager", lambda: manager)
    monkeypatch.setattr(
        "agentlang.llms.processors.processor_manager.StreamingCallProcessor.call_with_stream",
        stream_call,
    )

    with pytest.raises(RuntimeError, match="mock stream failure"):
        await ProcessorManager.execute_llm_call(
            client=SimpleNamespace(),
            llm_config=SimpleNamespace(),
            request_params={},
            model_id="mock-model-id",
            processor_config=ProcessorConfig(use_stream_mode=True),
            agent_context=context,
            request_id="mock-request-id",
        )

    assert manager.pop_stream_fallback_cid("mock-context-a") == "mock-request-id"


@pytest.mark.asyncio
async def test_v1_stream_does_not_manage_v2_fallback(monkeypatch):
    """V1 流式调用不应读写 V2 专用 fallback 状态。"""
    manager = CorrelationIdManager()
    context = MockAgentContext(message_version="v1")
    set_fallback = Mock(wraps=manager.set_stream_fallback_cid)
    manager.set_stream_fallback_cid = set_fallback
    monkeypatch.setattr("agentlang.event.get_correlation_manager", lambda: manager)
    monkeypatch.setattr(
        "agentlang.llms.processors.processor_manager.StreamingCallProcessor.call_with_stream",
        AsyncMock(return_value=SimpleNamespace()),
    )

    await ProcessorManager.execute_llm_call(
        client=SimpleNamespace(),
        llm_config=SimpleNamespace(),
        request_params={},
        model_id="mock-model-id",
        processor_config=ProcessorConfig(use_stream_mode=True),
        agent_context=context,
        request_id="mock-request-id",
    )

    set_fallback.assert_not_called()


@pytest.mark.asyncio
async def test_v2_stream_without_reply_events_does_not_manage_fallback(monkeypatch):
    """未启用回复事件的辅助调用不应遗留可被后续请求消费的 fallback CID。"""
    manager = CorrelationIdManager()
    context = MockAgentContext(message_version="v2")
    set_fallback = Mock(wraps=manager.set_stream_fallback_cid)
    manager.set_stream_fallback_cid = set_fallback
    monkeypatch.setattr("agentlang.event.get_correlation_manager", lambda: manager)
    monkeypatch.setattr(
        "agentlang.llms.processors.processor_manager.StreamingCallProcessor.call_with_stream",
        AsyncMock(return_value=SimpleNamespace()),
    )

    await ProcessorManager.execute_llm_call(
        client=SimpleNamespace(),
        llm_config=SimpleNamespace(),
        request_params={},
        model_id="mock-model-id",
        processor_config=ProcessorConfig(use_stream_mode=True),
        agent_context=context,
        request_id="mock-request-id",
        enable_llm_response_events=False,
    )

    set_fallback.assert_not_called()
