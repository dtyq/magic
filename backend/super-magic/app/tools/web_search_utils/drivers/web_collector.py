import re
from typing import List, Optional

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.web_search_utils.drivers.base import SearchDriverInterface, SearchResultItem

logger = get_logger(__name__)

MAX_RESULTS = 10


class WebCollectorSearchDriver(SearchDriverInterface):
    """Web Collector 搜索驱动（调用独立的 web-collector 服务）"""

    def __init__(self):
        self.base_url = config.get("web_collector.base_url", "")
        self.api_token = config.get("web_collector.api_token", "")

    def is_available(self) -> bool:
        return bool(self.base_url)

    async def search(
        self,
        query: str,
        limit: int = 10,
        offset: int = 0,
        language: str = "zh-CN",
        region: str = "CN",
        time_period: Optional[str] = None,
    ) -> List[SearchResultItem]:
        limit = min(limit, MAX_RESULTS)

        search_url = f"{self.base_url.rstrip('/')}/v2/search"

        params = {
            "q": query,
            "count": limit,
            "offset": offset,
            "setLang": language,
            "mkt": f"{language}-{region}",
        }

        if time_period:
            freshness_map = {"day": "Day", "week": "Week", "month": "Month"}
            if time_period in freshness_map:
                params["freshness"] = freshness_map[time_period]

        headers = {
            "Accept": "application/json",
        }
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        logger.info(
            f"[WebCollectorSearchDriver] request GET {search_url} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(search_url, headers=headers, params=params) as response:
                    logger.info(f"[WebCollectorSearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[WebCollectorSearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Web Collector Search 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()
                    logger.info(f"[WebCollectorSearchDriver] response body={to_log_text(data)}")

                    if "web_pages" not in data or "value" not in data["web_pages"]:
                        return []

                    results = []
                    for item in data["web_pages"]["value"]:
                        link = item.get("url", "")
                        domain = self._extract_domain(link)
                        results.append(SearchResultItem(
                            title=item.get("name", ""),
                            link=link,
                            snippet=item.get("snippet", ""),
                            domain=domain,
                            icon_url=f"https://{domain}/favicon.ico",
                        ))

                    return results[:limit]
        except Exception as e:
            logger.error(f"Web Collector Search 请求异常: {e}")
            return []

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            match = re.search(r"https?://([^/]+)", url)
            return match.group(1) if match else url
        except Exception:
            return url
