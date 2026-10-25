import pytest

from agentlang.agent.models import AgentRunRequest
from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import (
    AssistantMessage,
    SystemMessage,
    UserMessage,
    UserMessageContentPart,
)
from app.utils.async_file_utils import async_read_json, async_write_json


class _EventDispatcher:
    async def dispatch(self, _event) -> None:
        return None


@pytest.mark.asyncio
async def test_chat_history_save_and_load_keep_existing_message_format(tmp_path):
    history_dir = tmp_path / "chat_history"
    history = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    assert not history_dir.exists()
    history.messages = [
        SystemMessage(content="system", created_at="2026-07-24 00:00:00"),
        UserMessage(content="question", created_at="2026-07-24 00:00:01"),
        AssistantMessage(
            content="answer",
            created_at="2026-07-24 00:00:02",
            duration_ms=1_500,
        ),
    ]

    await history.save()

    document = await async_read_json(history._history_file_path)
    assert "id" not in document[0]
    assert "duration_ms" not in document[2]
    assert document[2]["duration"] == "1.500s"

    loaded = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    await loaded.load()
    assert [message.content for message in loaded.messages] == ["system", "question", "answer"]


@pytest.mark.asyncio
async def test_chat_history_load_does_not_activate_unused_duration_conversion(tmp_path):
    history = ChatHistory("test-agent", "agent-1", str(tmp_path), _EventDispatcher())
    await async_write_json(
        history._history_file_path,
        [
            {
                "timestamp": "2026-07-24 00:00:00",
                "role": "assistant",
                "content": "answer",
                "show_in_ui": True,
                "duration": "1.50s",
            }
        ],
    )

    last_message = await history.load_last_message_from_disk()

    assert isinstance(last_message, AssistantMessage)
    assert last_message.duration_ms is None


@pytest.mark.asyncio
async def test_chat_history_persists_normalized_image_refs_and_loads_legacy_text(tmp_path):
    history = ChatHistory("test-agent", "agent-1", str(tmp_path), _EventDispatcher())
    history.messages = [
        UserMessage(
            content="Inspect image",
            content_parts=[
                UserMessageContentPart.text_part("Inspect image"),
                UserMessageContentPart.image_ref("uploads/image.png"),
            ],
        )
    ]

    await history.save()
    loaded = ChatHistory("test-agent", "agent-1", str(tmp_path), _EventDispatcher())
    await loaded.load()

    assert isinstance(loaded.messages[0], UserMessage)
    assert loaded.messages[0].content_parts == [
        UserMessageContentPart.text_part("Inspect image"),
        UserMessageContentPart.image_ref("uploads/image.png"),
    ]


def test_user_message_rejects_malformed_content_parts():
    """新格式历史中的非法内容片段不应被静默丢弃。"""
    with pytest.raises(TypeError, match="content_parts must be a list"):
        UserMessage.from_dict({"content": "Inspect image", "content_parts": {}})

    with pytest.raises(TypeError, match="content part must be a dictionary"):
        UserMessage.from_dict({"content": "Inspect image", "content_parts": ["image.png"]})


def test_chat_history_message_snapshot_is_immutable(tmp_path):
    """应用层获取的消息快照不应随 ChatHistory 后续写入而变化。"""
    history = ChatHistory("test-agent", "agent-1", str(tmp_path), _EventDispatcher())
    history.messages = [UserMessage(content="first")]

    snapshot = history.get_message_snapshot()
    history.messages.append(UserMessage(content="second"))

    assert isinstance(snapshot, tuple)
    assert [message.content for message in snapshot] == ["first"]


@pytest.mark.asyncio
async def test_chat_history_appends_normalized_agent_run_request(tmp_path):
    """ChatHistory 应直接持久化应用层已经规范化的运行请求。"""
    history = ChatHistory(
        "test-agent",
        "agent-1",
        str(tmp_path / "chat_history"),
        _EventDispatcher(),
    )

    await history.append_user_query(
        AgentRunRequest(
            query="Inspect image",
            image_refs=["images/mock.png"],
        )
    )

    assert isinstance(history.messages[0], UserMessage)
    assert history.messages[0].content_parts == [
        UserMessageContentPart.text_part("Inspect image"),
        UserMessageContentPart.image_ref("images/mock.png"),
    ]


@pytest.mark.asyncio
async def test_chat_history_persists_message_level_native_visual_flag(tmp_path):
    """消息级原生视觉配置随历史落盘，未设置时不写入多余字段。"""
    history_dir = tmp_path / "chat_history"
    history = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    history.messages = [
        UserMessage(
            content="question",
            created_at="2026-07-24 00:00:01",
            content_parts=[UserMessageContentPart.image_ref("a.png")],
            include_in_native_visual=False,
        ),
        UserMessage(content="plain", created_at="2026-07-24 00:00:02"),
    ]

    await history.save()

    document = await async_read_json(history._history_file_path)
    assert document[0]["include_in_native_visual"] is False
    assert "include_in_native_visual" not in document[1]

    loaded = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    await loaded.load()
    assert loaded.messages[0].include_in_native_visual is False
    assert loaded.messages[1].include_in_native_visual is None


@pytest.mark.asyncio
async def test_chat_history_native_visual_disable_is_idempotent(tmp_path):
    """重复关闭同一批原生视觉消息无副作用，纯文本消息不受影响。"""
    history_dir = tmp_path / "chat_history"
    history = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    image_message = UserMessage(
        content="question",
        created_at="2026-07-24 00:00:01",
        content_parts=[UserMessageContentPart.image_ref("a.png")],
    )
    text_message = UserMessage(content="plain", created_at="2026-07-24 00:00:02")
    history.messages = [image_message, text_message]

    assert await history.disable_native_visual_messages() == 1
    assert image_message.include_in_native_visual is False
    assert text_message.include_in_native_visual is None
    assert await history.disable_native_visual_messages() == 0


@pytest.mark.asyncio
async def test_chat_history_disables_historical_native_visual_when_over_limit(tmp_path):
    """历史加当前合计超过上限时关掉全部历史原生视觉消息，当前消息仍可带图。"""
    history_dir = tmp_path / "chat_history"
    history = ChatHistory("test-agent", "agent-1", str(history_dir), _EventDispatcher())
    old_one = UserMessage(
        content="old-1",
        created_at="2026-07-24 00:00:01",
        content_parts=[
            UserMessageContentPart.image_ref("old-1a.png"),
            UserMessageContentPart.image_ref("old-1b.png"),
        ],
    )
    old_two = UserMessage(
        content="old-2",
        created_at="2026-07-24 00:00:02",
        content_parts=[UserMessageContentPart.image_ref("old-2.png")],
    )
    current = UserMessage(
        content="current",
        created_at="2026-07-24 00:00:03",
        content_parts=[UserMessageContentPart.image_ref("current.png")],
    )
    history.messages = [old_one, old_two, current]

    # 历史 3 张、当前 1 张，合计 4。上限 3 时只看历史不会清，合计后会清掉历史。
    assert await history.disable_historical_native_visual_if_over_limit(3) == 2
    assert old_one.include_in_native_visual is False
    assert old_two.include_in_native_visual is False
    assert current.include_in_native_visual is None

    history.messages = [old_one, old_two, current]
    old_one.include_in_native_visual = None
    old_two.include_in_native_visual = None
    assert await history.disable_historical_native_visual_if_over_limit(4) == 0
    assert old_one.include_in_native_visual is None
    assert old_two.include_in_native_visual is None
    assert current.include_in_native_visual is None
