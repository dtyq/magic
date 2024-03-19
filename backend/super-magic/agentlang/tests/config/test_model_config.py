"""
模型配置工具的单元测试

测试 ModelConfig 数据类和 ModelConfigUtils 工具类的功能
"""
import pytest
from unittest.mock import patch, MagicMock
from agentlang.config.model_config import ModelConfig, ModelConfigUtils, model_config_utils


class TestModelConfig:
    """测试 ModelConfig 数据类"""

    def test_create_model_config_with_required_fields(self):
        """测试使用必填字段创建 ModelConfig"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com"
        )

        assert config.model_id == "test-model"
        assert config.name == "Test Model"
        assert config.provider == "openai"
        assert config.api_key == "sk-test-key"
        assert config.api_base_url == "https://api.test.com"

    def test_model_config_default_values(self):
        """测试 ModelConfig 的默认值"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com"
        )

        assert config.type == "llm"
        assert config.max_context_tokens == 128000
        assert config.max_output_tokens == 8192
        assert config.temperature == 0.7
        assert config.top_p == 1.0
        assert config.supports_tool_use is False
        assert config.stop is None
        assert config.extra_params == {}
        assert config.metadata == {}

    def test_model_config_with_custom_values(self):
        """测试使用自定义值创建 ModelConfig"""
        config = ModelConfig(
            model_id="gpt-4",
            name="GPT-4",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.openai.com",
            type="llm",
            max_context_tokens=200000,
            max_output_tokens=16384,
            temperature=0.8,
            top_p=0.9,
            supports_tool_use=True,
            stop=["STOP", "END"],
            extra_params={"frequency_penalty": 0.5},
            metadata={"label": "GPT-4", "icon": "icon-gpt4"}
        )

        assert config.max_context_tokens == 200000
        assert config.max_output_tokens == 16384
        assert config.temperature == 0.8
        assert config.top_p == 0.9
        assert config.supports_tool_use is True
        assert config.stop == ["STOP", "END"]
        assert config.extra_params == {"frequency_penalty": 0.5}
        assert config.metadata == {"label": "GPT-4", "icon": "icon-gpt4"}

    def test_from_dict_with_minimal_config(self):
        """测试从最小配置字典创建 ModelConfig"""
        config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com"
        }

        config = ModelConfig.from_dict("test-model-id", config_dict)

        assert config.model_id == "test-model-id"
        assert config.name == "test-model"
        assert config.provider == "openai"
        assert config.api_key == "sk-test-key"
        assert config.api_base_url == "https://api.test.com"
        # 验证默认值（注意：from_dict 使用的默认值是 8192，而不是类的默认值）
        assert config.max_context_tokens == 8192
        assert config.max_output_tokens == 4096
        assert config.supports_tool_use is False

    def test_from_dict_with_full_config(self):
        """测试从完整配置字典创建 ModelConfig"""
        config_dict = {
            "name": "gpt-4-turbo",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.openai.com",
            "type": "llm",
            "max_context_tokens": 250000,
            "max_output_tokens": 20000,
            "temperature": 0.9,
            "top_p": 0.95,
            "supports_tool_use": True,
            "stop": ["END"],
            "extra_params": {"presence_penalty": 0.1},
            "metadata": {"provider_alias": "OpenAI"}
        }

        config = ModelConfig.from_dict("gpt-4-turbo", config_dict)

        assert config.model_id == "gpt-4-turbo"
        assert config.name == "gpt-4-turbo"
        assert config.max_context_tokens == 250000
        assert config.max_output_tokens == 20000
        assert config.temperature == 0.9
        assert config.top_p == 0.95
        assert config.supports_tool_use is True
        assert config.stop == ["END"]
        assert config.extra_params == {"presence_penalty": 0.1}
        assert config.metadata == {"provider_alias": "OpenAI"}

    def test_from_dict_uses_model_id_as_default_name(self):
        """测试当配置中没有 name 时，使用 model_id 作为默认值"""
        config_dict = {
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com"
        }

        config = ModelConfig.from_dict("my-model-id", config_dict)

        assert config.name == "my-model-id"

    def test_to_dict_basic(self):
        """测试将 ModelConfig 转换为字典"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com",
            max_context_tokens=100000,
            supports_tool_use=True
        )

        result = config.to_dict()

        assert result["model_id"] == "test-model"
        assert result["name"] == "Test Model"
        assert result["provider"] == "openai"
        assert result["api_key"] == "sk-test-key"
        assert result["api_base_url"] == "https://api.test.com"
        assert result["max_context_tokens"] == 100000
        assert result["supports_tool_use"] is True

    def test_to_dict_includes_optional_fields(self):
        """测试 to_dict 包含可选字段"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com",
            stop=["STOP"],
            extra_params={"param1": "value1"},
            metadata={"key": "value"}
        )

        result = config.to_dict()

        assert result["stop"] == ["STOP"]
        assert result["extra_params"] == {"param1": "value1"}
        assert result["metadata"] == {"key": "value"}

    def test_to_dict_excludes_none_optional_fields(self):
        """测试 to_dict 不包含值为 None 的可选字段"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com",
            stop=None
        )

        result = config.to_dict()

        assert "stop" not in result

    def test_roundtrip_from_dict_to_dict(self):
        """测试 from_dict -> to_dict 往返转换"""
        original_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "max_context_tokens": 150000,
            "max_output_tokens": 10000,
            "supports_tool_use": True,
            "stop": ["END"],
            "extra_params": {"test": "value"},
            "metadata": {"label": "Test"}
        }

        config = ModelConfig.from_dict("test-id", original_dict)
        result_dict = config.to_dict()

        assert result_dict["model_id"] == "test-id"
        assert result_dict["name"] == original_dict["name"]
        assert result_dict["max_context_tokens"] == original_dict["max_context_tokens"]
        assert result_dict["supports_tool_use"] == original_dict["supports_tool_use"]


class TestModelConfigUtilsSingleton:
    """测试 ModelConfigUtils 单例模式"""

    def test_singleton_instance(self):
        """测试 ModelConfigUtils 是单例"""
        instance1 = ModelConfigUtils()
        instance2 = ModelConfigUtils()

        assert instance1 is instance2
        assert instance1 is model_config_utils

    def test_global_instance_is_model_config_utils(self):
        """测试全局实例是 model_config_utils"""
        assert isinstance(model_config_utils, ModelConfigUtils)


class TestModelConfigUtilsGetModelConfigDict:
    """测试 ModelConfigUtils.get_model_config_dict 方法"""

    def test_get_model_config_dict_from_dynamic_config(self):
        """测试从动态配置获取模型配置字典"""
        mock_config = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com"
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config):
            result = model_config_utils.get_model_config_dict("test-model")

            assert result == mock_config

    def test_get_model_config_dict_from_global_config(self):
        """测试从全局配置获取模型配置字典（动态配置未找到时）"""
        mock_global_config = {
            "name": "global-model",
            "provider": "openai",
            "api_key": "sk-global-key",
            "api_base_url": "https://api.global.com"
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={"global-model": mock_global_config}):
            result = model_config_utils.get_model_config_dict("global-model")

            assert result == mock_global_config

    def test_get_model_config_dict_priority_dynamic_over_global(self):
        """测试动态配置优先于全局配置"""
        mock_dynamic_config = {
            "name": "dynamic-model",
            "max_context_tokens": 200000
        }
        mock_global_config = {
            "name": "global-model",
            "max_context_tokens": 100000
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_dynamic_config), \
             patch('agentlang.config.model_config.config.get', return_value={"test-model": mock_global_config}):
            result = model_config_utils.get_model_config_dict("test-model")

            # 应该返回动态配置，而不是全局配置
            assert result == mock_dynamic_config
            assert result["max_context_tokens"] == 200000

    def test_get_model_config_dict_not_found(self):
        """测试配置未找到时返回 None"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_model_config_dict("non-existent-model")

            assert result is None

    def test_get_model_config_dict_with_empty_model_id(self):
        """测试 model_id 为空时返回 None"""
        result = model_config_utils.get_model_config_dict("")
        assert result is None

        result = model_config_utils.get_model_config_dict(None)
        assert result is None


