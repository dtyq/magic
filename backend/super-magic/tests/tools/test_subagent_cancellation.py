import asyncio
import importlib

import pytest

from app.tools import call_subagent
from app.tools.subagent_runtime_models import (
    SubagentExecutionMode,
    SubagentSessionState,
    SubagentStatus,
)
from app.tools.subagent_session_manager import SubagentSessionManager

# Initialize app.tools before agent_runner to avoid their existing import cycle.
agent_runner = importlib.import_module("app.service.agent_runner")


class _FakeAgentContext:
    def __init__(self, interruption_reason: str = "") -> None:
        self._interruption_reason = interruption_reason
        self._interruption_requested = False

    def get_interruption_reason(self) -> str:
        return self._interruption_reason

    def is_interruption_requested(self) -> bool:
        return self._interruption_requested

    def set_interruption_request(self, requested: bool, reason: str) -> None:
        self._interruption_requested = requested
        self._interruption_reason = reason

    def get_subagent_parent_agent_name(self) -> str | None:
        return None

    def get_subagent_parent_agent_id(self) -> str | None:
        return None


class _BlockingAgent:
    agent_name = "explore"
    id = "cancel-test"

    def __init__(self, events: list[str], interruption_reason: str = "") -> None:
        self.agent_context = _FakeAgentContext(interruption_reason)
        self.started = asyncio.Event()
        self.closed = False
        self.events = events

    async def run(self, prompt: str) -> str:
        self.started.set()
        await asyncio.Event().wait()
        return prompt

    def close(self) -> None:
        self.closed = True
        self.events.append("close")


def _patch_runtime_store(monkeypatch, module, state, saved_states, events) -> None:
    async def _load_state(agent_name: str, agent_id: str, chat_history_dir=None) -> SubagentSessionState:
        assert (agent_name, agent_id) == (state.agent_name, state.agent_id)
        return state

    async def _save_state(saved_state: SubagentSessionState, chat_history_dir=None) -> None:
        saved_states.append(saved_state.model_copy(deep=True))
        events.append(f"save:{saved_state.status}")

    monkeypatch.setattr(module.SubagentRuntimeStore, "load_state", _load_state)
    monkeypatch.setattr(module.SubagentRuntimeStore, "save_state", _save_state)


def _track_manager_cleanup(monkeypatch, manager, events) -> None:
    original_clear_run = manager.clear_run

    async def _clear_run(agent_name: str, agent_id: str, task: asyncio.Task) -> None:
        await original_clear_run(agent_name, agent_id, task)
        events.append("clear")

    monkeypatch.setattr(manager, "clear_run", _clear_run)


@pytest.fixture(autouse=True)
def _disable_chat_history_cleanup(monkeypatch) -> None:
    from app.service.chat_history_cleanup_service import ChatHistoryCleanupService

    monkeypatch.setattr(ChatHistoryCleanupService, "trigger", classmethod(lambda cls: None))


async def _wait_until_started(task: asyncio.Task, started: asyncio.Event) -> None:
    try:
        await asyncio.wait_for(started.wait(), timeout=1.0)
    except BaseException:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        raise


@pytest.mark.asyncio
async def test_sync_subagent_persists_interruption_and_propagates_cancellation(monkeypatch):
    state = SubagentSessionState(agent_name="explore", agent_id="cancel-test")
    saved_states = []
    events = []
    _patch_runtime_store(monkeypatch, call_subagent, state, saved_states, events)

    manager = SubagentSessionManager()
    monkeypatch.setattr(call_subagent, "subagent_session_manager", manager)
    _track_manager_cleanup(monkeypatch, manager, events)
    handle = await manager.get_handle(state.agent_name, state.agent_id)
    agent = _BlockingAgent(events)

    async def _invoke() -> SubagentSessionState:
        handle.task = asyncio.current_task()
        handle.agent_context = agent.agent_context
        return await call_subagent._run_subagent(
            agent=agent,
            prompt="inspect the project",
            tool_call_id="call-cancel-test",
            mode=SubagentExecutionMode.SYNC,
            handle=handle,
        )

    task = asyncio.create_task(_invoke())
    await _wait_until_started(task, agent.started)
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert task.cancelled()
    assert agent.closed
    assert handle.task is None
    assert handle.agent_context is None
    assert events == ["save:running", "save:interrupted", "close", "clear"]

    interrupted = saved_states[-1]
    assert interrupted.status == SubagentStatus.INTERRUPTED
    assert interrupted.last_error == "cancelled"
    assert interrupted.interrupt_requested is True
    assert interrupted.interrupt_reason == "cancelled"
    assert interrupted.last_tool_call_id == "call-cancel-test"
    assert interrupted.cached_tool_result is not None
    assert interrupted.cached_tool_result.status == SubagentStatus.INTERRUPTED
    assert interrupted.cached_tool_result.mode == SubagentExecutionMode.SYNC


