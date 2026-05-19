from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.web_search_utils.drivers import DRIVERS
from app.tools.web_search_utils.drivers.base import SearchDriverInterface

logger = get_logger(__name__)


def get_search_driver() -> SearchDriverInterface:
    """
    根据配置选择并返回搜索驱动实例。

    优先使用配置指定的驱动，若不可用则按优先级降级。

    Returns:
        SearchDriverInterface: 可用的搜索驱动实例

    Raises:
        RuntimeError: 没有可用的搜索驱动
    """
    driver_name = config.get("web_search.default_engine", default="magic")

    # 尝试使用配置指定的驱动
    driver = _try_create_driver(driver_name)
    if driver is not None:
        logger.info(f"搜索驱动已就绪: {driver_name}")
        return driver

    # 配置的驱动不可用，按优先级尝试其他驱动
    logger.warning(f"配置的搜索驱动 '{driver_name}' 不可用，尝试降级")
    fallback_order = ["magic", "metaso", "tavily", "bing", "web_collector"]

    for fallback_name in fallback_order:
        if fallback_name == driver_name:
            continue
        driver = _try_create_driver(fallback_name)
        if driver is not None:
            logger.info(f"搜索驱动降级为: {fallback_name}")
            return driver

    raise RuntimeError("没有可用的搜索驱动，请检查配置")


def _try_create_driver(name: str) -> SearchDriverInterface | None:
    """尝试创建指定驱动，不可用则返回 None"""
    driver_cls = DRIVERS.get(name)
    if driver_cls is None:
        return None
    driver = driver_cls()
    if not driver.is_available():
        return None
    return driver
