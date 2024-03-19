import pytest
from agentlang.streaming.driver_types import DriverType


class TestDriverType:
    """DriverType 枚举类测试"""

    def test_enum_values(self):
        """测试枚举值定义"""
        assert DriverType.SOCKETIO.value == "socketio"

    def test_get_supported_types(self):
        """测试获取所有支持的驱动类型"""
        supported_types = DriverType.get_supported_types()
        assert isinstance(supported_types, set)
        assert "socketio" in supported_types
        assert len(supported_types) >= 1

    def test_is_supported_valid_type(self):
        """测试支持的驱动类型检查（有效类型）"""
        assert DriverType.is_supported("socketio") is True

    def test_is_supported_invalid_type(self):
        """测试支持的驱动类型检查（无效类型）"""
        assert DriverType.is_supported("invalid_type") is False
        assert DriverType.is_supported("redis") is False
        assert DriverType.is_supported("") is False

    def test_enum_iteration(self):
        """测试枚举类型迭代"""
        driver_types = list(DriverType)
        assert len(driver_types) >= 1
        assert DriverType.SOCKETIO in driver_types

    def test_enum_member_properties(self):
        """测试枚举成员属性"""
        socketio_driver = DriverType.SOCKETIO
        assert socketio_driver.name == "SOCKETIO"
        assert socketio_driver.value == "socketio"
