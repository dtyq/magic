import json

import pytest

from app.mcp.config.models import MCPConfigSource, MCPServerConfig, MCPServerType
from app.mcp.store.chat_mcp_store import ChatMcpStore


@pytest.mark.asyncio
async def test_store_persists_credential_reference_without_access_token(tmp_path):
    store = ChatMcpStore(tmp_path / "mcp_servers.json")
    config = MCPServerConfig(
        name="mock-oauth",
        type=MCPServerType.HTTP,
        url="https://mcp.example.test/mcp",
        auth_type=2,
        mcp_server_code="mock-oauth",
    )

    await store.upsert_many([config], MCPConfigSource.CLIENT_CONFIG)

    raw = json.loads((tmp_path / "mcp_servers.json").read_text(encoding="utf-8"))
    persisted = raw["mcpServers"]["mock-oauth"]["config"]
    assert persisted["auth_type"] == 2
    assert persisted["mcp_server_code"] == "mock-oauth"
    assert "token" not in persisted
    assert "Authorization" not in (persisted.get("headers") or {})
