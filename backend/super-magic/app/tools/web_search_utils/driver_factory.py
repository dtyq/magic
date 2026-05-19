from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.web_search_utils.drivers import DRIVERS
from app.tools.web_search_utils.drivers.base import SearchDriverInterface

logger = get_logger(__name__)

_instance: SearchDriverInterface | None = None


def get_search_driver() -> SearchDriverInterface:
    """
    根据配置选择并返回搜索驱动单例实例。

    Returns:
        SearchDriverInterface: 可用的搜索驱动实例

    Raises:
        RuntimeError: 没有可用的搜索驱动
    """
    global _instance
    if _instance is not None:
        return _instance

    driver_name = config.get("web_search.default_engine", default="magic")

    driver_cls = DRIVERS.get(driver_name)
    if driver_cls is None:
        raise RuntimeError(f"未知的搜索驱动: '{driver_name}'，可选: {list(DRIVERS.keys())}")

    driver = driver_cls()
    if not driver.is_available():
        raise RuntimeError(f"搜索驱动 '{driver_name}' 不可用，请检查相关配置")

    logger.info(f"WEB 搜索驱动已就绪: {driver_name}")
    _instance = driver
    return _instance
