import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest

from agentlang.llms.factory import LLMFactory
from agentlang.config.dynamic_config import DynamicConfig


class TestLLMFactoryDynamicConfig(unittest.TestCase):
    """测试LLMFactory的动态配置支持功能"""

    def setUp(self):
        """测试前的设置"""
        # 重置Factory状态
        LLMFactory._clients.clear()
        LLMFactory._configs.clear()

        # 重置DynamicConfig单例
        DynamicConfig._instance = None

    def tearDown(self):
        """测试后的清理"""
        # 重置Factory状态
        LLMFactory._clients.clear()
        LLMFactory._configs.clear()

        # 重置DynamicConfig单例
        DynamicConfig._instance = None

    @patch('agentlang.llms.factory.dynamic_config')
    def test_get_llm_with_dynamic_config_priority(self, mock_dynamic_config):
        """测试get()方法优先使用动态配置"""
        # 准备动态配置数据
        test_model_config = {
            "api_key": "sk-dynamic-test-key",
            "api_base_url": "https://api.dynamic-test.com/v1",
            "name": "gpt-4o-dynamic",
            "type": "llm",
            "provider": "openai",
            "supports_tool_use": True,
            "temperature": 0.8,
            "max_output_tokens": 2048,
            "max_context_tokens": 4096,
            "top_p": 0.9
        }

        # 设置mock dynamic_config的行为
        mock_dynamic_config.get_model_config.return_value = test_model_config

        # 测试get()方法
        with patch('agentlang.llms.factory.AsyncOpenAI') as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            # 调用get()方法
            client = LLMFactory.get("test-dynamic-llm")

            # 验证结果
            self.assertEqual(client, mock_client)
            # 验证客户端已缓存
            self.assertIn("test-dynamic-llm", LLMFactory._clients)

            # 验证dynamic_config.get_model_config被调用
            mock_dynamic_config.get_model_config.assert_called_with("test-dynamic-llm")

            # 验证get_model_config返回正确的配置
            config = LLMFactory.get_model_config("test-dynamic-llm")
            self.assertEqual(config.api_key, "sk-dynamic-test-key")
            self.assertEqual(config.name, "gpt-4o-dynamic")
            self.assertEqual(config.provider, "openai")
            self.assertEqual(config.temperature, 0.8)
            self.assertTrue(config.supports_tool_use)

    @patch('agentlang.llms.factory.dynamic_config')
    @patch('agentlang.llms.factory.config')
    def test_get_llm_fallback_to_global_config(self, mock_global_config, mock_dynamic_config):
        """测试get()方法兜底到全局配置"""
        # 设置动态配置返回None（模型不存在）
        mock_dynamic_config.get_model_config.return_value = None

        # 设置全局配置mock
        mock_global_config.get.return_value = {
            "global-llm": {
                "api_key": "sk-global-test-key",
                "api_base_url": "https://api.global-test.com/v1",
                "name": "gpt-4o-global",
                "type": "llm",
                "provider": "openai",
                "supports_tool_use": False,
                "temperature": 0.7
            }
        }

        # 测试get()方法
        with patch('agentlang.llms.factory.AsyncOpenAI') as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            # 调用get()方法
            client = LLMFactory.get("global-llm")

            # 验证结果
            self.assertEqual(client, mock_client)
            # 验证客户端已缓存
            self.assertIn("global-llm", LLMFactory._clients)

            # 验证调用顺序：先尝试动态配置，再使用全局配置
            mock_dynamic_config.get_model_config.assert_called_with("global-llm")
            mock_global_config.get.assert_any_call("models", {})

            # 验证get_model_config返回正确的配置
            config = LLMFactory.get_model_config("global-llm")
            self.assertEqual(config.api_key, "sk-global-test-key")
            self.assertEqual(config.name, "gpt-4o-global")
            self.assertFalse(config.supports_tool_use)

    @patch('agentlang.llms.factory.dynamic_config')
    def test_get_embedding_client_with_dynamic_config(self, mock_dynamic_config):
        """测试get_embedding_client()方法使用动态配置"""
        # 准备动态配置数据
        test_model_config = {
            "api_key": "sk-embedding-test-key",
            "api_base_url": "https://api.embedding-test.com/v1",
            "name": "text-embedding-3-large-dynamic",
            "type": "embedding",
            "provider": "openai",
            "temperature": 0.0,
            "max_output_tokens": 8192
        }

        # 设置mock dynamic_config的行为
        mock_dynamic_config.get_model_config.return_value = test_model_config

        # 测试get_embedding_client()方法
        with patch('agentlang.llms.factory.AsyncOpenAI') as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            # 调用get_embedding_client()方法
            client = LLMFactory.get_embedding_client("test-dynamic-embedding")

            # 验证结果
            self.assertEqual(client, mock_client)
            # 验证客户端已缓存
            self.assertIn("test-dynamic-embedding", LLMFactory._clients)

            # 验证dynamic_config.get_model_config被调用
            mock_dynamic_config.get_model_config.assert_called_with("test-dynamic-embedding")

            # 验证get_model_config返回正确的配置
            config = LLMFactory.get_model_config("test-dynamic-embedding", "embedding")
            self.assertEqual(config.api_key, "sk-embedding-test-key")
            self.assertEqual(config.name, "text-embedding-3-large-dynamic")
            self.assertEqual(config.type, "embedding")

    def test_sync_dynamic_model_pricing_method_removed(self):
        """测试_sync_dynamic_model_pricing方法已被移除"""
        # 验证LLMFactory类不再包含_sync_dynamic_model_pricing方法
        self.assertFalse(hasattr(LLMFactory, '_sync_dynamic_model_pricing'))

    @patch('agentlang.llms.factory.LLMFactory.get')
    @patch('agentlang.llms.factory.logger')
    @pytest.mark.asyncio
    async def test_call_with_tool_support_dynamic_model_no_pricing_sync(self, mock_logger, mock_get):
        """测试call_with_tool_support使用动态模型时不再进行价格同步"""
        from agentlang.context.base_agent_context import BaseAgentContext
        from unittest.mock import AsyncMock

        # 创建模拟的agent_context，包含动态模型ID
        mock_agent_context = MagicMock()
        mock_agent_context.has_dynamic_model_id.return_value = True
        mock_agent_context.get_dynamic_model_id.return_value = "dynamic-test-model"

        # 创建模拟的LLM客户端
        mock_client = AsyncMock()
        mock_chat_completion = MagicMock()
        mock_client.chat.completions.create.return_value = mock_chat_completion
        mock_get.return_value = mock_client

        # 调用call_with_tool_support方法
        messages = [{"role": "user", "content": "test message"}]
        result = await LLMFactory.call_with_tool_support(
            model_id="original-model",
            messages=messages,
            agent_context=mock_agent_context
        )

        # 验证结果
        self.assertEqual(result, mock_chat_completion)

        # 验证动态模型选择日志
        mock_logger.info.assert_any_call("🎯 动态模型选择: original-model → dynamic-test-model")

        # 验证get方法被调用时使用的是动态模型ID
        mock_get.assert_called_with("dynamic-test-model")

        # 验证客户端调用
        mock_client.chat.completions.create.assert_called_once()

        # 🔥 关键验证：确认没有调用价格同步相关的日志
        # 检查所有logger.info调用，确保没有价格同步相关的日志
        info_calls = [call[0][0] for call in mock_logger.info.call_args_list]
        pricing_sync_messages = [msg for msg in info_calls if "已同步动态模型" in msg and "价格信息" in msg]
        self.assertEqual(len(pricing_sync_messages), 0, "不应该有价格同步相关的日志")

    @patch('agentlang.llms.factory.LLMFactory.get')
    @pytest.mark.asyncio
    async def test_call_with_tool_support_without_dynamic_model(self, mock_get):
        """测试call_with_tool_support在没有动态模型时正常工作"""
        from unittest.mock import AsyncMock

        # 创建模拟的agent_context，不包含动态模型ID
        mock_agent_context = MagicMock()
        mock_agent_context.has_dynamic_model_id.return_value = False

        # 创建模拟的LLM客户端
        mock_client = AsyncMock()
        mock_chat_completion = MagicMock()
        mock_client.chat.completions.create.return_value = mock_chat_completion
        mock_get.return_value = mock_client

        # 调用call_with_tool_support方法
        messages = [{"role": "user", "content": "test message"}]
        result = await LLMFactory.call_with_tool_support(
            model_id="standard-model",
            messages=messages,
            agent_context=mock_agent_context
        )

        # 验证结果
        self.assertEqual(result, mock_chat_completion)

        # 验证get方法被调用时使用的是原始模型ID（没有动态替换）
        mock_get.assert_called_with("standard-model")

        # 验证客户端调用
        mock_client.chat.completions.create.assert_called_once()

    @patch('agentlang.llms.factory.LLMFactory.get')
    @pytest.mark.asyncio
    async def test_call_with_tool_support_empty_dynamic_model(self, mock_get):
        """测试call_with_tool_support在动态模型ID为空时的处理"""
        from unittest.mock import AsyncMock

        # 创建模拟的agent_context，动态模型ID为空字符串
        mock_agent_context = MagicMock()
        mock_agent_context.has_dynamic_model_id.return_value = True
        mock_agent_context.get_dynamic_model_id.return_value = "  "  # 空白字符串

        # 创建模拟的LLM客户端
        mock_client = AsyncMock()
        mock_chat_completion = MagicMock()
        mock_client.chat.completions.create.return_value = mock_chat_completion
        mock_get.return_value = mock_client

        # 调用call_with_tool_support方法
        messages = [{"role": "user", "content": "test message"}]
        result = await LLMFactory.call_with_tool_support(
            model_id="fallback-model",
            messages=messages,
            agent_context=mock_agent_context
        )

        # 验证结果
        self.assertEqual(result, mock_chat_completion)

        # 验证get方法被调用时使用的是原始模型ID（因为动态模型ID为空）
        mock_get.assert_called_with("fallback-model")

    @patch('agentlang.llms.factory.LLMFactory.pricing')
    @pytest.mark.asyncio
    async def test_dynamic_config_pricing_sync_integration(self, mock_pricing):
        """测试DynamicConfig价格同步与LLMFactory.pricing系统的集成"""
        from agentlang.config.dynamic_config import DynamicConfig
        import tempfile

        # 创建临时目录用于测试
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # 创建DynamicConfig实例并设置路径
            with patch('agentlang.context.application_context.ApplicationContext') as mock_app_context:
                mock_path_manager = MagicMock()
                mock_path_manager.get_project_root.return_value = temp_path
                mock_app_context.get_path_manager.return_value = mock_path_manager

                dynamic_config = DynamicConfig()

                # 准备包含价格信息的动态配置
                config_data = {
                    "models": {
                        "test-model-with-pricing": {
                            "api_key": "sk-test-key",
                            "api_base_url": "https://api.test.com/v1",
                            "name": "gpt-4o-test",
                            "type": "llm",
                            "provider": "openai",
                            "supports_tool_use": True,
                            "pricing": {
                                "input_price": 0.03,
                                "output_price": 0.06,
                                "cache_write_price": 0.0375,
                                "cache_hit_price": 0.015,
                                "currency": "USD"
                            }
                        },
                        "test-model-without-pricing": {
                            "api_key": "sk-test-key-2",
                            "api_base_url": "https://api.test2.com/v1",
                            "name": "gpt-3.5-test",
                            "type": "llm",
                            "provider": "openai"
                            # 没有pricing信息
                        }
                    }
                }

                # 调用validate_and_write_dynamic_config方法（异步）
                success, config_path, warnings = await dynamic_config.validate_and_write_dynamic_config(config_data)

                # 验证配置写入成功
                self.assertTrue(success)
                self.assertIsNotNone(config_path)

                # 🔥 关键验证：确认价格同步方法被调用
                # 验证有显式价格信息的模型被同步
                expected_price_info_with_pricing = {
                    "input_price": 0.03,
                    "output_price": 0.06,
                    "cache_write_price": 0.0375,
                    "cache_hit_price": 0.015,
                    "currency": "USD"
                }
                mock_pricing.add_model_pricing.assert_any_call("test-model-with-pricing", expected_price_info_with_pricing)

                # 验证没有显式价格信息的模型会使用默认价格信息被同步
                expected_default_price_info = {
                    "input_price": 0.003,
                    "output_price": 0.015,
                    "cache_write_price": 0.00375,
                    "cache_hit_price": 0.0003,
                    "currency": "USD"
                }
                mock_pricing.add_model_pricing.assert_any_call("test-model-without-pricing", expected_default_price_info)

                # 验证两个模型都被同步了价格信息（因为采用宽容验证模式，缺失的pricing会补全默认值）
                pricing_calls = mock_pricing.add_model_pricing.call_args_list
                self.assertEqual(len(pricing_calls), 2, "应该同步两个模型的价格信息")

                model_ids_with_pricing = [call[0][0] for call in pricing_calls]
                self.assertIn("test-model-with-pricing", model_ids_with_pricing)
                self.assertIn("test-model-without-pricing", model_ids_with_pricing)

    @pytest.mark.asyncio
    async def test_dynamic_config_pricing_sync_error_handling(self):
        """测试DynamicConfig价格同步的错误处理"""
        from agentlang.config.dynamic_config import DynamicConfig
        import tempfile

        # 创建临时目录用于测试
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # 创建DynamicConfig实例并设置路径
            with patch('agentlang.context.application_context.ApplicationContext') as mock_app_context:
                mock_path_manager = MagicMock()
                mock_path_manager.get_project_root.return_value = temp_path
                mock_app_context.get_path_manager.return_value = mock_path_manager

                dynamic_config = DynamicConfig()

                # 准备包含错误价格信息的动态配置
                config_data = {
                    "models": {
                        "test-model-bad-pricing": {
                            "api_key": "sk-test-key",
                            "api_base_url": "https://api.test.com/v1",
                            "name": "gpt-4o-test",
                            "type": "llm",
                            "provider": "openai",
                            "pricing": "invalid-pricing-format"  # 错误的价格格式
                        }
                    }
                }

                # 模拟LLMFactory.pricing.add_model_pricing抛出异常
                with patch('agentlang.llms.factory.LLMFactory.pricing') as mock_pricing:
                    mock_pricing.add_model_pricing.side_effect = Exception("Pricing system error")

                    # 调用validate_and_write_dynamic_config方法（异步）
                    success, config_path, warnings = await dynamic_config.validate_and_write_dynamic_config(config_data)

                    # 验证配置写入仍然成功（价格同步失败不影响主流程）
                    self.assertTrue(success)
                    self.assertIsNotNone(config_path)

                    # 价格同步方法不应该被调用（因为pricing格式错误）
                    mock_pricing.add_model_pricing.assert_not_called()

    @patch('agentlang.config.dynamic_config.config')
    def test_get_model_defaults_with_global_config(self, mock_global_config):
        """测试_get_model_defaults方法优先使用全局配置中的同名模型"""
        from agentlang.config.dynamic_config import DynamicConfig
        import tempfile

        # 模拟全局配置中存在同名模型
        mock_global_config.get.return_value = {
            "claude-3.7-cache": {
                "api_key": "sk-global-key",
                "api_base_url": "https://api.global.com/v1",
                "name": "claude-3-haiku-20240307",
                "type": "llm",
                "provider": "openai",
                "supports_tool_use": True,
                "max_output_tokens": 100000,
                "max_context_tokens": 200000,
                "temperature": 0.5,
                "pricing": {
                    "input_price": 0.00025,
                    "output_price": 0.00125,
                    "cache_write_price": 0.0003125,
                    "cache_hit_price": 0.0000031,
                    "currency": "USD"
                }
            }
        }

        # 创建临时目录用于测试
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            with patch('agentlang.context.application_context.ApplicationContext') as mock_app_context:
                mock_path_manager = MagicMock()
                mock_path_manager.get_project_root.return_value = temp_path
                mock_app_context.get_path_manager.return_value = mock_path_manager

                dynamic_config = DynamicConfig()

                # 测试全局配置中存在的模型
                defaults_existing = dynamic_config._get_model_defaults("claude-3.7-cache")

                # 验证使用了全局配置的价格信息
                self.assertEqual(defaults_existing["pricing"]["input_price"], 0.00025)
                self.assertEqual(defaults_existing["pricing"]["output_price"], 0.00125)
                self.assertEqual(defaults_existing["temperature"], 0.5)
                self.assertEqual(defaults_existing["max_output_tokens"], 100000)

                # 测试全局配置中不存在的模型
                defaults_new = dynamic_config._get_model_defaults("new-model")

                # 验证使用了兜底默认价格信息
                self.assertEqual(defaults_new["pricing"]["input_price"], 0.003)
                self.assertEqual(defaults_new["pricing"]["output_price"], 0.015)
                self.assertEqual(defaults_new["temperature"], 0.7)
                # 默认值是 8192 * 2 = 16384
                self.assertEqual(defaults_new["max_output_tokens"], 16384)


if __name__ == '__main__':
    unittest.main()
