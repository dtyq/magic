from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.web_scrape_utils.drivers import DRIVERS
from app.tools.web_scrape_utils.drivers.base import WebScrapeDriverInterface

logger = get_logger(__name__)

_instance: WebScrapeDriverInterface | None = None


def get_web_scrape_driver() -> WebScrapeDriverInterface:
    """
    根据配置选择并返回网页抓取驱动单例实例。

    Returns:
        WebScrapeDriverInterface: 可用的网页抓取驱动实例

    Raises:
        RuntimeError: 没有可用的网页抓取驱动
    """
    global _instance
    if _instance is not None:
        return _instance

    driver_name = config.get("web_scrape.default_engine", default="browser")

    driver_cls = DRIVERS.get(driver_name)
    if driver_cls is None:
        raise RuntimeError(f"未知的网页抓取驱动: '{driver_name}'，可选: {list(DRIVERS.keys())}")

    driver = driver_cls()
    if not driver.is_available():
        raise RuntimeError(f"网页抓取驱动 '{driver_name}' 不可用，请检查相关配置")

    logger.info(f"网页抓取驱动已就绪: {driver_name}")
    _instance = driver
    return _instance