class TestModelConfigUtilsGetModelConfig:
    """测试 ModelConfigUtils.get_model_config 方法"""

    def test_get_model_config_returns_model_config_instance(self):
        """测试返回 ModelConfig 实例"""
        mock_config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "max_context_tokens": 150000
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config_dict):
            result = model_config_utils.get_model_config("test-model")

            assert isinstance(result, ModelConfig)
            assert result.model_id == "test-model"
            assert result.name == "test-model"
            assert result.max_context_tokens == 150000

    def test_get_model_config_returns_none_when_not_found(self):
        """测试配置未找到时返回 None"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_model_config("non-existent-model")

            assert result is None

    def test_get_model_config_with_incomplete_dict(self):
        """测试配置字典不完整时仍能创建 ModelConfig（使用默认值）"""
        # 配置字典缺少一些字段，但 from_dict 会使用默认值
        incomplete_config_dict = {
            "name": "test-model"
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=incomplete_config_dict):
            result = model_config_utils.get_model_config("test-model")

            # 应该能成功创建，使用默认值填充缺失字段
            assert result is not None
            assert isinstance(result, ModelConfig)
            assert result.model_id == "test-model"
            assert result.name == "test-model"
            assert result.provider == "openai"  # 默认值


class TestModelConfigUtilsConvenienceMethods:
    """测试 ModelConfigUtils 的便捷方法"""

    def test_get_max_context_tokens_success(self):
        """测试成功获取 max_context_tokens"""
        mock_config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "max_context_tokens": 250000
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config_dict):
            result = model_config_utils.get_max_context_tokens("test-model")

            assert result == 250000

    def test_get_max_context_tokens_returns_default_when_not_found(self):
        """测试模型未找到时返回默认值"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_max_context_tokens("non-existent", default=50000)

            assert result == 50000

    def test_get_max_context_tokens_uses_default_8192(self):
        """测试默认值为 8192"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_max_context_tokens("non-existent")

            assert result == 8192

    def test_get_max_output_tokens_success(self):
        """测试成功获取 max_output_tokens"""
        mock_config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "max_output_tokens": 16384
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config_dict):
            result = model_config_utils.get_max_output_tokens("test-model")

            assert result == 16384

    def test_get_max_output_tokens_returns_default_when_not_found(self):
        """测试模型未找到时返回默认值"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_max_output_tokens("non-existent", default=2048)

            assert result == 2048

    def test_get_max_output_tokens_uses_default_4096(self):
        """测试默认值为 4096"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.get_max_output_tokens("non-existent")

            assert result == 4096

    def test_supports_tool_use_true(self):
        """测试模型支持工具调用"""
        mock_config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "supports_tool_use": True
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config_dict):
            result = model_config_utils.supports_tool_use("test-model")

            assert result is True

    def test_supports_tool_use_false(self):
        """测试模型不支持工具调用"""
        mock_config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "supports_tool_use": False
        }

        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=mock_config_dict):
            result = model_config_utils.supports_tool_use("test-model")

            assert result is False

    def test_supports_tool_use_returns_default_when_not_found(self):
        """测试模型未找到时返回默认值"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.supports_tool_use("non-existent", default=True)

            assert result is True

    def test_supports_tool_use_default_is_false(self):
        """测试默认值为 False"""
        with patch('agentlang.config.model_config.dynamic_config.get_model_config', return_value=None), \
             patch('agentlang.config.model_config.config.get', return_value={}):
            result = model_config_utils.supports_tool_use("non-existent")

            assert result is False


