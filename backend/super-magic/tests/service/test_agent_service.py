from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.service.agent_service import AgentService


@pytest.mark.asyncio
async def test_run_agent_injects_video_config_as_hidden_runtime_message(monkeypatch):
    service = AgentService()
    enqueued_messages = []

    chat_client_message = SimpleNamespace(
        prompt="帮我生成视频",
        dynamic_config={"video_model": {"model_id": "veo-3.1-fast-generate-preview"}},
        mentions=[],
        attachments=[],
    )
    agent_context = SimpleNamespace(get_chat_client_message=lambda: chat_client_message)
    agent = SimpleNamespace(
        agent_context=agent_context,
        _process_user_input_with_mentions=lambda query, _: query,
        enqueue_runtime_user_message=lambda message: enqueued_messages.append(message),
        run_main_agent=AsyncMock(),
    )

    async def _append_mcp_servers(query, _agent):
        return query

    async def _archive_and_upload_project(_agent_context):
        return None

    monkeypatch.setattr(
        "app.service.agent_service.ImageModelSizesService.append_image_sizes_to_query",
        lambda query, dynamic_config, current_agent: f"{query}|image-sizes",
    )
    monkeypatch.setattr(
        "app.service.agent_service.VideoModelConfigService.build_runtime_video_model_config_message",
        lambda dynamic_config, current_agent: "video-model-config",
    )
    monkeypatch.setattr(
        "app.service.agent_service.MCPServersService.append_mcp_servers_to_query",
        _append_mcp_servers,
    )
    monkeypatch.setattr(
        "app.service.agent_service.FileStorageListenerService._archive_and_upload_project",
        _archive_and_upload_project,
    )
    monkeypatch.setattr(
        "app.service.agent_service.asyncio.create_task",
        lambda coro: coro.close(),
    )

    await service.run_agent(agent)

    assert enqueued_messages == ["video-model-config"]
    agent.run_main_agent.assert_awaited_once_with("帮我生成视频|image-sizes")
