# agentlang/tests/streaming/test_manager.py
import pytest
from unittest.mock import patch, MagicMock
from agentlang.streaming import manager
from agentlang.streaming.exceptions import DriverNotAvailableException
from agentlang.streaming.driver_types import DriverType


def test_list_available_drivers():
    """测试列出可用的驱动类型"""
    available_drivers = manager.list_available_drivers()
    assert "socketio" in available_drivers


def test_create_driver_socketio_success():
    """测试成功创建 SocketIO 驱动"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver') as MockDriver, \
         patch('agentlang.streaming.drivers.socketio.config.SocketIODriverConfig') as MockConfig:

        mock_driver_instance = MagicMock()
        mock_config_instance = MagicMock()

        MockDriver.return_value = mock_driver_instance
        MockConfig.create_default.return_value = mock_config_instance

        # 测试创建驱动
        driver = manager.create_driver(DriverType.SOCKETIO)

        assert driver is mock_driver_instance
        MockDriver.assert_called_once_with(mock_config_instance)


def test_create_driver_socketio_with_config():
    """测试使用配置创建 SocketIO 驱动"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver') as MockDriver, \
         patch('agentlang.streaming.drivers.socketio.config.SocketIODriverConfig') as MockConfig:

        mock_driver_instance = MagicMock()
        mock_config_instance = MagicMock()

        MockDriver.return_value = mock_driver_instance
        MockConfig.create_default.return_value = mock_config_instance

        config_data = {"socketio_url": "wss://test.com", "enabled": True}

        # 测试使用配置创建驱动
        driver = manager.create_driver(DriverType.SOCKETIO, config_data)

        assert driver is mock_driver_instance
        MockConfig.create_default.assert_called_once()
        mock_config_instance.update_from_dict.assert_called_once_with(config_data)
        MockDriver.assert_called_once_with(mock_config_instance)



def test_create_driver_socketio_import_error():
    """测试 SocketIO 驱动不可用时的处理"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver', side_effect=ImportError("SocketIO not available")):
        with pytest.raises(DriverNotAvailableException) as exc_info:
            manager.create_driver(DriverType.SOCKETIO)

        assert exc_info.value.driver_name == "socketio"
        assert "SocketIODriver not available" in str(exc_info.value)


def test_create_driver_creation_exception():
    """测试驱动创建过程中发生异常"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver', side_effect=Exception("Creation failed")):
        driver = manager.create_driver(DriverType.SOCKETIO)
        assert driver is None


def test_create_driver_multiple_instances():
    """测试多次创建驱动返回不同实例"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver') as MockDriver:

        mock_driver1 = MagicMock()
        mock_driver2 = MagicMock()
        MockDriver.side_effect = [mock_driver1, mock_driver2]

        # 创建两个驱动实例
        driver1 = manager.create_driver(DriverType.SOCKETIO)
        driver2 = manager.create_driver(DriverType.SOCKETIO)

        # 应该是不同的实例
        assert driver1 is mock_driver1
        assert driver2 is mock_driver2
        assert driver1 is not driver2

        # SocketIODriver 应该被调用两次
        assert MockDriver.call_count == 2


def test_create_driver_with_enum_type():
    """测试使用 DriverType 枚举创建驱动"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver') as MockDriver, \
         patch('agentlang.streaming.drivers.socketio.config.SocketIODriverConfig') as MockConfig:

        mock_driver_instance = MagicMock()
        mock_config_instance = MagicMock()

        MockDriver.return_value = mock_driver_instance
        MockConfig.create_default.return_value = mock_config_instance

        # 使用枚举类型创建驱动
        driver = manager.create_driver(DriverType.SOCKETIO)

        assert driver is mock_driver_instance
        MockDriver.assert_called_once_with(mock_config_instance)





def test_create_driver_enum_with_config():
    """测试使用枚举和配置创建驱动"""
    with patch('agentlang.streaming.drivers.socketio.driver.SocketIODriver') as MockDriver, \
         patch('agentlang.streaming.drivers.socketio.config.SocketIODriverConfig') as MockConfig:

        mock_driver_instance = MagicMock()
        mock_config_instance = MagicMock()

        MockDriver.return_value = mock_driver_instance
        MockConfig.create_default.return_value = mock_config_instance

        config_data = {"enabled": True, "socketio_url": "http://localhost:3000"}

        # 使用枚举和配置创建驱动
        driver = manager.create_driver(DriverType.SOCKETIO, config_data)

        assert driver is mock_driver_instance
        MockDriver.assert_called_once_with(mock_config_instance)
        mock_config_instance.update_from_dict.assert_called_once_with(config_data)
