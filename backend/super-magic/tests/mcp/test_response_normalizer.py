"""MCP 响应标准化契约测试。"""

import json

from app.mcp.connection.response_normalizer import MCPResponseNormalizer


def test_standard_json_rpc_response_is_preserved():
    body = b'{"jsonrpc":"2.0","id":0,"result":{"ok":true}}'

    assert MCPResponseNormalizer().normalize_payload(body, request_id=0) == body


def test_structured_remote_error_becomes_json_rpc_error():
    body = '{"code":4001,"message":"未登录","data":{"token":"secret"}}'.encode()

    normalized = MCPResponseNormalizer().normalize_payload(body, request_id=7, http_status=200)
    payload = json.loads(normalized)

    assert payload["jsonrpc"] == "2.0"
    assert payload["id"] == 7
    assert payload["error"]["code"] == -32000
    assert payload["error"]["message"] == "未登录"
    assert payload["error"]["data"]["remote_code"] == 4001
    assert payload["error"]["data"]["remote_data"]["token"] == "[REDACTED]"
    assert payload["error"]["data"]["http_status"] == 200


def test_invalid_json_becomes_parse_error_without_echoing_too_much():
    normalized = MCPResponseNormalizer().normalize_payload(
        b"<html>bad response</html>",
        request_id=1,
        http_status=200,
        content_type="text/html",
    )
    payload = json.loads(normalized)

    assert payload["id"] == 1
    assert payload["error"]["code"] == -32700
    assert payload["error"]["data"]["content_type"] == "text/html"
    assert payload["error"]["data"]["body_length"] == len(b"<html>bad response</html>")
    assert "body" not in payload["error"]["data"]
