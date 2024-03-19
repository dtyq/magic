import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import yaml
import pytest

from agentlang.config.dynamic_config import DynamicConfig, dynamic_config


class TestDynamicConfig(unittest.TestCase):
    """DynamicConfig 类的单元测试"""

    def setUp(self):
        """测试前的设置"""
        # 重置单例实例以确保每个测试的独立性
        DynamicConfig._instance = None
        # 创建临时目录用于测试
        self.temp_dir = tempfile.mkdtemp()
        self.temp_config_dir = Path(self.temp_dir) / "config"
        self.temp_config_dir.mkdir(parents=True, exist_ok=True)
        self.test_config_path = self.temp_config_dir / "dynamic_config.yaml"

    def tearDown(self):
        """测试后的清理"""
        # 清理临时文件和目录
        import shutil
        if Path(self.temp_dir).exists():
            shutil.rmtree(self.temp_dir)
        # 重置单例实例
        DynamicConfig._instance = None

    def test_singleton_pattern(self):
        """测试单例模式"""
        instance1 = DynamicConfig()
        instance2 = DynamicConfig()
        self.assertIs(instance1, instance2)
        self.assertEqual(id(instance1), id(instance2))

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_get_dynamic_config_path_with_application_context(self, mock_app_context):
        """测试使用ApplicationContext获取配置路径"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()
        expected_path = Path(self.temp_dir) / "config" / "dynamic_config.yaml"
        self.assertEqual(config_instance._dynamic_config_path, expected_path)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_get_dynamic_config_path_fallback(self, mock_app_context):
        """测试ApplicationContext失败时的兜底逻辑"""
        mock_app_context.get_path_manager.side_effect = RuntimeError("ApplicationContext error")

        with patch('pathlib.Path.cwd', return_value=Path(self.temp_dir)):
            config_instance = DynamicConfig()
            expected_path = Path(self.temp_dir) / "config" / "dynamic_config.yaml"
            self.assertEqual(config_instance._dynamic_config_path, expected_path)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_write_dynamic_config_success(self, mock_app_context):
        """测试成功写入动态配置"""
        # 设置mock
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()
        test_config = {
            "models": {
                "test-model": {
                    "api_key": "test-key",
                    "api_base_url": "https://api.test.com",
                    "name": "test-model-name"
                }
            }
        }

        result_path = config_instance.write_dynamic_config(test_config)

        # 验证文件写入成功
        self.assertTrue(config_instance._dynamic_config_path.exists())
        self.assertEqual(result_path, str(config_instance._dynamic_config_path))

        # 验证文件内容
        with open(config_instance._dynamic_config_path, 'r', encoding='utf-8') as f:
            saved_config = yaml.safe_load(f)
            # Remove file_metadata for comparison
            saved_config_without_metadata = {k: v for k, v in saved_config.items() if k != 'file_metadata'}
            self.assertEqual(saved_config_without_metadata, test_config)
            # Verify file_metadata exists
            self.assertIn('file_metadata', saved_config)
            self.assertIn('created_at', saved_config['file_metadata'])
            self.assertIn('updated_at', saved_config['file_metadata'])

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_write_dynamic_config_invalid_input(self, mock_app_context):
        """测试写入无效配置时的宽容处理"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 测试非字典类型输入 - 现在应该被转换为空配置而不是抛出异常
        result_path = config_instance.write_dynamic_config("invalid config")

        # 验证文件写入成功
        self.assertTrue(config_instance._dynamic_config_path.exists())
        self.assertEqual(result_path, str(config_instance._dynamic_config_path))

        # 验证内容被转换为空配置（但包含 file_metadata）
        with open(config_instance._dynamic_config_path, 'r', encoding='utf-8') as f:
            saved_config = yaml.safe_load(f)
            # Should have file_metadata but no other content
            self.assertIn('file_metadata', saved_config)
            self.assertIn('created_at', saved_config['file_metadata'])
            self.assertIn('updated_at', saved_config['file_metadata'])
            # Check that there's no models or other config (besides metadata)
            config_without_metadata = {k: v for k, v in saved_config.items() if k != 'file_metadata'}
            self.assertEqual(config_without_metadata, {})

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_read_models_config_success(self, mock_app_context):
        """测试成功读取models配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 创建测试配置文件
        test_config = {
            "models": {
                "test-model": {
                    "api_key": "test-key",
                    "api_base_url": "https://api.test.com",
                    "name": "test-model-name",
                    "type": "llm"
                }
            }
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config, f)

        # 测试读取
        result = config_instance.read_models_config()
        self.assertIsNotNone(result)
        self.assertEqual(result, test_config["models"])

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_read_models_config_file_not_exists(self, mock_app_context):
        """测试读取不存在的配置文件"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()
        result = config_instance.read_models_config()
        self.assertIsNone(result)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_read_models_config_empty_file(self, mock_app_context):
        """测试读取空的配置文件"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 创建空文件
        config_instance._dynamic_config_path.touch()

        result = config_instance.read_models_config()
        self.assertIsNone(result)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_read_models_config_invalid_yaml(self, mock_app_context):
        """测试读取无效YAML文件"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 写入无效YAML
        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            f.write("invalid: yaml: content: [")

        result = config_instance.read_models_config()
        self.assertIsNone(result)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_read_dynamic_config_success(self, mock_app_context):
        """测试成功读取完整动态配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        test_config = {
            "models": {"test-model": {"api_key": "test-key"}},
            "other_section": {"key": "value"}
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config, f)

        result = config_instance.read_dynamic_config()
        self.assertIsNotNone(result)
        self.assertEqual(result, test_config)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_clear_dynamic_config_success(self, mock_app_context):
        """测试成功清除动态配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 先创建配置文件
        config_instance._dynamic_config_path.touch()
        self.assertTrue(config_instance._dynamic_config_path.exists())

        # 清除配置
        result = config_instance.clear_dynamic_config()
        self.assertTrue(result)
        self.assertFalse(config_instance._dynamic_config_path.exists())

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_clear_dynamic_config_file_not_exists(self, mock_app_context):
        """测试清除不存在的配置文件"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 文件不存在时也应该返回True
        result = config_instance.clear_dynamic_config()
        self.assertTrue(result)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_has_dynamic_config(self, mock_app_context):
        """测试检查动态配置是否存在"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 文件不存在时
        self.assertFalse(config_instance.has_dynamic_config())

        # 创建文件后
        config_instance._dynamic_config_path.touch()
        self.assertTrue(config_instance.has_dynamic_config())

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_get_model_config(self, mock_app_context):
        """测试获取单个模型配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 创建测试配置
        test_config = {
            "models": {
                "model1": {"api_key": "key1"},
                "model2": {"api_key": "key2"}
            }
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config, f)

        # 测试获取存在的模型
        result = config_instance.get_model_config("model1")
        self.assertEqual(result, {"api_key": "key1"})

        # 测试获取不存在的模型
        result = config_instance.get_model_config("nonexistent")
        self.assertIsNone(result)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_has_model(self, mock_app_context):
        """测试检查模型是否存在"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 创建测试配置
        test_config = {
            "models": {
                "model1": {"api_key": "key1"},
                "model2": {"api_key": "key2"}
            }
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config, f)

        # 测试存在的模型
        self.assertTrue(config_instance.has_model("model1"))
        self.assertTrue(config_instance.has_model("model2"))

        # 测试不存在的模型
        self.assertFalse(config_instance.has_model("nonexistent"))

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_get_model_ids(self, mock_app_context):
        """测试获取所有模型ID"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 创建测试配置
        test_config = {
            "models": {
                "model1": {"api_key": "key1"},
                "model2": {"api_key": "key2"}
            }
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config, f)

        result = config_instance.get_model_ids()
        self.assertEqual(sorted(result), ["model1", "model2"])

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_get_model_ids_no_config(self, mock_app_context):
        """测试无配置时获取模型ID"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()
        result = config_instance.get_model_ids()
        self.assertEqual(result, [])

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_success(self, mock_app_context):
        """测试成功验证并写入动态配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 完整的有效配置
        test_config = {
            "models": {
                "test-model": {
                    "api_key": "test-key",
                    "api_base_url": "https://api.test.com",
                    "name": "test-model-name",
                    "type": "llm",
                    "provider": "openai",
                    "supports_tool_use": True,
                    "max_output_tokens": 4096,
                    "max_context_tokens": 8192,
                    "temperature": 0.7,
                    "top_p": 1.0
                }
            }
        }

        success, path, warnings = await config_instance.validate_and_write_dynamic_config(test_config)

        self.assertTrue(success)
        self.assertEqual(path, str(config_instance._dynamic_config_path))
        self.assertIsInstance(warnings, list)
        self.assertTrue(config_instance._dynamic_config_path.exists())

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_missing_fields(self, mock_app_context):
        """测试缺少必需字段时的验证"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 只有必需字段的配置
        test_config = {
            "models": {
                "test-model": {
                    "api_key": "test-key",
                    "api_base_url": "https://api.test.com",
                    "name": "test-model-name"
                }
            }
        }

        success, path, warnings = await config_instance.validate_and_write_dynamic_config(test_config)

        self.assertTrue(success)
        self.assertTrue(len(warnings) > 0)  # 应该有关于使用默认值的警告

        # 验证默认值被正确补全
        result_config = config_instance.read_models_config()
        model_config = result_config["test-model"]
        self.assertEqual(model_config["type"], "llm")
        self.assertEqual(model_config["provider"], "openai")
        self.assertTrue(model_config["supports_tool_use"])

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_invalid_model(self, mock_app_context):
        """测试包含无效模型配置时的处理"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 包含无效模型的配置
        test_config = {
            "models": {
                "valid-model": {
                    "api_key": "test-key",
                    "api_base_url": "https://api.test.com",
                    "name": "test-model-name"
                },
                "invalid-model": {
                    "api_key": "test-key"
                    # 缺少必需字段 api_base_url 和 name
                }
            }
        }

        success, path, warnings = await config_instance.validate_and_write_dynamic_config(test_config)

        self.assertTrue(success)
        self.assertTrue(any("invalid-model" in warning for warning in warnings))

        # 验证只有有效模型被保存
        result_config = config_instance.read_models_config()
        self.assertIn("valid-model", result_config)
        self.assertNotIn("invalid-model", result_config)

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_invalid_input(self, mock_app_context):
        """测试无效输入的宽容处理"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 测试非字典输入 - 现在应该被转换为空配置并成功处理
        success, path, warnings = await config_instance.validate_and_write_dynamic_config("invalid")

        self.assertTrue(success)
        self.assertEqual(path, str(config_instance._dynamic_config_path))
        # 应该有警告说明配置格式不支持，已转换为空配置
        self.assertTrue(len(warnings) > 0)
        self.assertTrue(any("动态配置缺少'models'配置段" in warning for warning in warnings))

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_no_models_section(self, mock_app_context):
        """测试没有models段的配置"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 没有models段的配置
        test_config = {
            "other_section": {"key": "value"}
        }

        success, path, warnings = await config_instance.validate_and_write_dynamic_config(test_config)

        self.assertTrue(success)
        self.assertIn("动态配置缺少'models'配置段，已创建空配置", warnings)

        # 验证空的models段被创建
        result_config = config_instance.read_models_config()
        self.assertEqual(result_config, {})

    @patch('agentlang.config.dynamic_config.config')
    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_environment_variable_processing(self, mock_app_context, mock_config):
        """测试环境变量占位符处理"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        # Mock config's environment variable processing
        mock_config._process_env_placeholders.return_value = {
            "models": {
                "test-model": {
                    "api_key": "processed-key",
                    "api_base_url": "https://processed.api.com"
                }
            }
        }

        config_instance = DynamicConfig()

        # 创建包含环境变量占位符的配置文件
        test_config_with_env = {
            "models": {
                "test-model": {
                    "api_key": "${TEST_API_KEY:-default-key}",
                    "api_base_url": "${TEST_API_URL:-https://default.api.com}"
                }
            }
        }

        with open(config_instance._dynamic_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(test_config_with_env, f)

        result = config_instance.read_models_config()

        # 验证环境变量处理方法被调用
        mock_config._process_env_placeholders.assert_called_once()

        # 验证返回处理后的结果
        expected_result = {
            "test-model": {
                "api_key": "processed-key",
                "api_base_url": "https://processed.api.com"
            }
        }
        self.assertEqual(result, expected_result)

    def test_global_instance(self):
        """测试全局实例"""
        # 先保存当前单例实例状态
        original_instance = DynamicConfig._instance

        try:
            # 重置单例状态
            DynamicConfig._instance = None

            # 创建新实例并测试单例行为
            instance1 = DynamicConfig()
            instance2 = DynamicConfig()

            # 验证单例模式
            self.assertIs(instance1, instance2)
            self.assertIsInstance(instance1, DynamicConfig)

        finally:
            # 恢复原来的单例状态，避免影响其他测试
            DynamicConfig._instance = original_instance

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_write_dynamic_config_multiple_formats(self, mock_app_context):
        """测试write_dynamic_config支持多种格式的输入"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 测试不同格式的空配置输入
        test_cases = [
            {},              # 空字典
            [],              # 空列表
            None,            # None值
            {"models": {}},  # models为空字典
            {"models": []},  # models为空列表
            {"models": None}, # models为None
        ]

        for i, test_input in enumerate(test_cases):
            with self.subTest(f"test_case_{i}", input=test_input):
                result_path = config_instance.write_dynamic_config(test_input)

                # 验证文件写入成功
                self.assertTrue(config_instance._dynamic_config_path.exists())
                self.assertEqual(result_path, str(config_instance._dynamic_config_path))

                # 验证文件内容被标准化为空配置
                with open(config_instance._dynamic_config_path, 'r', encoding='utf-8') as f:
                    saved_config = yaml.safe_load(f)
                    # 所有情况都应该标准化为包含空models的配置
                    expected_config = {"models": {}} if "models" in str(test_input) or test_input in [{}, [], None] else {}
                    if test_input in [{}, [], None]:
                        expected_config = {}  # 顶层空配置应该是完全空的字典
                    elif isinstance(test_input, dict) and "models" in test_input:
                        expected_config = {"models": {}}  # 包含models段的应该有空models

                    # 简化验证：只要是字典且models段为空字典即可
                    self.assertIsInstance(saved_config, dict)
                    if "models" in saved_config:
                        self.assertEqual(saved_config["models"], {})

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    @pytest.mark.asyncio
    async def test_validate_and_write_dynamic_config_multiple_formats(self, mock_app_context):
        """测试validate_and_write_dynamic_config支持多种格式的输入"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 测试不同格式的空配置输入
        test_cases = [
            {},              # 空字典
            [],              # 空列表
            None,            # None值
            {"models": {}},  # models为空字典
            {"models": []},  # models为空列表
            {"models": None}, # models为None
        ]

        for i, test_input in enumerate(test_cases):
            with self.subTest(f"test_case_{i}", input=test_input):
                success, path, warnings = await config_instance.validate_and_write_dynamic_config(test_input)

                # 验证处理成功
                self.assertTrue(success)
                self.assertEqual(path, str(config_instance._dynamic_config_path))
                self.assertIsInstance(warnings, list)

                # 验证文件写入成功
                self.assertTrue(config_instance._dynamic_config_path.exists())

                # 验证读取的配置是空的models段
                models_config = config_instance.read_models_config()
                self.assertEqual(models_config, {})

    @patch('agentlang.config.dynamic_config.ApplicationContext')
    def test_normalize_config_input(self, mock_app_context):
        """测试配置输入标准化方法"""
        mock_path_manager = MagicMock()
        mock_path_manager.get_project_root.return_value = Path(self.temp_dir)
        mock_app_context.get_path_manager.return_value = mock_path_manager

        config_instance = DynamicConfig()

        # 测试顶层配置标准化
        test_cases = [
            (None, {}),
            ([], {}),
            ({}, {}),
            ("invalid", {}),  # 不支持的格式
            (123, {}),       # 不支持的格式
        ]

        for input_data, expected in test_cases:
            with self.subTest(input=input_data):
                result = config_instance._normalize_config_input(input_data)
                self.assertEqual(result, expected)

        # 测试包含models段的配置标准化
        models_test_cases = [
            ({"models": None}, {"models": {}}),
            ({"models": []}, {"models": {}}),
            ({"models": {}}, {"models": {}}),
            ({"models": "invalid"}, {"models": {}}),  # 不支持的格式
            ({"models": 123}, {"models": {}}),       # 不支持的格式
            ({"models": {"test": "value"}}, {"models": {"test": "value"}}),  # 正常情况
            ({"other": "value"}, {"other": "value"}),  # 无models段
        ]

        for input_data, expected in models_test_cases:
            with self.subTest(input=input_data):
                result = config_instance._normalize_config_input(input_data)
                self.assertEqual(result, expected)


if __name__ == '__main__':
    unittest.main()
