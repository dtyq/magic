# agentlang/agentlang/streaming/manager.py
from typing import Optional, List, Any, Dict
from .interface import StreamingInterface
from .exceptions import DriverNotAvailableException
from .driver_types import DriverType
from agentlang.logger import get_logger

logger = get_logger(__name__)


def _create_driver_instance(driver_type: DriverType, config: Optional[Dict[str, Any]] = None) -> Optional[StreamingInterface]:
    """创建指定类型的驱动实例（延迟导入）"""
    if driver_type == DriverType.SOCKETIO:
        try:
            # 延迟导入，只在真正需要时才导入
            from .drivers.socketio.driver import SocketIODriver
            from .drivers.socketio.config import SocketIODriverConfig

            # 创建配置对象
            driver_config = SocketIODriverConfig.create_default()
            if config:
                driver_config.update_from_dict(config)

            return SocketIODriver(driver_config)
        except ImportError as e:
            logger.warning(f"SocketIODriver not available: {e}")
            raise DriverNotAvailableException("socketio", "SocketIODriver not available")

    logger.error(f"Unknown driver type: {driver_type}")
    return None


def create_driver(driver_type: DriverType = DriverType.SOCKETIO,
                  config: Optional[Dict[str, Any]] = None) -> Optional[StreamingInterface]:
    """创建推送驱动实例（工厂方法）

    Args:
        driver_type: 驱动类型，DriverType 枚举
        config: 驱动配置，传递给驱动构造函数

    Returns:
        StreamingInterface实例，如果创建失败则返回None
    """
    # 检查是否支持该驱动类型
    if not DriverType.is_supported(driver_type.value):
        logger.warning(f"Unsupported driver type: {driver_type}")
        return None

    # 创建驱动
    try:
        driver = _create_driver_instance(driver_type, config)
        if driver:
            logger.debug(f"Created streaming driver: {driver_type}")
            return driver
    except DriverNotAvailableException:
        # DriverNotAvailableException 应该传播出去
        raise
    except Exception as e:
        logger.error(f"Failed to create streaming driver {driver_type}: {e}")
        return None

    return None


def list_available_drivers() -> List[str]:
    """列出所有支持的驱动类型"""
    return list(DriverType.get_supported_types())
