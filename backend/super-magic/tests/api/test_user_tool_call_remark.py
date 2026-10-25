import asyncio

import pytest

from app.api.handlers.user_tool_call import UserToolCallPayload, dispatch
from app.api.http_dto.response import ResponseCode


class _Pending:
    def cancel_timeout(self):
        pass


class _Service:
    def __init__(self):
        self.calls = []
        self.pending = _Pending()

    async def pop_pending_or_restore_from_latest_history(self, **kwargs):
        return self.pending

    async def resume_after_user_tool_call(self, **kwargs):
        self.calls.append(kwargs)


@pytest.mark.asyncio
async def test_dispatch_normalizes_and_forwards_remark(monkeypatch):
    service = _Service()
    monkeypatch.setattr(
        "app.service.user_tool_call_service.UserToolCallService.get_instance",
        classmethod(lambda cls: service),
    )

    created = []

    original_create_task = asyncio.create_task

    def create_task(coro, *, name=None):
        created.append((coro, name))
        return original_create_task(coro)

    monkeypatch.setattr("app.api.handlers.user_tool_call.asyncio.create_task", create_task)

    response = await dispatch(
        UserToolCallPayload(
            name="ask_user",
            tool_call_id="call_mock",
            detail={
                "response_status": "answered",
                "answer": '{"q-0":"4"}',
                "remark": "  本次补充  ",
            },
        )
    )

    assert response.code == ResponseCode.SUCCESS
    assert len(created) == 1
    await asyncio.sleep(0)
    assert service.calls == [
        {
            "pending": service.pending,
            "response_status": "answered",
            "answer": '{"q-0":"4"}',
            "remark": "本次补充",
        }
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("remark", [None, 123, "   "])
async def test_dispatch_treats_invalid_remark_as_empty(monkeypatch, remark):
    service = _Service()
    monkeypatch.setattr(
        "app.service.user_tool_call_service.UserToolCallService.get_instance",
        classmethod(lambda cls: service),
    )

    original_create_task = asyncio.create_task

    def run(coro, *, name=None):
        return original_create_task(coro)

    monkeypatch.setattr("app.api.handlers.user_tool_call.asyncio.create_task", run)

    response = await dispatch(
        UserToolCallPayload(
            name="ask_user",
            tool_call_id="call_mock",
            detail={"answer": "{}", "remark": remark},
        )
    )

    assert response.code == ResponseCode.SUCCESS
    await asyncio.sleep(0)
    assert service.calls[0]["remark"] == ""
