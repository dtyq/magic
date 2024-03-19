"""
测试 ChatClientMessage 扩展字段验证

验证ChatClientMessage中新增的model_id和dynamic_config字段的验证逻辑
"""
import pytest
from pydantic import ValidationError
from typing import Dict, Any

from app.core.entity.message.client_message import ChatClientMessage, ContextType, TaskMode, AgentMode


class TestChatClientMessageModelId:
    """测试ChatClientMessage的model_id字段验证"""

    def test_model_id_valid_string(self):
        """测试有效的model_id字符串"""
        valid_model_ids = [
            "gpt-4",
            "gpt-3.5-turbo",
            "claude-3-sonnet",
            "my-custom-model",
            "model_with_underscore",
            "model-with-dash",
            "model.with.dots",
            "model123",
            "模型中文名",
            "モデル日本語",
        ]

        for model_id in valid_model_ids:
            message = ChatClientMessage(
                message_id="test-001",
                prompt="Test message",
                model_id=model_id
            )
            assert message.model_id == model_id

    def test_model_id_with_spaces_trimmed(self):
        """测试带空格的model_id会被trim"""
        test_cases = [
            ("  gpt-4  ", "gpt-4"),
            (" claude-3-sonnet ", "claude-3-sonnet"),
            ("\tmodel-with-tabs\t", "model-with-tabs"),
            ("\nmodel-with-newlines\n", "model-with-newlines"),
        ]

        for input_value, expected_output in test_cases:
            message = ChatClientMessage(
                message_id="test-002",
                prompt="Test message",
                model_id=input_value
            )
            assert message.model_id == expected_output

    def test_model_id_empty_string_becomes_none(self):
        """测试空字符串和空白字符串会变成None"""
        empty_values = ["", "   ", "\t", "\n", " \t \n "]

        for empty_value in empty_values:
            message = ChatClientMessage(
                message_id="test-003",
                prompt="Test message",
                model_id=empty_value
            )
            # 空字符串和空白字符串应该被转换为None，而不是抛出错误
            assert message.model_id is None

    def test_model_id_none_is_valid(self):
        """测试model_id为None是有效的（可选字段）"""
        message = ChatClientMessage(
            message_id="test-004",
            prompt="Test message",
            model_id=None
        )
        assert message.model_id is None

    def test_model_id_default_none(self):
        """测试model_id的默认值为None"""
        message = ChatClientMessage(
            message_id="test-005",
            prompt="Test message"
        )
        assert message.model_id is None

    def test_model_id_non_string_type_error(self):
        """测试非字符串类型的model_id会报错"""
        non_string_values = [
            123,
            12.34,
            True,
            False,
            [],
            {},
            object(),
        ]

        for non_string_value in non_string_values:
            with pytest.raises(ValidationError) as exc_info:
                ChatClientMessage(
                    message_id="test-006",
                    prompt="Test message",
                    model_id=non_string_value
                )
            # Pydantic默认的字符串类型验证错误信息
            assert "Input should be a valid string" in str(exc_info.value)


