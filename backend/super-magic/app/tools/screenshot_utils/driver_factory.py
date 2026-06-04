from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.screenshot_utils.drivers import DRIVERS
from app.tools.screenshot_utils.drivers.base import ScreenshotDriverInterface

logger = get_logger(__name__)

_instance: ScreenshotDriverInterface | None = None


def get_screenshot_driver() -> ScreenshotDriverInterface:
    """
    根据配置选择并返回截图驱动单例实例。

    Returns:
        ScreenshotDriverInterface: 可用的截图驱动实例

    Raises:
        RuntimeError: 没有可用的截图驱动
    """
    global _instance
    if _instance is not None:
        return _instance

    driver_name = config.get("screenshot.default_engine", default="browser")

    driver_cls = DRIVERS.get(driver_name)
    if driver_cls is None:
        raise RuntimeError(f"未知的截图驱动: '{driver_name}'，可选: {list(DRIVERS.keys())}")

    driver = driver_cls()
    if not driver.is_available():
        raise RuntimeError(f"截图驱动 '{driver_name}' 不可用，请检查相关配置")

    logger.info(f"截图驱动已就绪: {driver_name}")
    _instance = driver
    return _instance
