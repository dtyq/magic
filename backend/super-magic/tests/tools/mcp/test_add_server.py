import pytest

from app.tools.mcp.add_server import McpAddServer, McpAddServerParams


class FakeStore:
    def __init__(self):
        self.configs = []

    async def upsert_many(self, configs, source):
        self.configs = configs
        return {}


class FakeManager:
    def __init__(self):
        self.config = None

    async def add_server(self, config):
        self.config = config
        return None


@pytest.mark.asyncio
async def test_mcp_add_server_persists_header_placeholders(monkeypatch):
    store = FakeStore()
    manager = FakeManager()
    monkeypatch.setattr(McpAddServer, "_get_store", staticmethod(lambda: store))
    monkeypatch.setattr(McpAddServer, "_get_manager", staticmethod(lambda: manager))

    result = await McpAddServer().execute(
        None,
        McpAddServerParams(
            name="mock-voucher",
            server_type="http",
            url="https://mcp.example.test/mcp",
            headers={"x-api-key": "${MOCK_VOUCHER_KEY}"},
        ),
    )

    assert result.ok is True
    assert store.configs[0].headers == {"x-api-key": "${MOCK_VOUCHER_KEY}"}
    assert manager.config.headers == {"x-api-key": "${MOCK_VOUCHER_KEY}"}
