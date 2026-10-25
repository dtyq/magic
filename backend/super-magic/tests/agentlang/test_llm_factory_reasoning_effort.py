"""使用 mock 请求处理器验证思考参数透传，不访问网络。"""
import asyncio
from unittest.mock import AsyncMock, Mock

import pytest
from openai.types.chat import ChatCompletion

from agentlang.llms.factory import LLMClientConfig, LLMFactory
from agentlang.llms.processors import ProcessorConfig


@pytest.mark.asyncio
@pytest.mark.parametrize("stream", [False, True])
@pytest.mark.parametrize("effort", ["none", "minimal", "low", "medium", "high", "xhigh", "max", "mock-future-level"])
async def test_reasoning_merges_native_options_without_mutating_cached_config(monkeypatch, stream, effort):
    """流式与非流式共用参数；强度覆盖不丢失其他参数、不污染下一次请求。"""
    config = LLMClientConfig(
        model_id="mock-model", name="mock-model", provider="mock-provider", api_key="mock-key", api_base_url="https://mock.invalid",
        extra_params={"extra_body": {"mock_option": True}},
    )
    response = ChatCompletion(id="mock-response", created=0, object="chat.completion", model="mock-model", choices=[{
        "index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "Mock"},
    }])
    execute = AsyncMock(return_value=response)
    monkeypatch.setattr("agentlang.llms.factory.ProcessorManager.execute_llm_call", execute)
    monkeypatch.setattr(LLMFactory, "get_for_config", Mock(return_value=object()))
    monkeypatch.setattr("agentlang.llms.factory.get_current_tokens", AsyncMock(return_value=1))
    monkeypatch.setattr("agentlang.llms.factory.MetadataUtil.get_llm_request_headers", Mock(return_value={}))
    monkeypatch.setattr("agentlang.llms.factory.save_llm_debug_log", AsyncMock())
    monkeypatch.setattr(LLMFactory, "token_tracker", Mock())
    processor = ProcessorConfig.create_streaming_only() if stream else ProcessorConfig.create_default()
    for _ in range(2):
        await LLMFactory.call_with_tool_support("mock-model", [{"role": "user", "content": "Mock"}], llm_config=config, processor_config=processor, extra_body={"reasoning_effort": effort})
        assert execute.call_args.kwargs["request_params"]["extra_body"] == {"mock_option": True, "reasoning_effort": effort}
    await LLMFactory.call_with_tool_support("mock-model", [], llm_config=config, processor_config=processor)
    assert execute.call_args.kwargs["request_params"]["extra_body"] == {"mock_option": True}
    assert config.extra_params == {"extra_body": {"mock_option": True}}
    await asyncio.sleep(0)
