# agentlang/tests/streaming/test_config.py
import pytest
from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
from agentlang.streaming.message_builder import MessageBuilderInterface


class TestMessageBuilder(MessageBuilderInterface):
    """测试用的消息构建器"""

    async def build_message(self, chunk_data) -> dict:
        return {
            "test_request_id": chunk_data.request_id if chunk_data else None,
            "test_content": chunk_data.content if chunk_data else None
        }


class TestSocketIODriverConfig:
    """SocketIODriverConfig 单元测试"""

    def test_create_default(self):
        """测试创建默认配置"""
        config = SocketIODriverConfig.create_default()

        assert config.enabled is False
        assert config.base_url == ""
        assert config.socketio_path == "/socket.io/"
        assert config.connection_timeout == 10
        assert config.push_timeout == 2.0
        assert config.namespace == "/im"
        assert config.event_name == "intermediate"
        assert config.max_connection_age == 300
        assert config.message_builder is None
        assert config.message_builder_class is None

    def test_create_enabled(self):
        """测试创建启用状态的配置"""
        base_url = "wss://example.com"
        config = SocketIODriverConfig.create_enabled(base_url)

        assert config.enabled is True
        assert config.base_url == base_url
        assert config.socketio_path == "/socket.io/"  # 默认值
        # 其他配置应该保持默认值
        assert config.connection_timeout == 10
        assert config.push_timeout == 2.0

    def test_create_enabled_with_kwargs(self):
        """测试创建启用配置时传递额外参数"""
        config = SocketIODriverConfig.create_enabled(
            "wss://example.com",
            connection_timeout=5,
            push_timeout=1.0,
            namespace="/custom"
        )

        assert config.enabled is True
        assert config.base_url == "wss://example.com"
        assert config.socketio_path == "/socket.io/"  # 默认值
        assert config.connection_timeout == 5
        assert config.push_timeout == 1.0
        assert config.namespace == "/custom"

    def test_update_from_dict(self):
        """测试从字典更新配置"""
        config = SocketIODriverConfig.create_default()

        update_data = {
            "enabled": True,
            "base_url": "wss://new-url.com",
            "socketio_path": "/custom/socket.io/",
            "connection_timeout": 15,
            "push_timeout": 3.0,
            "namespace": "/new-namespace",
            "event_name": "new-event",
            "max_connection_age": 600,
            "message_builder_class": "test.Builder"
        }

        config.update_from_dict(update_data)

        assert config.enabled is True
        assert config.base_url == "wss://new-url.com"
        assert config.socketio_path == "/custom/socket.io/"
        assert config.connection_timeout == 15
        assert config.push_timeout == 3.0
        assert config.namespace == "/new-namespace"
        assert config.event_name == "new-event"
        assert config.max_connection_age == 600
        assert config.message_builder_class == "test.Builder"

    def test_update_from_dict_with_invalid_keys(self):
        """测试从字典更新配置时忽略无效的键"""
        config = SocketIODriverConfig.create_default()
        original_enabled = config.enabled

        update_data = {
            "enabled": True,
            "invalid_key": "should_be_ignored",
            "another_invalid": 123
        }

        config.update_from_dict(update_data)

        # 有效键应该被更新
        assert config.enabled is True
        # 无效键不应该被添加为属性
        assert not hasattr(config, "invalid_key")
        assert not hasattr(config, "another_invalid")

    def test_to_dict(self):
        """测试转换为字典"""
        test_builder = TestMessageBuilder()
        config = SocketIODriverConfig(
            enabled=True,
            base_url="wss://test.com",
            socketio_path="/test/socket.io/",
            connection_timeout=5,
            push_timeout=1.5,
            namespace="/test",
            event_name="test_event",
            max_connection_age=200,
            message_builder=test_builder,
            message_builder_class="test.TestBuilder"
        )

        result = config.to_dict()

        expected_keys = [
            "enabled", "base_url", "socketio_path", "transports", "connection_timeout", "push_timeout",
            "namespace", "event_name", "max_connection_age",
            "message_builder", "message_builder_class"
        ]

        assert set(result.keys()) == set(expected_keys)
        assert result["enabled"] is True
        assert result["base_url"] == "wss://test.com"
        assert result["socketio_path"] == "/test/socket.io/"
        assert result["transports"] == ['websocket']
        assert result["connection_timeout"] == 5
        assert result["push_timeout"] == 1.5
        assert result["namespace"] == "/test"
        assert result["event_name"] == "test_event"
        assert result["max_connection_age"] == 200
        assert result["message_builder"] is test_builder
        assert result["message_builder_class"] == "test.TestBuilder"

    def test_validate_disabled_config(self):
        """测试验证禁用状态的配置"""
        config = SocketIODriverConfig.create_default()  # 默认禁用
        assert config.validate() is True

        # 即使 base_url 为空，禁用状态下也应该通过验证
        config.base_url = ""
        assert config.validate() is True

    def test_validate_enabled_valid_config(self):
        """测试验证有效的启用配置"""
        config = SocketIODriverConfig.create_enabled("wss://example.com")
        assert config.validate() is True

    def test_validate_enabled_invalid_config(self):
        """测试验证无效的启用配置"""
        # 空 URL
        config = SocketIODriverConfig.create_enabled("")
        assert config.validate() is False

        # 负数超时
        config = SocketIODriverConfig.create_enabled("wss://example.com")
        config.connection_timeout = -1
        assert config.validate() is False

        config.connection_timeout = 10
        config.push_timeout = -1.0
        assert config.validate() is False

        # 无效的连接年龄
        config.push_timeout = 2.0
        config.max_connection_age = -1
        assert config.validate() is False

    def test_get_message_builder_direct_injection(self):
        """测试获取直接注入的消息构建器"""
        test_builder = TestMessageBuilder()
        config = SocketIODriverConfig(message_builder=test_builder)

        result = config.get_message_builder()
        assert result is test_builder

    def test_get_message_builder_no_builder(self):
        """测试没有消息构建器时返回 None"""
        config = SocketIODriverConfig.create_default()
        result = config.get_message_builder()
        assert result is None

    def test_get_message_builder_invalid_class_name(self):
        """测试无效类名时返回 None"""
        config = SocketIODriverConfig(message_builder_class="invalid.NonExistentClass")
        result = config.get_message_builder()
        assert result is None

    def test_get_message_builder_priority(self):
        """测试消息构建器获取的优先级"""
        test_builder = TestMessageBuilder()
        config = SocketIODriverConfig(
            message_builder=test_builder,
            message_builder_class="some.OtherClass"  # 应该被忽略
        )

        result = config.get_message_builder()
        # 直接注入的构建器应该优先于类名
        assert result is test_builder

    def test_immutable_after_creation(self):
        """测试配置创建后可以修改（这是预期行为）"""
        config = SocketIODriverConfig.create_default()
        original_base_url = config.base_url

        # 应该可以修改配置
        new_base_url = "wss://new.com"
        config.base_url = new_base_url
        assert config.base_url == new_base_url
        assert config.base_url != original_base_url