class TestChatClientMessageDynamicConfig:
    """测试ChatClientMessage的dynamic_config字段验证"""

    def test_dynamic_config_valid_dict(self):
        """测试有效的dynamic_config字典"""
        valid_configs = [
            # 空字典
            {},
            # 简单配置
            {"models": {"gpt-4": {"api_key": "test", "api_base_url": "https://api.openai.com/v1", "name": "gpt-4"}}},
            # 复杂配置
            {
                "models": {
                    "custom-model": {
                        "api_key": "sk-test123",
                        "api_base_url": "https://custom-api.com/v1",
                        "name": "custom-gpt-4",
                        "type": "llm",
                        "provider": "openai",
                        "supports_tool_use": True,
                        "max_output_tokens": 4096,
                        "temperature": 0.7,
                    }
                }
            },
            # 多个模型配置
            {
                "models": {
                    "model1": {"api_key": "key1", "api_base_url": "url1", "name": "name1"},
                    "model2": {"api_key": "key2", "api_base_url": "url2", "name": "name2"},
                }
            },
        ]

        for config in valid_configs:
            message = ChatClientMessage(
                message_id="test-007",
                prompt="Test message",
                dynamic_config=config
            )
            assert message.dynamic_config == config

    def test_dynamic_config_none_is_valid(self):
        """测试dynamic_config为None是有效的（可选字段）"""
        message = ChatClientMessage(
            message_id="test-008",
            prompt="Test message",
            dynamic_config=None
        )
        assert message.dynamic_config is None

    def test_dynamic_config_default_none(self):
        """测试dynamic_config的默认值为None"""
        message = ChatClientMessage(
            message_id="test-009",
            prompt="Test message"
        )
        assert message.dynamic_config is None

    def test_dynamic_config_empty_list_becomes_none(self):
        """测试空列表会被转换为None"""
        message = ChatClientMessage(
            message_id="test-010",
            prompt="Test message",
            dynamic_config=[]
        )
        assert message.dynamic_config is None

    def test_dynamic_config_non_dict_non_list_becomes_none(self):
        """测试非字典非列表类型会被转换为None"""
        non_dict_values = [
            "string",
            123,
            12.34,
            True,
            False,
            object(),
        ]

        for non_dict_value in non_dict_values:
            message = ChatClientMessage(
                message_id="test-011",
                prompt="Test message",
                dynamic_config=non_dict_value
            )
            assert message.dynamic_config is None

    def test_dynamic_config_with_nested_structures(self):
        """测试包含嵌套结构的dynamic_config"""
        nested_config = {
            "models": {
                "complex-model": {
                    "api_key": "sk-test",
                    "api_base_url": "https://api.example.com/v1",
                    "name": "complex-gpt-4",
                    "type": "llm",
                    "provider": "openai",
                    "supports_tool_use": True,
                    "max_output_tokens": 4096,
                    "temperature": 0.7,
                    "pricing": {
                        "input_price": 0.005,
                        "output_price": 0.015,
                        "currency": "USD"
                    },
                    "extra_params": {
                        "timeout": 30,
                        "retry_count": 3,
                        "custom_headers": {
                            "Authorization-Extra": "Bearer extra-token"
                        }
                    }
                }
            },
            "logging": {
                "level": "INFO",
                "format": "json"
            },
            "storage": {
                "type": "s3",
                "bucket": "test-bucket"
            }
        }

        message = ChatClientMessage(
            message_id="test-012",
            prompt="Test message",
            dynamic_config=nested_config
        )
        assert message.dynamic_config == nested_config


class TestChatClientMessageCombinedFields:
    """测试ChatClientMessage中model_id和dynamic_config字段的组合使用"""

    def test_both_fields_provided(self):
        """测试同时提供model_id和dynamic_config"""
        model_id = "custom-gpt-4"
        dynamic_config = {
            "models": {
                "custom-gpt-4": {
                    "api_key": "sk-test123",
                    "api_base_url": "https://api.custom.com/v1",
                    "name": "gpt-4-custom",
                    "type": "llm",
                    "provider": "openai"
                }
            }
        }

        message = ChatClientMessage(
            message_id="test-013",
            prompt="Test message with both fields",
            model_id=model_id,
            dynamic_config=dynamic_config
        )

        assert message.model_id == model_id
        assert message.dynamic_config == dynamic_config

    def test_only_model_id_provided(self):
        """测试只提供model_id"""
        model_id = "gpt-4-turbo"

        message = ChatClientMessage(
            message_id="test-014",
            prompt="Test message with only model_id",
            model_id=model_id
        )

        assert message.model_id == model_id
        assert message.dynamic_config is None

    def test_only_dynamic_config_provided(self):
        """测试只提供dynamic_config"""
        dynamic_config = {
            "models": {
                "some-model": {
                    "api_key": "sk-test",
                    "api_base_url": "https://api.test.com/v1",
                    "name": "test-model"
                }
            }
        }

        message = ChatClientMessage(
            message_id="test-015",
            prompt="Test message with only dynamic_config",
            dynamic_config=dynamic_config
        )

        assert message.model_id is None
        assert message.dynamic_config == dynamic_config

    def test_neither_field_provided(self):
        """测试两个字段都不提供（使用默认值）"""
        message = ChatClientMessage(
            message_id="test-016",
            prompt="Test message with default values"
        )

        assert message.model_id is None
        assert message.dynamic_config is None

    def test_fields_with_other_parameters(self):
        """测试新字段与其他现有字段的兼容性"""
        message = ChatClientMessage(
            message_id="test-017",
            prompt="Test compatibility with other fields",
            model_id="claude-3-sonnet",
            dynamic_config={"models": {"claude-3-sonnet": {"api_key": "test"}}},
            context_type=ContextType.FOLLOW_UP,
            agent_mode=AgentMode.MAGIC,
            attachments=[],
            mentions=[],
            remark="Test remark"
        )

        # 验证新字段
        assert message.model_id == "claude-3-sonnet"
        assert message.dynamic_config == {"models": {"claude-3-sonnet": {"api_key": "test"}}}

        # 验证现有字段不受影响
        assert message.context_type == ContextType.FOLLOW_UP
        assert message.agent_mode == AgentMode.MAGIC
        assert message.attachments == []
        assert message.mentions == []
        assert message.remark == "Test remark"


