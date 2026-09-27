import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import app.service  # noqa: F401  # Finish service initialization before importing Agent.
from agentlang.agent.state import AgentState
from agentlang.event.correlation_id_manager import CorrelationIdManager
from app.magic.agent import Agent
from app.magic.background_compact import BackgroundCompactState


def _make_agent(context_id: str) -> Agent:
    agent = Agent.__new__(Agent)
    agent.agent_context = SimpleNamespace(context_id=context_id)
    agent.agent_name = "test-agent"
    agent.agent_state = AgentState.RUNNING
    agent._closed = False
    agent._context_registered = False
    agent._active_run_task = None
    agent._bg_compact_state = BackgroundCompactState()
    return agent


@pytest.fixture
def manager(monkeypatch):
    manager = CorrelationIdManager()
    manager.set_stream_fallback_cid("parent-request", "parent-context")
    manager.set_stream_fallback_cid("child-request", "child-context")
    monkeypatch.setattr("agentlang.event.get_correlation_manager", lambda: manager)
    return manager


def test_close_clears_only_the_agents_fallback_scope(manager):
    agent = _make_agent("child-context")

    agent.close()
    agent.close()

    assert manager.pop_stream_fallback_cid("child-context") is None
    assert manager.pop_stream_fallback_cid("parent-context") == "parent-request"


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome", [None, RuntimeError, asyncio.CancelledError])
async def test_run_clears_unconsumed_fallback_on_every_exit(manager, outcome):
    agent = _make_agent("child-context")
    agent._run_once = AsyncMock(return_value="done", side_effect=outcome)

    if outcome is None:
        assert await agent.run("test query") == "done"
    else:
        with pytest.raises(outcome):
            await agent.run("test query")

    assert not agent.has_active_run()
    assert manager.pop_stream_fallback_cid("child-context") is None
    assert manager.pop_stream_fallback_cid("parent-context") == "parent-request"


@pytest.mark.asyncio
async def test_rejected_overlapping_run_keeps_active_fallback(manager):
    agent = _make_agent("child-context")
    agent._active_run_task = asyncio.current_task()

    with pytest.raises(RuntimeError, match="already running"):
        await agent.run("overlapping query")

    assert manager.pop_stream_fallback_cid("child-context") == "child-request"
    assert manager.pop_stream_fallback_cid("parent-context") == "parent-request"