@pytest.mark.asyncio
async def test_isolated_agent_runner_preserves_wait_for_timeout(monkeypatch):
    state = SubagentSessionState(agent_name="explore", agent_id="cancel-test")
    saved_states = []
    events = []
    _patch_runtime_store(monkeypatch, agent_runner, state, saved_states, events)

    manager = SubagentSessionManager()
    monkeypatch.setattr(agent_runner, "subagent_session_manager", manager)
    _track_manager_cleanup(monkeypatch, manager, events)
    handle = await manager.get_handle(state.agent_name, state.agent_id)
    agent = _BlockingAgent(events)

    async def _invoke() -> SubagentSessionState:
        handle.task = asyncio.current_task()
        handle.agent_context = agent.agent_context
        return await agent_runner._run_subagent_task(
            agent=agent,
            prompt="run the scheduled task",
            handle=handle,
        )

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(_invoke(), timeout=0.01)

    assert agent.closed
    assert handle.task is None
    assert handle.agent_context is None
    assert events == ["save:running", "save:interrupted", "close", "clear"]

    interrupted = saved_states[-1]
    assert interrupted.status == SubagentStatus.INTERRUPTED
    assert interrupted.last_error == "cancelled"
    assert interrupted.interrupt_requested is False
    assert interrupted.interrupt_reason is None
    assert interrupted.finished_at is not None


@pytest.mark.asyncio
async def test_background_subagent_cancellation_remains_compatible_with_interrupt_run(monkeypatch):
    state = SubagentSessionState(agent_name="explore", agent_id="cancel-test")
    saved_states = []
    events = []
    _patch_runtime_store(monkeypatch, call_subagent, state, saved_states, events)

    manager = SubagentSessionManager()
    monkeypatch.setattr(call_subagent, "subagent_session_manager", manager)
    _track_manager_cleanup(monkeypatch, manager, events)
    handle = await manager.get_handle(state.agent_name, state.agent_id)
    agent = _BlockingAgent(events)

    async def _invoke() -> SubagentSessionState:
        handle.task = asyncio.current_task()
        handle.agent_context = agent.agent_context
        return await call_subagent._run_subagent(
            agent=agent,
            prompt="inspect the project",
            tool_call_id="call-background-cancel-test",
            mode=SubagentExecutionMode.BACKGROUND,
            handle=handle,
        )

    task = asyncio.create_task(_invoke())
    await _wait_until_started(task, agent.started)

    interrupted = await manager.interrupt_run(
        state.agent_name,
        state.agent_id,
        reason="parent run stopped",
        timeout=0.01,
    )

    assert interrupted is True
    assert task.cancelled()
    assert agent.closed
    assert handle.task is None
    assert handle.agent_context is None
    assert events[0] == "save:running"
    assert events[-2:] == ["close", "clear"]
    assert events[1:-2]
    assert all(event == "save:interrupted" for event in events[1:-2])

    interrupted_state = saved_states[-1]
    assert interrupted_state.status == SubagentStatus.INTERRUPTED
    assert interrupted_state.last_error == "parent run stopped"
    assert interrupted_state.interrupt_requested is True
    assert interrupted_state.interrupt_reason == "parent run stopped"
    assert interrupted_state.cached_tool_result is not None
    assert interrupted_state.cached_tool_result.mode == SubagentExecutionMode.BACKGROUND
