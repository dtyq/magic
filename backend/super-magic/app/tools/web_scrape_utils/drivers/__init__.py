from .browser import BrowserWebScrapeDriver
from .web_collector import WebCollectorWebScrapeDriver

DRIVERS = {
    "browser": BrowserWebScrapeDriver,
    "web_collector": WebCollectorWebScrapeDriver,
}

__all__ = ["DRIVERS", "BrowserWebScrapeDriver", "WebCollectorWebScrapeDriver"]
