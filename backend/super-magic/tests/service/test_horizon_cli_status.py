import pytest

from app.core.context.agent_context import AgentContext
from app.core.horizon.agent_horizon import AgentHorizon
from app.core.horizon.store import HorizonStore


@pytest.mark.asyncio
async def test_cli_status_injects_in_initial_context_when_ready(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await horizon.set_cli_status('<cli name="dws">authenticated</cli>')

    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<local_cli_context>" in context
    assert '<cli name="dws">authenticated</cli>' in context
    assert "installed=yes" not in context


@pytest.mark.asyncio
async def test_cli_status_does_not_inject_not_authenticated_content(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await horizon.set_cli_status("- DingTalk dws: installed=yes; auth=not_authenticated")

    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<local_cli_context>" not in context
    assert "not_authenticated" not in context


@pytest.mark.asyncio
async def test_cli_status_late_result_injects_changed_block(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    first_context = await horizon.build_context_update("unit-test")
    assert first_context is not None
    assert "<local_cli_context>" not in first_context

    await horizon.set_cli_status('<cli name="lark-cli">authenticated</cli>')

    next_context = await horizon.build_context_update("unit-test")

    assert next_context is not None
    assert "<local_cli_context_changed>" in next_context
    assert '<cli name="lark-cli">authenticated</cli>' in next_context


@pytest.mark.asyncio
async def test_cli_status_survives_setting_same_horizon_agent_id(tmp_path):
    context = AgentContext(isolated=True)
    context.agent_name = "magic"
    context.set_chat_history_dir(str(tmp_path))

    await context.horizon.set_cli_status('<cli name="dws">authenticated</cli>')

    context.set_horizon_agent_id("main")
    horizon_context = await context.horizon.build_context_update("unit-test")

    assert horizon_context is not None
    assert "<local_cli_context>" in horizon_context
    assert '<cli name="dws">authenticated</cli>' in horizon_context
