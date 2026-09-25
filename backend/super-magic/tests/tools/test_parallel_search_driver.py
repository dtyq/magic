import json
from types import SimpleNamespace

import httpx
import pytest

from app.mcp.config.models import MCPServerConfig, MCPServerType
from app.mcp.connection.client import MCPClient, _mcp_http_client_factory_with_error_body
from app.tools import web_search as web_search_module
from app.tools.web_search import WebSearch, WebSearchParams
from app.tools.web_search_utils import driver_factory
from app.tools.web_search_utils.drivers import MagicServiceSearchDriver, ParallelSearchDriver, TavilySearchDriver
from app.tools.web_search_utils.drivers import parallel as parallel_module


def _tool_response(payload):
    return {
        "isError": False,
        "content": [SimpleNamespace(text=json.dumps(payload))],
    }


@pytest.fixture
def fake_mcp_client(monkeypatch):
    class FakeMCPClient:
        instances = []
        response = _tool_response({"results": []})
        tools = [{"name": "web_search"}]
        connect_result = True
        disconnect_error = False

        def __init__(self, config):
            self.config = config
            self.last_error = None
            self.listed_tools = False
            self.called_tool = None
            self.arguments = None
            self.disconnected = False
            self.instances.append(self)

        async def connect(self):
            return self.connect_result

        async def list_tools(self):
            self.listed_tools = True
            return self.tools

        async def call_tool(self, name, arguments):
            self.called_tool = name
            self.arguments = arguments
            return self.response

        async def disconnect(self):
            self.disconnected = True
            if self.disconnect_error:
                raise RuntimeError("cleanup failed")

    monkeypatch.setattr(parallel_module, "MCPClient", FakeMCPClient)
    return FakeMCPClient


@pytest.mark.asyncio
async def test_parallel_search_maps_sources_and_uses_keyless_project_client(fake_mcp_client, monkeypatch):
    monkeypatch.delenv("PARALLEL_API_KEY", raising=False)
    fake_mcp_client.response = _tool_response(
        {
            "results": [
                {
                    "url": "https://docs.python.org/",
                    "title": "Python documentation",
                    "publish_date": "2025-01-01",
                    "excerpts": ["Official documentation excerpt."],
                },
                {
                    "url": "https://www.python.org/",
                    "title": None,
                    "publish_date": None,
                    "excerpts": ["Python home page."],
                },
                {
                    "url": "https://example.org/",
                    "title": "Ignored beyond the requested limit",
                    "publish_date": None,
                    "excerpts": ["Not returned."],
                },
            ],
            "warnings": ["One search query was adjusted."],
        }
    )

    results = await ParallelSearchDriver().search(
        "official Python documentation",
        limit=2,
        language="en-US",
        region="US",
        time_period="week",
    )

    client = fake_mcp_client.instances[0]
    assert client.config.url == "https://search.parallel.ai/mcp"
    assert client.config.token is None
    assert client.config.allowed_tools == ["web_search"]
    assert client.config.headers == {"User-Agent": parallel_module.PROJECT_USER_AGENT}
    assert client.listed_tools
    assert client.called_tool == "web_search"
    assert client.arguments["search_queries"] == ["official Python documentation"]
    assert "Prefer results in language en-US." in client.arguments["objective"]
    assert "Prefer results relevant to region US." in client.arguments["objective"]
    assert "within the past week." in client.arguments["objective"]
    assert len(client.arguments) == 2
    assert client.disconnected
    assert len(results) == 2
    assert results[0].title == "Python documentation"
    assert results[0].link == "https://docs.python.org/"
    assert results[0].domain == "docs.python.org"
    assert "Published: 2025-01-01" in results[0].snippet
    assert "Official documentation excerpt." in results[0].snippet
    assert "One search query was adjusted." in results[0].snippet
    assert results[1].title == "https://www.python.org/"


@pytest.mark.asyncio
async def test_parallel_request_preserves_project_attribution_and_existing_mcp_auth(monkeypatch):
    captured_requests = []

    def capture_request(request):
        captured_requests.append(request)
        return httpx.Response(200, json={})

    async_client = httpx.AsyncClient

    def mock_transport_client(**kwargs):
        return async_client(**kwargs, transport=httpx.MockTransport(capture_request), trust_env=False)

    monkeypatch.setattr(httpx, "AsyncClient", mock_transport_client)

    headers = MCPClient(ParallelSearchDriver._server_config())._prepare_headers()
    async with _mcp_http_client_factory_with_error_body(headers=headers) as client:
        await client.post(parallel_module.PARALLEL_MCP_URL, json={})

    assert len(captured_requests) == 1
    assert captured_requests[0].headers["User-Agent"] == parallel_module.PROJECT_USER_AGENT
    assert "Authorization" not in captured_requests[0].headers

    authenticated_config = MCPServerConfig(
        name="Authenticated MCP",
        type=MCPServerType.HTTP,
        url="https://example.org/mcp",
        token="dummy-configured-token",
        headers={"X-Custom-Header": "custom-value"},
    )
    headers = MCPClient(authenticated_config)._prepare_headers()
    async with _mcp_http_client_factory_with_error_body(headers=headers) as client:
        await client.post(authenticated_config.url, json={})

    assert len(captured_requests) == 2
    assert captured_requests[1].headers["Authorization"] == "Bearer dummy-configured-token"
    assert captured_requests[1].headers["X-Custom-Header"] == "custom-value"


