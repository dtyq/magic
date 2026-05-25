import re
from typing import List, Optional

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.web_search_utils.drivers.base import SearchDriverInterface, SearchResultItem

logger = get_logger(__name__)

MAX_RESULTS = 10
SAFE_SEARCH_ENABLED = True


class BingSearchDriver(SearchDriverInterface):
    """Bing 搜索驱动"""

    def __init__(self):
        self.api_key = config.get("bing.search_api_key", "")
        self.endpoint = config.get("bing.search_endpoint", "https://api.bing.microsoft.com/v7.0")
        self.search_url = f"{self.endpoint}/search"

    def is_available(self) -> bool:
        return bool(self.api_key and self.endpoint)

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

        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "Accept": "application/json",
            "api-key": self.api_key,
        }

        # 动态设置 metadata 到请求头
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            headers.update(extra_headers)

        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        params = {
            "q": query,
            "count": limit,
            "offset": offset,
            "setLang": language,
            "mkt": f"{language}-{region}",
        }

        if SAFE_SEARCH_ENABLED:
            params["safeSearch"] = "Strict"
        else:
            params["safeSearch"] = "Off"

        if time_period:
            freshness_map = {"day": "Day", "week": "Week", "month": "Month"}
            if time_period in freshness_map:
                params["freshness"] = freshness_map[time_period]

        logger.info(
            f"[BingSearchDriver] request GET {self.search_url} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.search_url, headers=headers, params=params) as response:
                    logger.info(f"[BingSearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[BingSearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Bing Search API 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()
                    logger.info(f"[BingSearchDriver] response body={to_log_text(data)}")

                    if "webPages" not in data or "value" not in data["webPages"]:
                        return []

                    results = []
                    for item in data["webPages"]["value"]:
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
            logger.error(f"Bing Search API 请求异常: {e}")
            return []

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            match = re.search(r"https?://([^/]+)", url)
            return match.group(1) if match else url
        except Exception:
            return url
