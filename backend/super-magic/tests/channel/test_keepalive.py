import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.channel.base import keepalive as keepalive_module
from app.channel.base.keepalive import ChannelKeepalive


@pytest.mark.asyncio
async def test_keepalive_waits_until_channel_becomes_active(monkeypatch: pytest.MonkeyPatch) -> None:
    """连接稍后建立时，保活任务也应该继续存活并开始续命。"""
    activity_mock = Mock()
    dispatcher = SimpleNamespace(agent_context=SimpleNamespace(update_activity_time=activity_mock))
    monkeypatch.setattr(keepalive_module, "_KEEPALIVE_INTERVAL", 0.01)
    monkeypatch.setattr(keepalive_module, "_INACTIVE_RETRY_INTERVAL", 0.01)
    monkeypatch.setattr(
        "app.service.agent_dispatcher.AgentDispatcher.get_instance",
        lambda: dispatcher,
    )

    active = False
    keepalive = ChannelKeepalive("Test", is_active=lambda: active)
    keepalive.start()

    await asyncio.sleep(0.02)
    active = True
    await asyncio.sleep(0.03)

    keepalive.stop()
    await asyncio.sleep(0)

    activity_mock.assert_called()


@pytest.mark.asyncio
async def test_keepalive_survives_temporary_disconnect(monkeypatch: pytest.MonkeyPatch) -> None:
    """短暂断线后重新连上时，原保活任务不应提前退出。"""
    activity_mock = Mock()
    dispatcher = SimpleNamespace(agent_context=SimpleNamespace(update_activity_time=activity_mock))
    monkeypatch.setattr(keepalive_module, "_KEEPALIVE_INTERVAL", 0.01)
    monkeypatch.setattr(keepalive_module, "_INACTIVE_RETRY_INTERVAL", 0.01)
    monkeypatch.setattr(
        "app.service.agent_dispatcher.AgentDispatcher.get_instance",
        lambda: dispatcher,
    )

    active = True
    keepalive = ChannelKeepalive("Test", is_active=lambda: active)
    keepalive.start()

    await asyncio.sleep(0.02)
    active = False
    await asyncio.sleep(0.02)
    active = True
    await asyncio.sleep(0.03)

    keepalive.stop()
    await asyncio.sleep(0)

    assert activity_mock.call_count >= 2
