import json

from app.mcp.connection.server_manager import MCPServerManager


def test_normalize_content_keeps_valid_json_unchanged():
    content = '{"value": 1}'

    assert MCPServerManager._normalize_content(content) == content


def test_normalize_content_wraps_plain_text_and_empty_content():
    assert json.loads(MCPServerManager._normalize_content("plain text")) == {
        "content": "plain text"
    }
    assert json.loads(MCPServerManager._normalize_content("")) == {"content": ""}


def test_parse_tool_result_wraps_non_json_mcp_text():
    raw = {"content": [{"type": "text", "text": "plain text"}]}

    result = MCPServerManager()._parse_tool_result(raw)

    assert result.ok is True
    assert json.loads(result.content) == {"content": "plain text"}


def test_parse_tool_result_keeps_json_mcp_text():
    raw = {"content": [{"type": "text", "text": '{"value": 1}'}]}

    result = MCPServerManager()._parse_tool_result(raw)

    assert result.content == '{"value": 1}'


def test_parse_tool_result_wraps_empty_and_raw_text_results():
    manager = MCPServerManager()

    assert json.loads(manager._parse_tool_result({"content": []}).content) == {
        "content": ""
    }
    assert json.loads(manager._parse_tool_result("plain text").content) == {
        "content": "plain text"
    }


def test_parse_tool_result_preserves_non_text_content():
    result = MCPServerManager()._parse_tool_result(
        {"content": [{"type": "image", "data": "encoded"}]}
    )

    assert json.loads(result.content) == {
        "content": [{"type": "image", "data": "encoded"}]
    }
