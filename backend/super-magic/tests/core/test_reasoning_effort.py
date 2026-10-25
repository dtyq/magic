"""使用 mock 上下文验证强度隔离，不访问真实模型。"""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.context.agent_context import AgentContext


def make_context():
    """提供实际方法需要的完整运行字段。"""
    return SimpleNamespace(
        reasoning_effort=None,
        is_main_agent=True,
        model_context=SimpleNamespace(has_active_compact_text_model=Mock(return_value=False)),
    )


@pytest.mark.parametrize("effort", ["none", "minimal", "low", "medium", "high", "xhigh", "max"])
def test_effort_survives_tool_rounds_and_resets_next_message(effort):
    """同轮多次请求保持一致，下一条默认消息不沿用旧强度。"""
    context = make_context()
    AgentContext.set_reasoning_effort(context, effort)
    for _ in range(3):
        assert AgentContext.get_reasoning_extra_body(context) == {"reasoning_effort": effort}
    AgentContext.set_reasoning_effort(context, None)
    assert AgentContext.get_reasoning_extra_body(context) is None


@pytest.mark.parametrize("effort", ["unknown", "", 1, [], {}])
def test_unrecognized_effort_is_forwarded_unchanged(effort):
    """中间层不维护档位及类型规则，原始值继续交给 Odin。"""
    context = make_context()
    AgentContext.set_reasoning_effort(context, effort)
    assert context.reasoning_effort == effort
    assert AgentContext.get_reasoning_extra_body(context) == {"reasoning_effort": effort}


def test_compaction_subagents_and_concurrent_contexts_are_isolated():
    """压缩与子 Agent 不继承强度，不同运行上下文互不污染。"""
    first, second = make_context(), make_context()
    AgentContext.set_reasoning_effort(first, "high")
    AgentContext.set_reasoning_effort(second, "low")
    assert AgentContext.get_reasoning_extra_body(first) == {"reasoning_effort": "high"}
    assert AgentContext.get_reasoning_extra_body(second) == {"reasoning_effort": "low"}
    first.model_context.has_active_compact_text_model.return_value = True
    assert AgentContext.get_reasoning_extra_body(first) is None
    second.is_main_agent = False
    assert AgentContext.get_reasoning_extra_body(second) is None
