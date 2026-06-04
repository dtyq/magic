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


class TavilySearchDriver(SearchDriverInterface):
    """Tavily 搜索驱动"""

    def __init__(self):
        self.api_key = config.get("tavily.api_key", "")
        self.api_endpoint = config.get("tavily.api_endpoint", "https://api.tavily.com")
        self.search_endpoint = config.get("tavily.search_endpoint", "/search")
        self.search_url = f"{self.api_endpoint}{self.search_endpoint}"

    def is_available(self) -> bool:
        return bool(self.api_key and self.api_endpoint)

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
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置请求数据
        search_kwargs = {}
        if time_period:
            days_map = {"day": 1, "week": 7, "month": 30}
            if time_period in days_map:
                search_kwargs["days"] = days_map[time_period]

        data = {
            "query": query,
            "max_results": limit + offset,  # 获取更多结果以支持 offset
            "include_answer": True,
            "search_depth": "basic",
            **search_kwargs,
        }

        logger.info(
            f"[TavilySearchDriver] request POST {self.search_url} "
            f"json={to_log_text(data)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.search_url, headers=headers, json=data) as response:
                    logger.info(f"[TavilySearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[TavilySearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Tavily Search API 请求失败: {response.status} {error_detail}")
                        return []

                    response_data = await response.json()
                    logger.info(f"[TavilySearchDriver] response body={to_log_text(response_data)}")

            if not response_data or not response_data.get("results"):
                return []

            # 转换结果格式
            formatted_results = []
            for item in response_data["results"]:
                link = item.get("url", "")
                domain = self._extract_domain(link)
                formatted_results.append(SearchResultItem(
                    title=item.get("title", ""),
                    link=link,
                    snippet=item.get("content", ""),
                    domain=domain,
                    icon_url=f"https://{domain}/favicon.ico",
                ))

            # 手动处理 offset
            if offset > 0 and len(formatted_results) > offset:
                formatted_results = formatted_results[offset:offset + limit]
            elif offset > 0:
                formatted_results = []
            else:
                formatted_results = formatted_results[:limit]

            return formatted_results

        except Exception as e:
            logger.error(f"Tavily Search API 请求异常: {e}")
            return []

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            match = re.search(r"https?://([^/]+)", url)
            return match.group(1) if match else url
        except Exception:
            return url
