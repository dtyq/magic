from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.image_search_utils.drivers import DRIVERS
from app.tools.image_search_utils.drivers.base import ImageSearchDriverInterface

logger = get_logger(__name__)

_instance: ImageSearchDriverInterface | None = None


def get_image_search_driver() -> ImageSearchDriverInterface:
    """
    根据配置选择并返回图片搜索驱动单例实例。

    Returns:
        ImageSearchDriverInterface: 可用的图片搜索驱动实例

    Raises:
        RuntimeError: 没有可用的图片搜索驱动
    """
    global _instance
    if _instance is not None:
        return _instance

    driver_name = config.get("image_search.default_engine", default="magic")

    driver_cls = DRIVERS.get(driver_name)
    if driver_cls is None:
        raise RuntimeError(f"未知的图片搜索驱动: '{driver_name}'，可选: {list(DRIVERS.keys())}")

    driver = driver_cls()
    if not driver.is_available():
        raise RuntimeError(f"图片搜索驱动 '{driver_name}' 不可用，请检查相关配置")

    logger.info(f"图片搜索驱动已就绪: {driver_name}")
    _instance = driver
    return _instance
