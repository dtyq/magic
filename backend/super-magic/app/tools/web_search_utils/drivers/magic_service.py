import os
import re
from typing import List, Optional

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.web_search_utils.drivers.base import SearchDriverInterface, SearchResultItem

logger = get_logger(__name__)

# 搜索结果最大数量
MAX_RESULTS = 10

# 安全搜索配置
SAFE_SEARCH_ENABLED = True


class MagicServiceSearchDriver(SearchDriverInterface):
    """Magic Service 搜索驱动（基于 magic-service 的 /v2/search 接口）"""

    def __init__(self):
        self.api_key = os.getenv("MAGIC_API_KEY", "")
        magic_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL", "")
        self.search_url = f"{magic_base_url}/v2/search" if magic_base_url else ""

    def is_available(self) -> bool:
        return bool(self.api_key and self.search_url)

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

        # 设置请求头
        headers = {
            "api-key": self.api_key,
            "Accept": "application/json",
        }

        # 动态设置最新的 metadata 到请求头
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            headers.update(extra_headers)

        # 添加 Magic-Authorization 认证头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 设置查询参数
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
            f"[MagicServiceSearchDriver] request GET {self.search_url} "
            f"params={to_log_text(params)} headers={to_log_text(redact_headers(headers))}"
        )

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.search_url, headers=headers, params=params) as response:
                    logger.info(f"[MagicServiceSearchDriver] response status={response.status}")
                    if response.status != 200:
                        error_detail = await response.text()
                        logger.error(
                            f"[MagicServiceSearchDriver] response error status={response.status} "
                            f"body={to_log_text(error_detail)}"
                        )
                        logger.error(f"Magic Search API 请求失败: {response.status} {error_detail}")
                        return []

                    data = await response.json()
                    logger.info(f"[MagicServiceSearchDriver] response body={to_log_text(data)}")

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
            logger.error(f"Magic Search API 请求异常: {e}")
            return []

    @staticmethod
    def _extract_domain(url: str) -> str:
        try:
            match = re.search(r"https?://([^/]+)", url)
            return match.group(1) if match else url
        except Exception:
            return url
