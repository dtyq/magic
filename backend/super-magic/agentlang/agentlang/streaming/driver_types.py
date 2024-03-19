# agentlang/agentlang/streaming/driver_types.py
from enum import Enum


class DriverType(Enum):
    """流式推送驱动类型枚举"""
    SOCKETIO = "socketio"

    @classmethod
    def get_supported_types(cls) -> set[str]:
        """获取所有支持的驱动类型"""
        return {driver.value for driver in cls}

    @classmethod
    def is_supported(cls, driver_type: str) -> bool:
        """检查是否支持指定的驱动类型"""
        return driver_type in cls.get_supported_types()
