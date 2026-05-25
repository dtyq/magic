from agentlang.config.config import config
from agentlang.logger import get_logger

from app.tools.download_utils.drivers import DRIVERS
from app.tools.download_utils.drivers.base import DownloadDriverInterface

logger = get_logger(__name__)

_instance: DownloadDriverInterface | None = None


def get_download_driver() -> DownloadDriverInterface:
    """
    根据配置选择并返回下载驱动单例实例。

    Returns:
        DownloadDriverInterface: 可用的下载驱动实例

    Raises:
        RuntimeError: 没有可用的下载驱动
    """
    global _instance
    if _instance is not None:
        return _instance

    driver_name = config.get("download.default_engine", default="direct")

    driver_cls = DRIVERS.get(driver_name)
    if driver_cls is None:
        raise RuntimeError(f"未知的下载驱动: '{driver_name}'，可选: {list(DRIVERS.keys())}")

    driver = driver_cls()
    if not driver.is_available():
        raise RuntimeError(f"下载驱动 '{driver_name}' 不可用，请检查相关配置")

    logger.info(f"下载驱动已就绪: {driver_name}")
    _instance = driver
    return _instance
