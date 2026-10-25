import pytest

from app.service.user_tool_call_service import PendingToolCall, UserToolCallService


class _Horizon:
    async def build_context_update(self, **_kwargs):
        return None


class _ChatHistory:
    def __init__(self):
        self.agent_name = "magic"
        self.agent_id = "main"
        self.tool_messages = []

    async def append_tool_message(self, **kwargs):
        self.tool_messages.append(kwargs)


class _AgentContext:
    def __init__(self, chat_history):
        self.chat_history = chat_history
        self.horizon = _Horizon()
        self.pending_id = "call-1"

    def get_user_tool_call_pending_id(self):
        return self.pending_id

    def clear_user_tool_call_pending(self):
        self.pending_id = None


@pytest.mark.asyncio
async def test_cancel_pending_emits_structured_terminal_state(monkeypatch):
    service = UserToolCallService()
    chat_history = _ChatHistory()
    context = _AgentContext(chat_history)
    pending = PendingToolCall(
        tool_call_id="call-1",
        tool_name="ask_user",
        agent_context=context,
        timeout_task=None,
    )
    service._pending = {"call-1": pending}
    captured = {}

    async def capture_after_tool_call(pending, *, content, extra_info):
        captured.update(pending=pending, content=content, extra_info=extra_info)

    async def skip_delete(_agent_context):
        return None

    monkeypatch.setattr(UserToolCallService, "_emit_after_tool_call", staticmethod(capture_after_tool_call))
    monkeypatch.setattr(service, "_delete_pending_file", skip_delete)

    await service.cancel_pending_for_new_message(context)

    assert chat_history.tool_messages == [
        {"content": UserToolCallService.CANCELLED_TOOL_RESULT_CONTENT, "tool_call_id": "call-1"}
    ]
    assert captured["pending"] is pending
    assert captured["extra_info"] == {
        "status": "cancelled",
        "response_status": "cancelled",
        "tool_call_id": "call-1",
    }
