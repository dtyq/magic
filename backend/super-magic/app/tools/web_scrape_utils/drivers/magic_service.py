import os

import httpx

from agentlang.config.config import config
from agentlang.logger import get_logger
from agentlang.utils.metadata import MetadataUtil
from app.tools.web_scrape_utils.drivers.base import WebScrapeDriverInterface, WebScrapeResultItem

logger = get_logger(__name__)


class MagicServiceWebScrapeDriver(WebScrapeDriverInterface):
    """Magic Service 网页抓取驱动（仅作为内部降级使用，不对外注册）"""

    def __init__(self):
        self.api_key = os.getenv("MAGIC_API_KEY", "")
        base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL", "")
        self.endpoint = f"{base_url.rstrip('/')}/v2/web-scrape" if base_url else ""
        self.timeout = config.get("web_scraping.search_api.timeout", 30)
        self.mode = config.get("web_scraping.search_api.mode", "quality")

    def is_available(self) -> bool:
        return bool(self.api_key and self.endpoint)

    async def scrape(self, url: str) -> WebScrapeResultItem:
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
        }
        extra_headers = MetadataUtil.get_llm_request_headers()
        if extra_headers:
            headers.update(extra_headers)
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.endpoint,
                headers=headers,
                json={
                    "url": url,
                    "formats": ["MARKDOWN"],
                    "mode": self.mode,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            response_data = response.json()

            if not response_data.get("success"):
                raise ValueError(f"API 返回失败: {response_data.get('message', '未知错误')}")

            if "data" not in response_data or "content" not in response_data["data"]:
                raise ValueError("API 响应格式无效：缺少 data.content 字段")

            content = response_data["data"]["content"]

            if "markdown" not in content:
                raise ValueError("API 响应缺少必需的 'markdown' 字段")

            return WebScrapeResultItem(
                markdown=content.get("markdown", ""),
                site_name=content.get("site_name", ""),
                logo=content.get("logo"),
                image_list=content.get("image_list", []),
                usage=content.get("usage", {}),
            )

    async def fallback_scrape(self, url: str) -> WebScrapeResultItem:
        """Magic Service 本身即为最终兜底，无更下层降级"""
        raise RuntimeError("Magic Service 已是最终降级方案，无法继续降级")
