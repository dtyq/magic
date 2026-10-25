"""验证 HTTP 订阅的 Unicode 编码、开关与失败发送边界。"""

import json
from unittest.mock import AsyncMock, Mock

import pytest
from agentlang.utils.shadow_code import ShadowCode

from app.core.config.communication_config import MessageSubscriptionConfig
from app.core.stream.http_subscription_stream import HTTPSubscriptionStream


@pytest.fixture
def stream():
    """使用占位端点构造订阅流，测试不建立网络连接。"""
    return HTTPSubscriptionStream(MessageSubscriptionConfig(method="POST", url="https://mock.invalid/messages"))


@pytest.mark.parametrize("setting", [None, "true", "false"])
def test_subscription_envelope_round_trip(stream, monkeypatch, setting):
    """默认混淆与关闭混淆都保持嵌套业务内容。"""
    monkeypatch.delenv("HTTP_SUBSCRIPTION_OBFUSCATED", raising=False)
    if setting is not None:
        monkeypatch.setenv("HTTP_SUBSCRIPTION_OBFUSCATED", setting)
    expected = {"payload": {"content": "저는 매직\u1000\U00020000", "키": ["전반"]}}
    data = json.dumps(expected, ensure_ascii=False)

    envelope = json.loads(stream._prepare_request_data(data))

    assert envelope["obfuscated"] is (setting != "false")
    decoded = ShadowCode.unshadow(envelope["data"]) if envelope["obfuscated"] else envelope["data"]
    assert json.loads(decoded) == expected
    if setting == "false":
        assert envelope["data"] == data


def test_disabled_obfuscation_preserves_unwrapped_data(stream):
    """配置禁用混淆时保留原有不包装契约。"""
    stream._config.enable_obfuscation = False
    data = '{ "content": "저" }'

    assert stream._prepare_request_data(data) == data


@pytest.mark.asyncio
@pytest.mark.parametrize("failure_stage", ["encoding", "envelope"])
async def test_preparation_failure_does_not_send_plaintext(stream, monkeypatch, failure_stage):
    """编码或包装失败必须对外报错，不能发送原文或泄漏异常中的内容。"""
    monkeypatch.setenv("HTTP_SUBSCRIPTION_OBFUSCATED", "true")
    stream._ensure_session = AsyncMock()
    stream._send_request_with_retry = AsyncMock()
    failure = Mock(side_effect=ValueError("mock-sensitive-content"))
    if failure_stage == "encoding":
        monkeypatch.setattr(ShadowCode, "shadow_json", failure)
    else:
        monkeypatch.setattr(stream, "_obfuscate_data", Mock(return_value="SHADOWED_mock"))
        monkeypatch.setattr("app.core.stream.http_subscription_stream.json.dumps", failure)

    with pytest.raises(IOError) as error:
        await stream.write('{"content":"저"}')

    assert "mock-sensitive-content" not in str(error.value)
    stream._send_request_with_retry.assert_not_awaited()


@pytest.mark.asyncio
async def test_write_sends_safe_envelope_without_real_network(stream, monkeypatch):
    """通过实际 write 路径准备安全载荷，网络与认证均由 Mock 替代。"""
    monkeypatch.setenv("HTTP_SUBSCRIPTION_OBFUSCATED", "true")
    stream._ensure_session = AsyncMock()
    stream._build_headers = Mock(return_value={"Content-Type": "application/json"})
    stream._send_request_with_retry = AsyncMock(return_value=(True, Mock(status=200)))
    expected = {"content": "저는 매직\u1000\U00020000"}
    data = json.dumps(expected, ensure_ascii=False)

    assert await stream.write(data) == len(data)

    stream._send_request_with_retry.assert_awaited_once()
    envelope = json.loads(stream._send_request_with_retry.call_args.kwargs["data"])
    assert envelope["obfuscated"] is True
    assert json.loads(ShadowCode.unshadow(envelope["data"])) == expected