class TestModelConfigUtilsRealScenario:
    """测试真实使用场景（不使用 mock）"""

    def test_get_model_config_from_real_config(self):
        """测试从真实配置获取模型配置（集成测试）

        这个测试不使用 mock，直接从实际的配置系统中读取。
        只验证能够成功获取配置，不验证具体值。
        """
        # 尝试获取一个可能存在于配置中的模型
        # 如果配置中没有任何模型，这个测试会返回 None
        result = model_config_utils.get_model_config_dict("auto")

        # 不强制要求一定能获取到，因为配置可能为空
        # 但如果获取到了，应该是字典类型
        if result is not None:
            assert isinstance(result, dict)
            # 如果有配置，验证基本结构
            assert "name" in result or "provider" in result or "api_key" in result

    def test_get_max_context_tokens_from_real_config(self):
        """测试从真实配置获取 max_context_tokens（集成测试）

        验证方法能够正常调用，不验证返回的具体值。
        """
        # 尝试获取，如果模型不存在会返回默认值
        result = model_config_utils.get_max_context_tokens("gpt-4")

        # 验证返回值是整数且为正数
        assert isinstance(result, int)
        assert result > 0

    def test_get_max_output_tokens_from_real_config(self):
        """测试从真实配置获取 max_output_tokens（集成测试）

        验证方法能够正常调用，不验证返回的具体值。
        """
        result = model_config_utils.get_max_output_tokens("claude-3-5-sonnet")

        # 验证返回值是整数且为正数
        assert isinstance(result, int)
        assert result > 0

    def test_supports_tool_use_from_real_config(self):
        """测试从真实配置检查工具支持（集成测试）

        验证方法能够正常调用，不验证返回的具体值。
        """
        result = model_config_utils.supports_tool_use("gpt-4")

        # 验证返回值是布尔类型
        assert isinstance(result, bool)

    def test_get_structured_model_config_from_real_config(self):
        """测试获取结构化模型配置（集成测试）

        验证能够获取并解析为 ModelConfig 对象。
        """
        result = model_config_utils.get_model_config("gpt-4")

        # 如果获取到配置，应该是 ModelConfig 类型或 None
        if result is not None:
            assert isinstance(result, ModelConfig)
            assert result.model_id == "gpt-4"
            assert isinstance(result.max_context_tokens, int)
            assert isinstance(result.max_output_tokens, int)
            assert isinstance(result.supports_tool_use, bool)

    def test_multiple_models_real_config(self):
        """测试获取多个模型的配置（集成测试）

        验证能够批量获取多个模型的配置。
        """
        model_ids = ["gpt-4", "claude-3-5-sonnet", "gpt-3.5-turbo"]

        for model_id in model_ids:
            # 获取配置（可能返回 None）
            result = model_config_utils.get_model_config(model_id)

            # 如果获取到了，验证基本结构
            if result is not None:
                assert isinstance(result, ModelConfig)
                assert result.model_id == model_id
                assert hasattr(result, 'max_context_tokens')
                assert hasattr(result, 'max_output_tokens')
                assert hasattr(result, 'supports_tool_use')


