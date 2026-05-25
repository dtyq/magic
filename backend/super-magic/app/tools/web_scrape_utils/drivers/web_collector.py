import json

import aiohttp

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.tools.driver_log_utils import redact_headers, to_log_text
from app.tools.web_scrape_utils.drivers.base import WebScrapeDriverInterface, WebScrapeResultItem

logger = get_logger(__name__)


class AccessDeniedException(Exception):
    """访问被拒绝异常，用于白名单拦截等场景，不应降级重试"""
    pass


class WebCollectorWebScrapeDriver(WebScrapeDriverInterface):
    """Web Collector 网页抓取驱动（调用独立的 web-collector 服务）"""

    def __init__(self):
        self.base_url = config.get("web_collector.base_url", "")
        self.api_token = config.get("web_collector.api_token", "")
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
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        payload = {
            "url": url,
            "formats": ["MARKDOWN"],
            "mode": self.mode,
        }

        if driver:
            payload["driver"] = driver

        logger.info(
            f"[WebCollectorWebScrapeDriver] request POST {scrape_url} "
            f"json={to_log_text(payload)} headers={to_log_text(redact_headers(headers))}"
        )

        async with aiohttp.ClientSession() as session:
            async with session.post(scrape_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=self.timeout)) as response:
                logger.info(f"[WebCollectorWebScrapeDriver] response status={response.status}")
                if response.status != 200:
                    error_detail = await response.text()
                    logger.error(
                        f"[WebCollectorWebScrapeDriver] response error status={response.status} "
                        f"body={to_log_text(error_detail)}"
                    )
                    # 解析错误响应，对 ACCESS_DENIED 抛出专用异常
                    try:
                        error_data = json.loads(error_detail)
                        if error_data.get("error_code") == "ACCESS_DENIED":
                            raise AccessDeniedException(error_data.get("error", "当前访问被限制，请联系管理员"))
                    except (json.JSONDecodeError, KeyError):
                        pass
                    raise ValueError(f"Web Collector Scrape 请求失败: {response.status} {error_detail}")

                response_data = await response.json()
                logger.info(f"[WebCollectorWebScrapeDriver] response body={to_log_text(response_data)}")

                if not response_data.get("success"):
                    error_msg = response_data.get("error") or response_data.get("message") or "未知错误"
                    raise ValueError(error_msg)

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
