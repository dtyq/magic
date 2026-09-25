import json
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from agentlang.logger import get_logger
from app.mcp.config.models import MCPServerConfig, MCPServerType
from app.mcp.connection.client import MCPClient
from app.tools.web_search_utils.drivers.base import SearchDriverInterface, SearchResultItem

logger = get_logger(__name__)

PARALLEL_MCP_URL = "https://search.parallel.ai/mcp"
PARALLEL_SEARCH_TOOL = "web_search"
MAX_RESULTS = 10
MAX_QUERY_LENGTH = 200
MAX_SNIPPET_LENGTH = 1200
_TIME_PERIODS = {
    "day": "past day",
    "week": "past week",
    "month": "past month",
    "year": "past year",
}

try:
    PROJECT_VERSION = version("super-magic")
except PackageNotFoundError:
    PROJECT_VERSION = None

PROJECT_USER_AGENT = f"super-magic/{PROJECT_VERSION}" if PROJECT_VERSION else "super-magic"


class ParallelSearchDriver(SearchDriverInterface):
    """Search through Parallel's anonymous Search MCP endpoint."""

    def is_available(self) -> bool:
        return True

    async def search(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0,
        language: str = "zh-CN",
        region: str = "CN",
        time_period: Optional[str] = None,
    ) -> List[SearchResultItem]:
        query = query.strip()
        if not query:
            raise ValueError("Search query must not be empty")
        if len(query) > MAX_QUERY_LENGTH:
            raise ValueError(f"Search query must be {MAX_QUERY_LENGTH} characters or fewer")
        if offset:
            raise ValueError("Parallel Search MCP does not support offset pagination")
        if limit < 1:
            raise ValueError("Search result limit must be positive")

        objective = self._build_objective(query, language, region, time_period)
        client = MCPClient(self._server_config())
        try:
            if not await client.connect():
                raise RuntimeError(client.last_error or "Parallel Search MCP connection failed")

            tools = await client.list_tools()
            if not any(tool.get("name") == PARALLEL_SEARCH_TOOL for tool in tools):
                raise RuntimeError("Parallel Search MCP does not advertise web_search")

            response = await client.call_tool(
                PARALLEL_SEARCH_TOOL,
                {"objective": objective, "search_queries": [query]},
            )
            if response.get("isError"):
                raise RuntimeError("Parallel Search MCP web_search returned an error")

            payload = self._parse_payload(response.get("content"))
            results = self._map_results(payload, min(limit, MAX_RESULTS))
            warnings = self._read_warnings(payload)
            if warnings:
                warning_text = self._truncate("Parallel Search MCP warning: " + " ".join(warnings))
                if results:
                    results[0].snippet = self._truncate(
                        "\n\n".join(part for part in (warning_text, results[0].snippet) if part)
                    )
                else:
                    logger.warning("%s", warning_text)
            return results
        finally:
            try:
                await client.disconnect()
            except Exception:
                logger.warning("Failed to close Parallel Search MCP connection", exc_info=True)

    @staticmethod
    def _server_config() -> MCPServerConfig:
        # Identify this project so Parallel can measure aggregate Search MCP usage.
        # Keep it project-wide and preserve it across transport refactors.
        headers = {"User-Agent": PROJECT_USER_AGENT}
        return MCPServerConfig(
            name="Parallel Search",
            type=MCPServerType.HTTP,
            url=PARALLEL_MCP_URL,
            headers=headers,
            allowed_tools=[PARALLEL_SEARCH_TOOL],
        )

    @staticmethod
    def _build_objective(
        query: str,
        language: str,
        region: str,
        time_period: Optional[str],
    ) -> str:
        objective = [f"Find useful web search results for: {query}."]
        if language:
            objective.append(f"Prefer results in language {language}.")
        if region:
            objective.append(f"Prefer results relevant to region {region}.")
        if time_period:
            period = _TIME_PERIODS.get(time_period.lower())
            if not period:
                raise ValueError(f"Unsupported time period: {time_period}")
            objective.append(f"Prefer results published within the {period}.")
        return " ".join(objective)

    @staticmethod
    def _parse_payload(content: Any) -> Dict[str, Any]:
        if not isinstance(content, list):
            raise ValueError("Parallel Search MCP returned invalid content")

        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
            else:
                text = getattr(block, "text", None)
            if not isinstance(text, str):
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict) and "results" in payload:
                return payload

        raise ValueError("Parallel Search MCP returned no valid search payload")

    @classmethod
    def _map_results(cls, payload: Dict[str, Any], limit: int) -> List[SearchResultItem]:
        raw_results = payload.get("results")
        if not isinstance(raw_results, list):
            raise ValueError("Parallel Search MCP returned an invalid results list")

        mapped = []
        for item in raw_results[:limit]:
            if not isinstance(item, dict):
                raise ValueError("Parallel Search MCP returned an invalid result")

            url = item.get("url")
            parsed_url = urlparse(url) if isinstance(url, str) else None
            if not parsed_url or parsed_url.scheme not in ("http", "https") or not parsed_url.netloc:
                raise ValueError("Parallel Search MCP returned a result without a valid HTTP URL")

            title = item.get("title")
            if title is not None and not isinstance(title, str):
                raise ValueError("Parallel Search MCP returned an invalid result title")
            title = title.strip() if title else url

            excerpts = item.get("excerpts")
            if not isinstance(excerpts, list) or any(not isinstance(excerpt, str) for excerpt in excerpts):
                raise ValueError("Parallel Search MCP returned invalid result excerpts")
            snippet_parts = [excerpt.strip() for excerpt in excerpts if excerpt.strip()]

            publish_date = item.get("publish_date")
            if publish_date is not None:
                if not isinstance(publish_date, str):
                    raise ValueError("Parallel Search MCP returned an invalid publish date")
                if publish_date.strip():
                    snippet_parts.insert(0, f"Published: {publish_date.strip()}")

            domain = parsed_url.hostname or ""
            mapped.append(
                SearchResultItem(
                    title=title or url,
                    link=url,
                    snippet=cls._truncate("\n".join(snippet_parts)),
                    domain=domain,
                    icon_url=f"https://{domain}/favicon.ico" if domain else "",
                )
            )
        return mapped

    @staticmethod
    def _read_warnings(payload: Dict[str, Any]) -> List[str]:
        warnings = payload.get("warnings")
        if warnings is None:
            return []
        if not isinstance(warnings, list) or any(not isinstance(warning, str) for warning in warnings):
            raise ValueError("Parallel Search MCP returned invalid warnings")
        return [warning.strip() for warning in warnings if warning.strip()]

    @staticmethod
    def _truncate(text: str) -> str:
        if len(text) <= MAX_SNIPPET_LENGTH:
            return text
        return text[: MAX_SNIPPET_LENGTH - 3].rstrip() + "..."
