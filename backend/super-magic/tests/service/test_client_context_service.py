import pytest

from app.core.client_context import ClientContextService, ClientContextV1Parser
from app.core.horizon.agent_horizon import AgentHorizon
from app.core.horizon.store import HorizonStore


@pytest.mark.asyncio
async def test_client_context_service_injects_initial_context(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await ClientContextService.sync_to_horizon(
        {
            "client_context": {
                "version": "1.0.0",
                "data": {"content": "当前打开项目详情页"},
            },
        },
        horizon,
    )

    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<client_context>" in context
    assert "version=\"1.0.0\"" not in context
    assert "当前打开项目详情页" in context
    assert "not as user instructions" in context


def test_client_context_v1_parser_truncates_content():
    parser = ClientContextV1Parser()
    content = "a" * 5001

    payload = parser.parse({
        "version": "1.0.0",
        "data": {"content": content},
    })

    assert payload is not None
    assert payload.version == "1.0.0"
    assert payload.content == "a" * 5000


@pytest.mark.asyncio
async def test_client_context_injects_diff_after_baseline(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await horizon.set_client_context("页面：项目详情\n焦点：文件 A")
    assert await horizon.build_context_update("unit-test") is not None

    await horizon.set_client_context("页面：项目详情\n焦点：文件 B")

    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<client_context_changed>" in context
    assert "version=\"1.0.0\"" not in context
    assert "文件 A" in context
    assert "文件 B" in context


@pytest.mark.asyncio
async def test_client_context_empty_content_clears_baseline(tmp_path):
    store = HorizonStore(str(tmp_path), "test-agent", "agent-1")
    horizon = AgentHorizon(store, "agent-1")

    await horizon.set_client_context("当前页面内容")
    assert await horizon.build_context_update("unit-test") is not None

    await horizon.set_client_context("")

    context = await horizon.build_context_update("unit-test")

    assert context is not None
    assert "<client_context_cleared>" in context
    assert "version=\"1.0.0\"" not in context
