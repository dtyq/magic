"""MCP mention handler 配置转换测试。"""

from app.service.mention.handlers.mcp_handler import _build_mcp_server_config


def test_build_mcp_server_config_preserves_authorization_reference() -> None:
    """标准 MCP Authorization mention 应保留服务端凭据引用。"""
    result = _build_mcp_server_config(
        "mock-mcp",
        {
            "type": "http",
            "url": "https://mcp.example.invalid/mcp",
            "auth_type": 2,
            "mcp_server_code": "mock-server-code",
        },
    )

    assert result is not None
    assert result["auth_type"] == 2
    assert result["mcp_server_code"] == "mock-server-code"


def test_build_mcp_server_config_rejects_incomplete_authorization_reference() -> None:
    """auth_type=2 缺少 server code 时不能降级为无认证配置。"""
    result = _build_mcp_server_config(
        "mock-mcp",
        {
            "type": "http",
            "url": "https://mcp.example.invalid/mcp",
            "auth_type": 2,
        },
    )

    assert result is None


def test_build_mcp_server_config_keeps_legacy_http_config() -> None:
    """普通 HTTP MCP 配置应保持旧行为。"""
    result = _build_mcp_server_config(
        "mock-mcp",
        {
            "type": "http",
            "url": "https://mcp.example.invalid/mcp",
            "headers": {"X-Mock-Header": "mock-value"},
        },
    )

    assert result == {
        "name": "mock-mcp",
        "type": "http",
        "url": "https://mcp.example.invalid/mcp",
        "headers": {"X-Mock-Header": "mock-value"},
    }
