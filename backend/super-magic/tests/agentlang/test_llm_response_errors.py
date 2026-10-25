import pytest
from openai.types.chat import ChatCompletion

from app.magic.agent import Agent


@pytest.mark.parametrize("choices", [None, []])
def test_error_envelope_preserves_code_and_reason(choices):
    response = ChatCompletion.model_construct(code=403, message="Invalid user token", choices=choices)
    with pytest.raises(RuntimeError, match="code=403, message=Invalid user token"):
        Agent._validate_llm_response(response)


@pytest.mark.parametrize("choices", [None, []])
def test_missing_choices_is_controlled_error(choices):
    with pytest.raises(RuntimeError, match="no response choices"):
        Agent._validate_llm_response(ChatCompletion.model_construct(choices=choices))


def test_valid_tool_only_response_is_accepted():
    response = ChatCompletion.model_validate({"id": "test", "object": "chat.completion", "created": 0, "model": "test",
        "choices": [{"index": 0, "finish_reason": "tool_calls", "message": {"role": "assistant", "content": None,
            "tool_calls": [{"id": "call", "type": "function", "function": {"name": "read_file", "arguments": "{}"}}]}}]})
    Agent._validate_llm_response(response)


async def test_call_llm_propagates_error_envelope_before_reading_choices(monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    from agentlang.llms.factory import LLMFactory

    agent = SimpleNamespace(
        tools={}, chat_history=None,
        agent_context=SimpleNamespace(get_metadata=lambda: {}, stop_sequences=None, is_main_agent=False),
        _resolve_current_text_model=lambda: SimpleNamespace(model_id="test", model_name="test", config=None),
        _validate_llm_response=Agent._validate_llm_response,
    )
    monkeypatch.setattr(LLMFactory, "call_with_tool_support", AsyncMock(return_value=
                        ChatCompletion.model_construct(code=403, message="Invalid user token", choices=None)))
    with pytest.raises(RuntimeError, match="code=403, message=Invalid user token"):
        await Agent._call_llm(agent, [{"role": "user", "content": "hello"}], use_stream=False)