class TestChatClientMessageFieldDescription:
    """测试ChatClientMessage字段的描述和文档"""

    def test_model_id_field_properties(self):
        """测试model_id字段的属性"""
        # 检查字段定义
        field_info = ChatClientMessage.model_fields.get('model_id')
        assert field_info is not None
        assert field_info.default is None  # 默认值为None
        assert "动态模型选择" in field_info.description  # 包含描述信息

    def test_dynamic_config_field_properties(self):
        """测试dynamic_config字段的属性"""
        # 检查字段定义
        field_info = ChatClientMessage.model_fields.get('dynamic_config')
        assert field_info is not None
        assert field_info.default is None  # 默认值为None
        assert "动态配置" in field_info.description  # 包含描述信息
        assert "JSON格式" in field_info.description  # 提到JSON格式


class TestChatClientMessageSerialization:
    """测试ChatClientMessage的序列化和反序列化"""

    def test_serialize_with_new_fields(self):
        """测试包含新字段的序列化"""
        message = ChatClientMessage(
            message_id="test-018",
            prompt="Test serialization",
            model_id="test-model",
            dynamic_config={"test": "config"}
        )

        # 序列化为字典
        data = message.model_dump()

        assert data["model_id"] == "test-model"
        assert data["dynamic_config"] == {"test": "config"}

    def test_deserialize_with_new_fields(self):
        """测试包含新字段的反序列化"""
        data = {
            "message_id": "test-019",
            "prompt": "Test deserialization",
            "model_id": "deserialized-model",
            "dynamic_config": {"deserialized": "config"}
        }

        message = ChatClientMessage(**data)

        assert message.model_id == "deserialized-model"
        assert message.dynamic_config == {"deserialized": "config"}

    def test_serialize_without_new_fields(self):
        """测试不包含新字段的序列化（向后兼容）"""
        message = ChatClientMessage(
            message_id="test-020",
            prompt="Test backward compatibility"
        )

        # 序列化为字典
        data = message.model_dump()

        assert data["model_id"] is None
        assert data["dynamic_config"] is None

    def test_deserialize_old_format(self):
        """测试反序列化旧格式数据（向后兼容）"""
        # 旧格式数据不包含新字段
        old_data = {
            "message_id": "test-021",
            "prompt": "Test old format compatibility",
            "context_type": "normal",
            "agent_mode": "magic"
        }

        message = ChatClientMessage(**old_data)

        # 新字段应该使用默认值
        assert message.model_id is None
        assert message.dynamic_config is None

        # 旧字段应该正常工作
        assert message.context_type == ContextType.NORMAL
        assert message.agent_mode == AgentMode.MAGIC


class TestChatClientMessageRegression:
    """回归测试：修复已知问题的测试用例"""

    def test_empty_string_model_id_sandbox_error_fix(self):
        """
        回归测试：修复空字符串model_id导致的沙箱错误

        错误场景：CHAT消息格式错误: 1 validation error for ChatClientMessage
        model_id: Value error, model_id不能为空字符串

        修复后：空字符串应该被转换为None，不抛出错误
        """
        # 模拟用户实际遇到的错误场景
        message = ChatClientMessage(
            message_id="608195548752707584",  # 实际的request_id
            prompt="用户的聊天消息",
            model_id=""  # 空字符串，之前会导致验证错误
        )

        # 验证修复结果
        assert message.model_id is None
        assert message.message_id == "608195548752707584"
        assert message.prompt == "用户的聊天消息"

        # 确保其他字段仍然正常
        assert message.type == "chat"  # MessageType.CHAT.value 是小写的 "chat"
        assert message.attachments == []
        assert message.dynamic_config is None

    def test_various_empty_model_id_formats(self):
        """测试各种形式的空model_id都能正确处理"""
        empty_formats = [
            "",           # 纯空字符串
            " ",          # 单个空格
            "  ",         # 多个空格
            "\t",         # Tab字符
            "\n",         # 换行符
            " \t \n ",    # 混合空白字符
        ]

        for empty_format in empty_formats:
            message = ChatClientMessage(
                message_id=f"test-{hash(empty_format)}",
                prompt="测试消息",
                model_id=empty_format
            )

            # 所有格式的空字符串都应该被转换为None
            assert message.model_id is None, f"Failed for empty format: {repr(empty_format)}"


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