class TestModelConfigUtilsEdgeCases:
    """测试边界情况和异常处理"""

    def test_from_dict_with_type_conversion(self):
        """测试 from_dict 进行类型转换"""
        config_dict = {
            "name": "test-model",
            "provider": "openai",
            "api_key": "sk-test-key",
            "api_base_url": "https://api.test.com",
            "max_context_tokens": "200000",  # 字符串
            "max_output_tokens": "16384",    # 字符串
            "temperature": "0.8",             # 字符串
            "top_p": "0.9",                   # 字符串
            "supports_tool_use": 1            # 整数
        }

        config = ModelConfig.from_dict("test-model", config_dict)

        # 验证类型转换成功
        assert isinstance(config.max_context_tokens, int)
        assert config.max_context_tokens == 200000
        assert isinstance(config.max_output_tokens, int)
        assert config.max_output_tokens == 16384
        assert isinstance(config.temperature, float)
        assert config.temperature == 0.8
        assert isinstance(config.top_p, float)
        assert config.top_p == 0.9
        assert isinstance(config.supports_tool_use, bool)
        assert config.supports_tool_use is True

    def test_model_config_with_empty_extra_params(self):
        """测试空的 extra_params"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com",
            extra_params={}
        )

        result = config.to_dict()
        # 空字典应该被排除
        assert "extra_params" not in result

    def test_model_config_with_empty_metadata(self):
        """测试空的 metadata"""
        config = ModelConfig(
            model_id="test-model",
            name="Test Model",
            provider="openai",
            api_key="sk-test-key",
            api_base_url="https://api.test.com",
            metadata={}
        )

        result = config.to_dict()
        # 空字典应该被排除
        assert "metadata" not in result
