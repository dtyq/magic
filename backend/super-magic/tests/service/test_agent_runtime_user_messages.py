import os
import tempfile
from types import SimpleNamespace

import pytest

from app.magic.agent import Agent


class _ChatHistory:
    def __init__(self):
        self.messages = []
        self.appended_messages = []

    async def append_system_message(self, content: str, show_in_ui: bool = False):
        self.messages.append(SimpleNamespace(role="system", content=content, show_in_ui=show_in_ui))
        self.appended_messages.append(("system", content, show_in_ui))

    async def append_user_message(self, content: str, show_in_ui: bool = True):
        self.messages.append(SimpleNamespace(role="user", content=content, show_in_ui=show_in_ui))
        self.appended_messages.append(("user", content, show_in_ui))

    async def update_first_system_prompt(self, content: str):
        self.appended_messages.append(("update_system", content, False))


class _AgentContext:
    def __init__(self):
        self._workspace_dir = tempfile.gettempdir()

    @staticmethod
    def get_subagent_depth() -> int:
        return 0

    @staticmethod
    def get_subagent_parent_agent_name():
        return None

    @staticmethod
    async def close_all_resources():
        return None


def _build_agent(*, dynamic_context_prompt, runtime_user_messages):
    agent = Agent.__new__(Agent)
    agent.agent_name = "magic"
    agent.id = "main"
    agent.system_prompt = "system prompt"
    agent.dynamic_context_prompt = dynamic_context_prompt
    agent.chat_history = _ChatHistory()
    agent.agent_context = _AgentContext()
    agent.stream_mode = False
    agent._runtime_user_messages = runtime_user_messages

    def _set_agent_state(state):
        agent.agent_state = state

    async def _prepare_session(query: str):
        await agent.chat_history.append_user_message(query)
        return "prepared"

    async def _handle_agent_loop(session_prep_result):
        return session_prep_result

    agent.set_agent_state = _set_agent_state
    agent._prepare_session_for_new_query = _prepare_session
    agent._handle_agent_loop = _handle_agent_loop
    return agent


async def _run_agent(agent: Agent, query: str):
    current_dir = os.getcwd()
    try:
        return await Agent.run(agent, query)
    finally:
        os.chdir(current_dir)


@pytest.mark.asyncio
async def test_run_injects_runtime_user_messages_before_query():
    agent = _build_agent(
        dynamic_context_prompt="dynamic context",
        runtime_user_messages=["video config"],
    )

    result = await _run_agent(agent, "hello")

    assert result == "prepared"
    assert agent._runtime_user_messages == []
    assert agent.chat_history.appended_messages == [
        ("system", "system prompt", False),
        ("user", "dynamic context", True),
        ("user", "video config", False),
        ("user", "hello", True),
    ]


@pytest.mark.asyncio
async def test_run_without_runtime_user_messages_keeps_existing_behavior():
    agent = _build_agent(dynamic_context_prompt=None, runtime_user_messages=[])

    await _run_agent(agent, "hello")

    assert agent.chat_history.appended_messages == [
        ("system", "system prompt", False),
        ("user", "hello", True),
    ]
