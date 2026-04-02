import json
from unittest.mock import patch

from sdk.tool import ToolSDK


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_tool_sdk_uses_default_timeout_when_not_provided():
    sdk = ToolSDK()
    recorded = {}

    def _fake_urlopen(req, timeout):
        recorded["timeout"] = timeout
        return _FakeResponse(
            {
                "code": 1000,
                "data": {
                    "ok": True,
                    "content": "ok",
                    "tool_call_id": "call_123",
                    "name": "generate_video",
                },
            }
        )

    with patch("sdk.tool.urllib.request.urlopen", side_effect=_fake_urlopen):
        result = sdk.call("generate_video", {"prompt": "demo"})

    assert result.ok is True
    assert recorded["timeout"] == 3600.0


def test_tool_sdk_keeps_non_video_default_timeout_when_not_provided():
    sdk = ToolSDK()
    recorded = {}

    def _fake_urlopen(req, timeout):
        recorded["timeout"] = timeout
        return _FakeResponse(
            {
                "code": 1000,
                "data": {
                    "ok": True,
                    "content": "ok",
                    "tool_call_id": "call_123",
                    "name": "create_design_project",
                },
            }
        )

    with patch("sdk.tool.urllib.request.urlopen", side_effect=_fake_urlopen):
        result = sdk.call("create_design_project", {"project_path": "demo"})

    assert result.ok is True
    assert recorded["timeout"] == 60.0


def test_tool_sdk_uses_explicit_timeout_when_provided():
    sdk = ToolSDK()
    recorded = {}

    def _fake_urlopen(req, timeout):
        recorded["timeout"] = timeout
        return _FakeResponse(
            {
                "code": 1000,
                "data": {
                    "ok": True,
                    "content": "ok",
                    "tool_call_id": "call_123",
                    "name": "generate_video",
                },
            }
        )

    with patch("sdk.tool.urllib.request.urlopen", side_effect=_fake_urlopen):
        result = sdk.call("generate_video", {"prompt": "demo"}, timeout=3600)

    assert result.ok is True
    assert recorded["timeout"] == 3600
