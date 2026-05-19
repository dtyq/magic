import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.web_scrape_utils.drivers.base import WebScrapeDriverInterface, WebScrapeResultItem

logger = get_logger(__name__)


class WebCollectorWebScrapeDriver(WebScrapeDriverInterface):
    """Web Collector 网页抓取驱动（调用独立的 web-collector 服务）"""

    def __init__(self):
        self.base_url = config.get("web_collector.base_url", "")
        self.timeout = config.get("web_scraping.search_api.timeout", 30)
        self.mode = config.get("web_scraping.search_api.mode", "quality")

    def is_available(self) -> bool:
        return bool(self.base_url)

    async def scrape(self, url: str) -> WebScrapeResultItem:
        """抓取网页内容（使用 web-collector 配置的默认驱动链）"""
        return await self._do_scrape(url)

    async def fallback_scrape(self, url: str) -> WebScrapeResultItem:
        """降级抓取：指定 magic_service 驱动重新获取"""
        if not self.is_available():
            raise RuntimeError("降级抓取不可用: web-collector 未配置")
        return await self._do_scrape(url, driver="magic_service")

    async def _do_scrape(self, url: str, driver: str = None) -> WebScrapeResultItem:
        """实际抓取逻辑

        Args:
            url: 目标网页 URL
            driver: 指定 web-collector 使用的驱动名称（如 'playwright'、'magic_service'）。
                    不指定则使用 web-collector 配置的默认驱动链。
        """
        scrape_url = f"{self.base_url.rstrip('/')}/v2/web-scrape"

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload = {
            "url": url,
            "formats": ["MARKDOWN"],
            "mode": self.mode,
        }

        if driver:
            payload["driver"] = driver

        async with aiohttp.ClientSession() as session:
            async with session.post(scrape_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=self.timeout)) as response:
                if response.status != 200:
                    error_detail = await response.text()
                    raise ValueError(f"Web Collector Scrape 请求失败: {response.status} {error_detail}")

                response_data = await response.json()

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
