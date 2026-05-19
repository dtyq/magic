from agentlang.logger import get_logger
from app.tools.driver_log_utils import to_log_text
from magic_use.magic_browser import MagicBrowser
from app.tools.webview_utils import goto_external_website_with_referer
from app.tools.web_scrape_utils.drivers.base import WebScrapeDriverInterface, WebScrapeResultItem

logger = get_logger(__name__)


class BrowserWebScrapeDriver(WebScrapeDriverInterface):
    """浏览器抓取驱动

    使用无头浏览器抓取网页内容。降级方案通过 web-collector 的 magic_service 驱动实现。
    """

    def is_available(self) -> bool:
        return True

    async def scrape(self, url: str) -> WebScrapeResultItem:
        """使用浏览器抓取网页"""
        logger.info(f"[BrowserWebScrapeDriver] request scrape url={to_log_text(url)}")
        browser = await MagicBrowser.create_for_scraping()
        try:
            # 导航
            goto_result = await goto_external_website_with_referer(browser, url, None)
            if not goto_result.success:
                raise RuntimeError(f"导航失败: {goto_result.error}")

            # 获取页面 ID
            page_id = await browser.get_active_page_id()
            if not page_id:
                raise RuntimeError("获取页面ID失败")

            # 读取内容
            read_result = await browser.read_as_markdown(page_id, scope="all")
            if not read_result.success:
                raise RuntimeError(f"读取页面内容失败: {read_result.error}")

            logger.info(
                "[BrowserWebScrapeDriver] response "
                f"title={to_log_text(read_result.title or '')} "
                f"markdown={to_log_text(read_result.markdown or '')}"
            )

            return WebScrapeResultItem(
                markdown=read_result.markdown or "",
                site_name=read_result.title or "",
            )
        finally:
            try:
                await browser.close()
            except Exception as e:
                logger.debug(f"关闭浏览器实例出错: {e}")

    async def fallback_scrape(self, url: str) -> WebScrapeResultItem:
        """降级抓取：通过 magic-service API 重新获取"""
        from app.tools.web_scrape_utils.drivers.magic_service import MagicServiceWebScrapeDriver

        fallback = MagicServiceWebScrapeDriver()
        if not fallback.is_available():
            raise RuntimeError("降级抓取不可用: MAGIC_API_KEY 或 MAGIC_API_SERVICE_BASE_URL 未配置")
        return await fallback.scrape(url)
