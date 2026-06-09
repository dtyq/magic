import pytest

from app.core.entity.message.server_message import DisplayType
from app.tools.compact_chat_history import CompactChatHistory, CompactChatHistoryParams


@pytest.mark.asyncio
async def test_compact_chat_history_builds_frontend_detail():
    tool = CompactChatHistory()
    summary = "Mock compact summary for a long conversation."

    result = await tool.execute(None, CompactChatHistoryParams(summary=summary))
    detail = await tool.get_tool_detail(None, result, {"summary": summary})

    assert result.ok
    assert detail is not None
    assert detail.type == DisplayType.MD
    assert "对话内容已整理" in detail.data.content
    assert "压缩摘要" in detail.data.content
    assert str(len(summary)) in detail.data.content
    assert summary in detail.data.content
