"""
@env 语法处理器单元测试模块

测试 EnvProcessor 的完整功能，包括：
- 环境变量读取功能
- 默认值处理
- 参数解析（位置参数和键值对参数）
- 错误处理和边界情况
"""

import os
import unittest
from unittest.mock import patch

from agentlang.agent.processors import EnvProcessor


class TestEnvProcessor(unittest.TestCase):
    """@env 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.processor = EnvProcessor()

    def test_get_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "env")

    def test_get_positional_param_mapping(self):
        """测试位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["key", "default"])

    def test_process_existing_env_var(self):
        """测试已存在的环境变量"""
        with patch.dict(os.environ, {'TEST_VAR': 'test_value'}):
            params = {'key': 'TEST_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, 'test_value')

    def test_process_positional_params(self):
        """测试位置参数"""
        with patch.dict(os.environ, {'TEST_VAR': 'test_value'}):
            params = {'_pos_0': 'TEST_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, 'test_value')

    def test_process_with_default_value(self):
        """测试使用默认值"""
        with patch.dict(os.environ, {}, clear=True):
            params = {'key': 'NONEXISTENT_VAR', 'default': 'default_value'}
            result = self.processor.process(params)
            self.assertEqual(result, 'default_value')

    def test_process_positional_with_default(self):
        """测试位置参数带默认值"""
        with patch.dict(os.environ, {}, clear=True):
            params = {'_pos_0': 'NONEXISTENT_VAR', '_pos_1': 'default_value'}
            result = self.processor.process(params)
            self.assertEqual(result, 'default_value')

    def test_process_missing_env_var_no_default(self):
        """测试缺少环境变量且无默认值"""
        with patch.dict(os.environ, {}, clear=True):
            params = {'key': 'NONEXISTENT_VAR'}

            with self.assertRaises(ValueError) as context:
                self.processor.process(params)

            self.assertIn("环境变量 NONEXISTENT_VAR 不存在且未提供默认值", str(context.exception))

    def test_process_missing_key_param(self):
        """测试缺少key参数"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("缺少必需参数: key", str(context.exception))

    def test_process_empty_env_var(self):
        """测试空的环境变量"""
        with patch.dict(os.environ, {'EMPTY_VAR': ''}):
            params = {'key': 'EMPTY_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, '')

    def test_process_numeric_env_var(self):
        """测试数值型环境变量"""
        with patch.dict(os.environ, {'NUMERIC_VAR': '123'}):
            params = {'key': 'NUMERIC_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, '123')

    def test_process_special_chars_env_var(self):
        """测试包含特殊字符的环境变量"""
        with patch.dict(os.environ, {'SPECIAL_VAR': 'hello world!@#$%^&*()'}):
            params = {'key': 'SPECIAL_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, 'hello world!@#$%^&*()')

    def test_process_multiline_env_var(self):
        """测试多行环境变量"""
        multiline_value = "line1\nline2\nline3"
        with patch.dict(os.environ, {'MULTILINE_VAR': multiline_value}):
            params = {'key': 'MULTILINE_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, multiline_value)

    def test_process_unicode_env_var(self):
        """测试Unicode环境变量"""
        unicode_value = "你好世界 🌍"
        with patch.dict(os.environ, {'UNICODE_VAR': unicode_value}):
            params = {'key': 'UNICODE_VAR'}
            result = self.processor.process(params)
            self.assertEqual(result, unicode_value)

    def test_process_env_var_override_default(self):
        """测试环境变量覆盖默认值"""
        with patch.dict(os.environ, {'EXISTS_VAR': 'actual_value'}):
            params = {'key': 'EXISTS_VAR', 'default': 'default_value'}
            result = self.processor.process(params)
            self.assertEqual(result, 'actual_value')  # 应该使用环境变量值，不是默认值

    def test_process_case_sensitive_keys(self):
        """测试键名大小写敏感"""
        with patch.dict(os.environ, {'test_var': 'lowercase', 'TEST_VAR': 'uppercase'}):
            # 测试小写键
            params1 = {'key': 'test_var'}
            result1 = self.processor.process(params1)
            self.assertEqual(result1, 'lowercase')

            # 测试大写键
            params2 = {'key': 'TEST_VAR'}
            result2 = self.processor.process(params2)
            self.assertEqual(result2, 'uppercase')


if __name__ == '__main__':
    unittest.main()
