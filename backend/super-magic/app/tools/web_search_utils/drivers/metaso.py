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


class MetasoSearchDriver(SearchDriverInterface):
    """Metaso 搜索驱动"""

    def __init__(self):
        self.api_key = config.get("metaso.api_key", "")
        self.api_endpoint = config.get("metaso.api_endpoint", "https://metaso.cn")
        self.search_endpoint = config.get("metaso.search_endpoint", "/api/v1/search")
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

        # 将 offset 转换为页码
        page = (offset // limit) + 1 if limit > 0 else 1

        # 处理时间范围：Metaso 不直接支持，通过在查询中添加时间关键词实现
        search_query = query
        if time_period:
            time_keywords = {
                "day": "今天 最新",
                "week": "本周 近期",
                "month": "本月 最近",
            }
            if time_period in time_keywords:
                search_query = f"{query} {time_keywords[time_period]}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        data = {
            "q": search_query,
            "scope": "webpage",
            "page": str(page),
            "includeSummary": False,
            "includeRawContent": False,
            "conciseSnippet": False,
        }

        logger.info(
            f"[MetasoSearchDriver] request POST {self.search_url} "
            f"json={to_log_text(data)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.search_url, headers=headers, json=data) as response:
                    logger.info(f"[MetasoSearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[MetasoSearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Metaso Search API 请求失败: {response.status} {error_detail}")
                        return []

                    response_data = await response.json()
                    logger.info(f"[MetasoSearchDriver] response body={to_log_text(response_data)}")

            if not response_data or not response_data.get("webpages"):
                return []

            results = []
            for item in response_data["webpages"]:
                link = item.get("link", "")
                domain = self._extract_domain(link)
                results.append(SearchResultItem(
                    title=item.get("title", ""),
                    link=link,
                    snippet=item.get("snippet", ""),
                    domain=domain,
                    icon_url=f"https://{domain}/favicon.ico",
                ))

            return results

        except Exception as e:
            logger.error(f"Metaso Search API 请求异常: {e}")
            return []

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            match = re.search(r"https?://([^/]+)", url)
            return match.group(1) if match else url
        except Exception:
            return url
