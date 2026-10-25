from app.service.mcp_service import MCPService


def test_parse_mcp_config_preserves_env_placeholders_in_sensitive_fields():
    configs = MCPService._parse_mcp_config(
        {
            "mcpServers": {
                "mock-voucher": {
                    "name": "mock-voucher",
                    "url": "https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}",
                    "headers": {"x-api-key": "${MOCK_VOUCHER_KEY}"},
                    "token": "${MOCK_TOKEN}",
                    "env": {"TOKEN": "${MOCK_STDIO_TOKEN}"},
                }
            }
        }
    )

    assert len(configs) == 1
    assert configs[0].url == "https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}"
    assert configs[0].headers == {"x-api-key": "${MOCK_VOUCHER_KEY}"}
    assert configs[0].token == "${MOCK_TOKEN}"
    assert configs[0].env == {"TOKEN": "${MOCK_STDIO_TOKEN}"}


def test_parse_mcp_config_preserves_oauth_credential_reference():
    configs = MCPService._parse_mcp_config(
        {
            "mcpServers": {
                "mock-oauth": {
                    "url": "https://mcp.example.test/mcp",
                    "auth_type": 2,
                    "mcp_server_code": "mock-oauth",
                }
            }
        }
    )

    assert len(configs) == 1
    assert configs[0].auth_type == 2
    assert configs[0].mcp_server_code == "mock-oauth"
    assert configs[0].headers is None
