"""ProcessorConfig 单元测试"""

import pytest
from unittest.mock import Mock
from agentlang.llms.processors import ProcessorConfig
from agentlang.streaming.message_builder import MessageBuilderInterface
from agentlang.streaming.driver_types import DriverType


def create_mock_message_builder() -> MessageBuilderInterface:
    """创建MessageBuilderInterface的Mock对象"""
    mock_builder = Mock(spec=MessageBuilderInterface)
    return mock_builder


class TestProcessorConfig:
    """ProcessorConfig 测试类"""

    def test_create_default(self):
        """测试创建默认配置"""
        config = ProcessorConfig.create_default()

        assert not config.is_streaming_enabled()
        assert not config.is_push_enabled()
        assert config.use_stream_mode is False
        assert config.streaming_push_mode is None
        assert config.message_builder is None

    def test_create_streaming_only(self):
        """测试创建仅流式配置"""
        config = ProcessorConfig.create_streaming_only()

        assert config.is_streaming_enabled()
        assert not config.is_push_enabled()
        assert config.use_stream_mode is True
        assert config.streaming_push_mode is None

    def test_create_with_socketio_push(self):
        """测试创建Socket.IO推流配置"""
        config = ProcessorConfig.create_with_socketio_push()

        assert config.is_streaming_enabled()
        assert config.is_push_enabled()
        assert config.use_stream_mode is True
        assert config.streaming_push_mode == DriverType.SOCKETIO

    def test_create_with_socketio_push_custom_params(self):
        """测试创建带自定义参数的Socket.IO推流配置"""
        from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
        mock_builder = create_mock_message_builder()
        custom_config = SocketIODriverConfig(base_url="wss://custom.com", push_timeout=5.0)

        config = ProcessorConfig.create_with_socketio_push(
            message_builder=mock_builder,
            socketio_driver_config=custom_config
        )

        assert config.is_streaming_enabled()
        assert config.is_push_enabled()
        assert config.message_builder is mock_builder
        assert config.socketio_driver_config == custom_config

    def test_get_effective_streaming_config_empty(self):
        """测试获取默认配置"""
        config = ProcessorConfig.create_default()
        effective_config = config.get_effective_streaming_config()

        # 现在返回的是默认SocketIODriverConfig的字典，包含默认值
        assert effective_config["enabled"] is False  # 因为push没有启用
        assert effective_config["base_url"] == ""  # 默认为空字符串
        assert effective_config["message_builder"] is None

    def test_get_effective_streaming_config_with_message_builder(self):
        """测试获取包含消息构建器的有效配置"""
        mock_builder = create_mock_message_builder()
        config = ProcessorConfig.create_with_socketio_push(message_builder=mock_builder)

        effective_config = config.get_effective_streaming_config()

        assert "message_builder" in effective_config
        assert effective_config["message_builder"] is mock_builder

    def test_get_effective_streaming_config_with_streaming_config(self):
        """测试获取包含流式配置的有效配置"""
        from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
        custom_config = SocketIODriverConfig(base_url="wss://test.com", connection_timeout=30)
        config = ProcessorConfig.create_with_socketio_push(socketio_driver_config=custom_config)

        effective_config = config.get_effective_streaming_config()

        assert effective_config["base_url"] == "wss://test.com"
        assert effective_config["connection_timeout"] == 30

    def test_get_effective_streaming_config_combined(self):
        """测试获取组合的有效配置"""
        mock_builder = create_mock_message_builder()
        from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
        custom_config = SocketIODriverConfig(base_url="wss://test.com")

        config = ProcessorConfig.create_with_socketio_push(
            message_builder=mock_builder,
            socketio_driver_config=custom_config
        )

        effective_config = config.get_effective_streaming_config()

        assert "message_builder" in effective_config
        assert effective_config["message_builder"] is mock_builder
        assert effective_config["base_url"] == "wss://test.com"

    def test_streaming_enabled_logic(self):
        """测试流式启用逻辑"""
        # 默认关闭
        config1 = ProcessorConfig()
        assert not config1.is_streaming_enabled()

        # 手动启用
        config2 = ProcessorConfig(use_stream_mode=True)
        assert config2.is_streaming_enabled()

    def test_push_enabled_logic(self):
        """测试推流启用逻辑"""
        # 只有流式模式，没有推流
        config1 = ProcessorConfig(use_stream_mode=True)
        assert not config1.is_push_enabled()

        # 有流式模式和推流模式
        config2 = ProcessorConfig(use_stream_mode=True, streaming_push_mode=DriverType.SOCKETIO)
        assert config2.is_push_enabled()

        # 有推流模式但没有流式模式
        config3 = ProcessorConfig(use_stream_mode=False, streaming_push_mode=DriverType.SOCKETIO)
        assert not config3.is_push_enabled()

    def test_dataclass_immutability_after_creation(self):
        """测试配置创建后的不变性（dataclass特性）"""
        config = ProcessorConfig.create_with_socketio_push()

        # 这些属性应该可以访问
        assert config.use_stream_mode is True
        assert config.streaming_push_mode == DriverType.SOCKETIO

        # dataclass允许修改，但在实际使用中应该避免
        original_mode = config.use_stream_mode
        config.use_stream_mode = False
        assert config.use_stream_mode is False

        # 恢复原值
        config.use_stream_mode = original_mode
