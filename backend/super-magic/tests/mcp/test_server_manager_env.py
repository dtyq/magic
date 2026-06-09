import pytest

from app.mcp.config.models import MCPServerConfig
from app.mcp.connection import server_manager as server_manager_module
from app.mcp.connection.server_manager import MCPServerManager


@pytest.fixture()
def isolated_env_paths(tmp_path, monkeypatch):
    from app.mcp.config import env_resolver

    personal_env = tmp_path / "personal.env"

    monkeypatch.setattr(env_resolver.PathManager, "get_personal_env_file", lambda: personal_env)
    monkeypatch.setattr(env_resolver.PathManager, "get_process_env_paths", lambda: [personal_env])
    return personal_env


@pytest.mark.asyncio
async def test_connect_fails_without_constructing_client_when_env_missing(isolated_env_paths, monkeypatch):
    monkeypatch.delenv("MOCK_AMAP_KEY", raising=False)
    constructed = False

    class FakeClient:
        def __init__(self, *args, **kwargs):
            nonlocal constructed
            constructed = True

    monkeypatch.setattr(server_manager_module, "MCPClient", FakeClient)
    manager = MCPServerManager()
    manager.server_configs["mock-amap"] = MCPServerConfig(
        name="mock-amap",
        type="http",
        url="https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}",
    )

    result = await manager.ensure_server_connected("mock-amap")

    assert result.status == "failed"
    assert result.error == "Missing environment variable(s): MOCK_AMAP_KEY"
    assert constructed is False


@pytest.mark.asyncio
async def test_connect_uses_resolved_config_and_keeps_template(isolated_env_paths, monkeypatch):
    monkeypatch.setenv("MOCK_AMAP_KEY", "mock-url-secret")
    monkeypatch.setenv("MOCK_HEADER_KEY", "mock-header-secret")
    captured = {}

    class FakeClient:
        def __init__(self, config, max_retries=1, retry_delay=1.0):
            captured["config"] = config
            self.config = config
            self.last_error = None

        async def connect(self):
            return True

        async def list_tools(self):
            return [
                {
                    "name": "mock_search",
                    "description": "Mock search",
                    "inputSchema": {"type": "object"},
                }
            ]

        async def disconnect(self):
            pass

    template = MCPServerConfig(
        name="mock-amap",
        type="http",
        url="https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}",
        headers={"x-api-key": "${MOCK_HEADER_KEY}"},
    )
    monkeypatch.setattr(server_manager_module, "MCPClient", FakeClient)
    manager = MCPServerManager()
    manager.server_configs["mock-amap"] = template

    result = await manager.ensure_server_connected("mock-amap")

    assert result.status == "success"
    assert result.tools == ["mock_search"]
    assert captured["config"].url == "https://mcp.example.test/sse?key=mock-url-secret"
    assert captured["config"].headers == {"x-api-key": "mock-header-secret"}
    assert manager.server_configs["mock-amap"].url == "https://mcp.example.test/sse?key=${MOCK_AMAP_KEY}"
    assert manager.server_configs["mock-amap"].headers == {"x-api-key": "${MOCK_HEADER_KEY}"}
