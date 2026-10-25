"""第三方用户 ID 的服务解析、工具和模型上下文契约。"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from agentlang.context.tool_context import ToolContext
from app.core.context.agent_context import AgentContext
from app.core.entity.message.client_message import User
from app.core.entity.user_context import UserContext, UserContextSnapshot, UserProfile
from app.core.horizon.profile_context import render_user_context
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.infrastructure.sdk.magic_service.result.get_user_info_result import GetUserInfoResult
from app.service.user_context_service import UserContextService
from app.tools.get_user_info import GetUserInfo, GetUserInfoParams


def mock_response(third_platform_id="00123"):
    """构造纯合成的资料响应，不使用真实身份或服务。"""
    return {
        "captured_at": "2026-10-15T00:00:00+00:00",
        "user": {"id": "mock-user", "magic_id": "mock-account", "third_platform_id": third_platform_id, "phone": "00000000000"},
        "organization": {"code": "mock-org", "name": "Mock organization"},
        "subscription": {"status": "unsupported"},
        "points": {"status": "unsupported"},
    }


@pytest.mark.parametrize("source_id", ["00123", "0", "", None])
def test_both_models_preserve_identity_strings(source_id):
    """两个模型都保留字符串原值，仅将 null 转为空值。"""
    data = mock_response(source_id)["user"]
    assert UserProfile.model_validate(data).third_platform_id == (source_id or "")
    assert User.model_validate(data).model_dump()["third_platform_id"] == (source_id or "")


@pytest.mark.parametrize("invalid", [0, True, [], {}])
@pytest.mark.parametrize("model", [User, UserProfile])
def test_invalid_identity_does_not_become_a_string(model, invalid):
    """避免把数字、布尔或结构数据悄悄转为身份字符串。"""
    with pytest.raises(ValidationError):
        model.model_validate(mock_response(invalid)["user"])


def test_legacy_response_defaults_to_unknown():
    """旧服务缺键时，新模型仍可解析。"""
    data = mock_response()
    del data["user"]["third_platform_id"]
    assert UserContext.model_validate(data).user.third_platform_id == ""
    assert User.model_validate(data["user"]).third_platform_id == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("source_id", ["00123", "0", ""])
async def test_tool_returns_service_identity_in_content_and_data(monkeypatch, source_id):
    """实际执行工具，只有远程查询和快照存储使用 Mock。"""
    profile = GetUserInfoResult(mock_response(source_id)).user_context
    context = MagicMock(spec=AgentContext)
    context.get_user_context_auth.return_value = MagicServiceAuthConfig("mock-user", "mock-org", "mock-authorization")
    fetch = AsyncMock(return_value=profile)
    remember = AsyncMock()
    monkeypatch.setattr(UserContextService, "fetch", fetch)
    monkeypatch.setattr(UserContextService, "remember_result", remember)
    tool_context = ToolContext()
    tool_context.register_extension("agent_context", context)

    result = await GetUserInfo().execute(tool_context, GetUserInfoParams())

    assert result.ok
    assert result.data["third_platform_id"] == source_id
    assert f"Third-party user ID: {source_id or 'not available'}." in result.content
    assert result.data["phone"] == "000****0000"
    assert result.data["id"] == "mock-user"
    fetch.assert_awaited_once_with(context, ())
    assert remember.await_args.args[1].user.third_platform_id == source_id


def test_horizon_reports_identity_change_and_clear():
    """身份被清空后，模型明确收到不可用状态而非继续沿用旧 ID。"""
    now = datetime.now(timezone.utc)
    baseline = UserContextSnapshot(user_id="mock-user", organization_code="mock-org", context=UserContext.model_validate(mock_response()), status="available", attempted_at=now)
    current = baseline.model_copy(update={"context": UserContext.model_validate(mock_response("mock-new-origin"))})
    assert "Third-party user ID: mock-new-origin." in render_user_context(current, baseline)
    cleared = baseline.model_copy(update={"context": UserContext.model_validate(mock_response(""))})
    text = render_user_context(cleared, baseline)
    assert "Third-party user ID: not available." in text
    assert "third_platform_id" in text
    assert "00123" not in text