def test_search_factory_preserves_magic_default_and_selects_parallel_without_a_key(monkeypatch):
    monkeypatch.delenv("PARALLEL_API_KEY", raising=False)
    monkeypatch.setattr(driver_factory, "_instance", None)
    monkeypatch.setattr(driver_factory.config, "get", lambda _key, default=None: default)
    monkeypatch.setattr(MagicServiceSearchDriver, "is_available", lambda _self: True)
    assert isinstance(driver_factory.get_search_driver(), MagicServiceSearchDriver)

    monkeypatch.setattr(driver_factory, "_instance", None)
    monkeypatch.setattr(driver_factory.config, "get", lambda _key, default=None: "parallel")
    parallel_driver = driver_factory.get_search_driver()
    assert isinstance(parallel_driver, ParallelSearchDriver)
    assert parallel_driver.is_available()

    monkeypatch.setattr(driver_factory, "_instance", None)
    monkeypatch.setattr(TavilySearchDriver, "is_available", lambda _self: True)
    monkeypatch.setattr(driver_factory.config, "get", lambda _key, default=None: "tavily")
    assert isinstance(driver_factory.get_search_driver(), TavilySearchDriver)


@pytest.mark.asyncio
async def test_web_search_uses_parallel_through_the_normal_caller(fake_mcp_client, monkeypatch):
    fake_mcp_client.response = _tool_response(
        {
            "results": [
                {
                    "url": "https://docs.python.org/",
                    "title": "Python documentation",
                    "publish_date": None,
                    "excerpts": ["The official Python documentation."],
                }
            ],
            "warnings": None,
        }
    )
    monkeypatch.setattr(driver_factory, "_instance", None)
    monkeypatch.setattr(driver_factory.config, "get", lambda _key, default=None: "parallel")
    monkeypatch.setattr(web_search_module.random, "uniform", lambda _start, _end: 0)

    tool = WebSearch()
    params = WebSearchParams(
        topic_id="python-docs",
        requirements_xml=(
            "<requirements><requirement><name>Python docs</name>"
            "<query>official Python documentation</query><limit>1</limit>"
            "</requirement></requirements>"
        ),
    )
    result = await tool.execute(None, params)

    assert result.ok
    assert result.data["results"][0]["url"] == "https://docs.python.org/"
    assert result.data["results"][0]["title"] == "Python documentation"
    assert "official Python documentation" in fake_mcp_client.instances[0].arguments["objective"]
    assert fake_mcp_client.instances[0].disconnected


@pytest.mark.asyncio
async def test_parallel_search_raises_on_mcp_tool_error_and_closes_client(fake_mcp_client):
    fake_mcp_client.response = {
        "isError": True,
        "content": [SimpleNamespace(text="The server rejected the search")],
    }

    with pytest.raises(RuntimeError, match="returned an error"):
        await ParallelSearchDriver().search("official Python documentation")

    assert fake_mcp_client.instances[0].disconnected


@pytest.mark.asyncio
async def test_parallel_search_distinguishes_empty_success_from_malformed_payload(fake_mcp_client):
    fake_mcp_client.response = _tool_response({"results": []})
    assert await ParallelSearchDriver().search("official Python documentation") == []

    fake_mcp_client.response = _tool_response({"results": {}})
    with pytest.raises(ValueError, match="invalid results list"):
        await ParallelSearchDriver().search("official Python documentation")

    fake_mcp_client.response = {
        "isError": False,
        "content": [SimpleNamespace(text="not a JSON search payload")],
    }
    with pytest.raises(ValueError, match="no valid search payload"):
        await ParallelSearchDriver().search("official Python documentation")


@pytest.mark.asyncio
async def test_parallel_search_rejects_offset_before_connecting(fake_mcp_client):
    with pytest.raises(ValueError, match="does not support offset pagination"):
        await ParallelSearchDriver().search("official Python documentation", offset=1)

    assert fake_mcp_client.instances == []


@pytest.mark.asyncio
async def test_parallel_search_cleanup_failure_does_not_hide_results(fake_mcp_client):
    fake_mcp_client.response = _tool_response(
        {
            "results": [
                {
                    "url": "https://docs.python.org/",
                    "title": "Python documentation",
                    "publish_date": None,
                    "excerpts": ["Official docs."],
                }
            ],
            "warnings": None,
        }
    )
    fake_mcp_client.disconnect_error = True

    results = await ParallelSearchDriver().search("official Python documentation")

    assert len(results) == 1
    assert results[0].link == "https://docs.python.org/"
    assert fake_mcp_client.instances[0].disconnected
