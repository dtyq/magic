from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agentlang.chat_history.chat_history_models import UserMessage, UserMessageContentPart
from app.core.horizon.agent_horizon import AgentHorizon
from app.core.horizon.store import HorizonStore
from app.magic.agent import Agent
from app.service.multimodal_message_renderer import LLMMessageRenderResult
from app.service.native_visual_overflow_hint_builder import (
    NativeVisualOverflowHintBuilder,
)


class _FakeChatHistory:
    """只记录 Horizon 注入调用的最小聊天历史替身。"""

    def __init__(self) -> None:
        self.messages: list[UserMessage] = []

    async def add_message(self, message: UserMessage) -> None:
        """记录 Horizon 构造完成的 UserMessage 对象。"""
        self.messages.append(message)


@pytest.mark.asyncio
async def test_horizon_flushes_multiple_user_messages_in_order(tmp_path):
    """验证 Horizon 按登记顺序注入多个完整的 user 消息。"""
    history = _FakeChatHistory()
    context = SimpleNamespace(chat_history=history)
    horizon = AgentHorizon(
        HorizonStore(str(tmp_path), "magic", "agent-1"),
        "agent-1",
        context,
    )

    horizon.push_user_message(
        UserMessage(
            "分析这张图片",
            show_in_ui=False,
            source="native_visual",
            content_parts=[
                UserMessageContentPart.text_part("分析这张图片"),
                UserMessageContentPart.image_ref("images/chart.png"),
            ],
        )
    )
    horizon.push_user_message(
        UserMessage(
            "继续分析第二张图片",
            show_in_ui=False,
            source="native_visual",
            content_parts=[
                UserMessageContentPart.text_part("继续分析第二张图片"),
                UserMessageContentPart.image_ref("images/second.png"),
            ],
        )
    )
    assert len(horizon._pending_user_messages) == 2
    assert horizon._pending_user_messages[0].content == "分析这张图片"
    assert horizon._pending_user_messages[0].source == "native_visual"
    assert await horizon.flush_pending_user_messages() == 2
    assert len(history.messages) == 2
    message = history.messages[0]
    assert message.source == "native_visual"
    assert [part.path for part in message.content_parts[1:]] == ["images/chart.png"]


@pytest.mark.asyncio
async def test_horizon_injects_native_visual_overflow_hint(tmp_path):
    """图片数量超限时，应通过 Horizon 注入一次分批理解引导。"""
    horizon = AgentHorizon(
        HorizonStore(str(tmp_path), "magic", "agent-1"),
        "agent-1",
    )
    await horizon.reload_from_store()
    hint = NativeVisualOverflowHintBuilder.build(
        [f"image-{index}.png" for index in range(12)],
        10,
        supports_multimodal=True,
    )

    assert hint is not None
    horizon.push_notification("native_visual_overflow", hint)
    context = await horizon.build_context_update("before_first_llm")

    assert context is not None
    assert '<notification source="native_visual_overflow"' in context
    assert "leaving 2 images for later batches" in context
    assert "applies only to native images attached directly by the Chat user" in context
    assert "does not limit native visual messages appended by the visual tool" in context
    assert "does not impose a cumulative image-count limit" in context
    assert "already appended to conversation history remain available" in context
    assert "calling visual_understanding schedules a" in context
    assert context.count("visual_understanding") == 1
    assert "hidden user message through Horizon" in context
    assert "new native visual batch to the next LLM request" in context
    assert "manageable batches" in context
    assert "image-10.png" in context
    assert "image-11.png" in context


def test_native_visual_overflow_hint_is_not_built_within_limit():
    """当前图片数未超过上限时，不应产生误导性的超限通知。"""
    assert (
        NativeVisualOverflowHintBuilder.build(
            ["image.png"],
            10,
            supports_multimodal=True,
        )
        is None
    )


@pytest.mark.asyncio
async def test_agent_deduplicates_native_visual_horizon_notifications():
    """同一轮相同原生视觉状态只应登记一次 Horizon 通知。"""
    notifications = []
    agent = Agent.__new__(Agent)
    agent._native_visual_horizon_context_signature = None
    agent._native_visual_horizon_render_hint = None
    agent._native_visual_message_builder = SimpleNamespace(
        build_horizon_hint=AsyncMock(return_value="native visual context")
    )
    agent.agent_context = SimpleNamespace(
        horizon=SimpleNamespace(
            push_notification=lambda source, content: notifications.append(
                (source, content)
            )
        )
    )
    render_result = LLMMessageRenderResult(
        messages=[],
        native_image_paths=("image.png",),
        horizon_hint="render status",
    )

    assert await agent._push_native_visual_horizon_notifications(render_result) is True
    assert await agent._push_native_visual_horizon_notifications(render_result) is False
    assert notifications == [
        ("native_visual_context", "native visual context"),
        ("native_visual_render", "render status"),
    ]
