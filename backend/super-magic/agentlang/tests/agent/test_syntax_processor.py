"""
语法处理器单元测试模块

测试 AgentLang 语法处理系统的完整功能，包括：
- SyntaxProcessor 主处理器
- 所有语法处理器：@include, @env, @config, @shell, @variable
- 参数解析：位置参数和键值对参数
- 错误处理和边界情况
"""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, mock_open, Mock

from agentlang.agent.processors import BaseSyntaxProcessor, ConfigProcessor, EnvProcessor, IncludeProcessor, ShellProcessor, VariableProcessor
from agentlang.agent.syntax import SyntaxProcessor
from agentlang.config import config


class TestSyntaxProcessor(unittest.TestCase):
    """SyntaxProcessor 主处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.processor = SyntaxProcessor(self.temp_dir)

    def tearDown(self):
        """清理测试环境"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_register_default_processors(self):
        """测试默认语法处理器注册"""
        registered = self.processor.get_registered_syntaxes()
        expected_syntaxes = ['include', 'env', 'config', 'shell', 'variable']

        for syntax in expected_syntaxes:
            self.assertIn(syntax, registered)

    def test_register_custom_processor(self):
        """测试自定义语法处理器注册"""
        class CustomProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "custom_result"

            def get_syntax_name(self):
                return "custom"

        custom_processor = CustomProcessor()
        self.processor.register_processor(custom_processor)

        self.assertIn('custom', self.processor.get_registered_syntaxes())

        # 测试处理自定义语法
        result = self.processor.process_dynamic_syntax('{{ @custom() }}')
        self.assertEqual(result, 'custom_result')

    def test_unregister_processor(self):
        """测试注销语法处理器"""
        # 注销 include 处理器
        self.processor.unregister_processor('include')

        # 验证已被注销
        self.assertNotIn('include', self.processor.get_registered_syntaxes())

        # 验证注销后的处理器不能使用
        with self.assertRaises(RuntimeError) as context:
            self.processor.process_dynamic_syntax('{{ @include("test.md") }}')

        self.assertIn("不支持的语法: @include", str(context.exception))

    def test_set_variables(self):
        """测试设置变量"""
        variables = {
            'test_var': 'test_value',
            'number_var': 123,
            'bool_var': True
        }

        self.processor.set_variables(variables)

        # 验证变量设置成功
        result = self.processor.process_dynamic_syntax('{{ @variable("test_var") }}')
        self.assertEqual(result, 'test_value')

    def test_parse_syntax_call_basic(self):
        """测试基本语法调用解析"""
        # 测试键值对参数
        syntax_name, params = self.processor._parse_syntax_call('@include(path="test.md")')
        self.assertEqual(syntax_name, 'include')
        self.assertEqual(params, {'path': 'test.md'})

        # 测试位置参数
        syntax_name, params = self.processor._parse_syntax_call('@variable("test_var")')
        self.assertEqual(syntax_name, 'variable')
        self.assertEqual(params, {'_pos_0': 'test_var'})

    def test_parse_syntax_call_complex(self):
        """测试复杂语法调用解析"""
        # 测试混合参数
        syntax_name, params = self.processor._parse_syntax_call('@env("API_KEY", default="fallback")')
        self.assertEqual(syntax_name, 'env')
        expected_params = {'_pos_0': 'API_KEY', 'default': 'fallback'}
        self.assertEqual(params, expected_params)

        # 测试多个键值对参数
        syntax_name, params = self.processor._parse_syntax_call('@config(key="model.temperature", default="0.7")')
        self.assertEqual(syntax_name, 'config')
        expected_params = {'key': 'model.temperature', 'default': '0.7'}
        self.assertEqual(params, expected_params)

    def test_parse_syntax_call_invalid_format(self):
        """测试无效语法格式"""
        invalid_cases = [
            'include(path="test.md")',  # 缺少 @
            '@include path="test.md"',  # 缺少括号
            '@include(path="test.md"',  # 缺少右括号
            'include path="test.md")',  # 缺少 @ 和左括号
            '@include[path="test.md"]',  # 错误的括号类型
        ]

        for invalid_case in invalid_cases:
            with self.assertRaises(SyntaxError) as context:
                self.processor._parse_syntax_call(invalid_case)
            self.assertIn("语法格式错误", str(context.exception))

    def test_parse_parameters_positional(self):
        """测试位置参数解析"""
        # 单个位置参数
        params = self.processor._parse_parameters('"value1"')
        self.assertEqual(params, {'_pos_0': 'value1'})

        # 多个位置参数
        params = self.processor._parse_parameters('"value1", "value2", "value3"')
        expected = {'_pos_0': 'value1', '_pos_1': 'value2', '_pos_2': 'value3'}
        self.assertEqual(params, expected)

        # 单引号格式
        params = self.processor._parse_parameters("'value1', 'value2'")
        expected = {'_pos_0': 'value1', '_pos_1': 'value2'}
        self.assertEqual(params, expected)

    def test_parse_parameters_keyword(self):
        """测试键值对参数解析"""
        # 单个键值对
        params = self.processor._parse_parameters('key="value"')
        self.assertEqual(params, {'key': 'value'})

        # 多个键值对
        params = self.processor._parse_parameters('key1="value1", key2="value2"')
        expected = {'key1': 'value1', 'key2': 'value2'}
        self.assertEqual(params, expected)

        # 单引号格式
        params = self.processor._parse_parameters("key='value'")
        self.assertEqual(params, {'key': 'value'})

    def test_parse_parameters_mixed(self):
        """测试混合参数解析"""
        # 位置参数 + 键值对参数
        params = self.processor._parse_parameters('"pos_value", key="kv_value"')
        expected = {'_pos_0': 'pos_value', 'key': 'kv_value'}
        self.assertEqual(params, expected)

        # 多个位置参数 + 多个键值对参数
        params = self.processor._parse_parameters('"pos1", "pos2", key1="kv1", key2="kv2"')
        expected = {
            '_pos_0': 'pos1', '_pos_1': 'pos2',
            'key1': 'kv1', 'key2': 'kv2'
        }
        self.assertEqual(params, expected)

    def test_parse_parameters_empty(self):
        """测试空参数解析"""
        params = self.processor._parse_parameters('')
        self.assertEqual(params, {})

        params = self.processor._parse_parameters('   ')
        self.assertEqual(params, {})

    def test_process_dynamic_syntax_single(self):
        """测试单个动态语法处理"""
        # 设置变量
        self.processor.set_variables({'test_var': 'test_value'})

        # 测试单个语法块
        result = self.processor.process_dynamic_syntax('前缀 {{ @variable("test_var") }} 后缀')
        self.assertEqual(result, '前缀 test_value 后缀')

    def test_process_dynamic_syntax_multiple(self):
        """测试多个动态语法处理"""
        # 设置变量和环境变量
        self.processor.set_variables({'var1': 'value1', 'var2': 'value2'})

        with patch.dict(os.environ, {'ENV_VAR': 'env_value'}):
            template = '开始 {{ @variable("var1") }} 中间 {{ @env("ENV_VAR") }} 结束 {{ @variable("var2") }}'
            result = self.processor.process_dynamic_syntax(template)
            expected = '开始 value1 中间 env_value 结束 value2'
            self.assertEqual(result, expected)

    def test_process_dynamic_syntax_nested_not_supported(self):
        """测试嵌套语法（不支持）"""
        # 当前实现不支持嵌套语法，应该正常处理外层语法
        self.processor.set_variables({'inner': '@variable("test")', 'test': 'value'})

        result = self.processor.process_dynamic_syntax('{{ @variable("inner") }}')
        self.assertEqual(result, '@variable("test")')  # 返回字面量，不处理嵌套

    def test_process_dynamic_syntax_unsupported_syntax(self):
        """测试不支持的语法"""
        with self.assertRaises(RuntimeError) as context:
            self.processor.process_dynamic_syntax('{{ @unsupported("param") }}')

        self.assertIn("不支持的语法: @unsupported", str(context.exception))

    def test_process_dynamic_syntax_invalid_format(self):
        """测试无效的语法格式"""
        invalid_cases = [
            '{{ invalid("param") }}',  # 缺少 @
            '{{ @invalid param }}',     # 缺少括号
            '{{ @invalid( }}',          # 不完整的括号
        ]

        for invalid_case in invalid_cases:
            with self.assertRaises(RuntimeError):
                self.processor.process_dynamic_syntax(invalid_case)


class TestIncludeProcessor(unittest.TestCase):
    """@include 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.processor = IncludeProcessor(self.temp_dir)

        # 创建测试文件
        self.test_file = self.temp_dir / "test.md"
        self.test_file.write_text("# 测试内容\n这是包含的文件内容。", encoding='utf-8')

        # 创建子目录和文件
        self.sub_dir = self.temp_dir / "prompts"
        self.sub_dir.mkdir()
        self.sub_file = self.sub_dir / "prompt.md"
        self.sub_file.write_text("模板内容", encoding='utf-8')

    def tearDown(self):
        """清理测试环境"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_get_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "include")

    def test_get_positional_param_mapping(self):
        """测试位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["path", "extension"])

    def test_process_keyword_params(self):
        """测试键值对参数处理"""
        params = {'path': 'test.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "# 测试内容\n这是包含的文件内容。")

    def test_process_positional_params(self):
        """测试位置参数处理"""
        params = {'_pos_0': 'test.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "# 测试内容\n这是包含的文件内容。")

    def test_process_relative_path(self):
        """测试相对路径处理"""
        params = {'path': 'prompts/prompt.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "模板内容")

    def test_process_missing_path_param(self):
        """测试缺少path参数"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("缺少必需参数: path", str(context.exception))

    def test_process_file_not_found(self):
        """测试文件不存在"""
        params = {'path': 'nonexistent.md'}

        with self.assertRaises(FileNotFoundError) as context:
            self.processor.process(params)

        self.assertIn("包含文件不存在", str(context.exception))

    def test_process_file_read_error(self):
        """测试文件读取错误"""
        # 创建一个目录而不是文件，模拟读取错误
        error_path = self.temp_dir / "error_file"
        error_path.mkdir()

        params = {'path': 'error_file'}

        with self.assertRaises(FileNotFoundError) as context:
            self.processor.process(params)

        self.assertIn("包含文件不存在", str(context.exception))

    def test_process_absolute_path(self):
        """测试绝对路径处理"""
        absolute_file = self.temp_dir / "absolute.md"
        absolute_file.write_text("绝对路径内容", encoding='utf-8')

        params = {'path': str(absolute_file)}
        result = self.processor.process(params)
        self.assertEqual(result, "绝对路径内容")


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


class TestConfigProcessor(unittest.TestCase):
    """@config 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.processor = ConfigProcessor()

    def test_get_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "config")

    def test_get_positional_param_mapping(self):
        """测试位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["key", "default"])

    @patch.object(config, 'get')
    def test_process_existing_config(self, mock_get):
        """测试已存在的配置"""
        mock_get.return_value = 'config_value'

        params = {'key': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, 'config_value')
        mock_get.assert_called_once_with('model.temperature', None)

    @patch.object(config, 'get')
    def test_process_positional_params(self, mock_get):
        """测试位置参数"""
        mock_get.return_value = 'config_value'

        params = {'_pos_0': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, 'config_value')
        mock_get.assert_called_once_with('model.temperature', None)

    @patch.object(config, 'get')
    def test_process_with_default_value(self, mock_get):
        """测试使用默认值"""
        mock_get.return_value = 'default_value'

        params = {'key': 'nonexistent.config', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    @patch.object(config, 'get')
    def test_process_positional_with_default(self, mock_get):
        """测试位置参数带默认值"""
        mock_get.return_value = 'default_value'

        params = {'_pos_0': 'nonexistent.config', '_pos_1': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    @patch.object(config, 'get')
    def test_process_missing_config_no_default(self, mock_get):
        """测试缺少配置且无默认值"""
        mock_get.return_value = None

        params = {'key': 'nonexistent.config'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("配置 nonexistent.config 不存在且未提供默认值", str(context.exception))

    def test_process_missing_key_param(self):
        """测试缺少key参数"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("缺少必需参数: key", str(context.exception))

    @patch.object(config, 'get')
    def test_process_numeric_config(self, mock_get):
        """测试数值型配置"""
        mock_get.return_value = 0.7

        params = {'key': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, '0.7')

    @patch.object(config, 'get')
    def test_process_boolean_config(self, mock_get):
        """测试布尔型配置"""
        mock_get.return_value = True

        params = {'key': 'feature.enabled'}
        result = self.processor.process(params)
        self.assertEqual(result, 'True')


class TestVariableProcessor(unittest.TestCase):
    """@variable 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.variables = {
            'string_var': 'test_value',
            'number_var': 123,
            'boolean_var': True,
            'empty_var': '',
        }
        self.processor = VariableProcessor(variables=self.variables)

    def test_get_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "variable")

    def test_get_positional_param_mapping(self):
        """测试位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["key", "default"])

    def test_process_existing_variable(self):
        """测试已存在的变量"""
        params = {'key': 'string_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'test_value')

    def test_process_positional_params(self):
        """测试位置参数"""
        params = {'_pos_0': 'string_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'test_value')

    def test_process_numeric_variable(self):
        """测试数值变量"""
        params = {'key': 'number_var'}
        result = self.processor.process(params)
        self.assertEqual(result, '123')

    def test_process_boolean_variable(self):
        """测试布尔变量"""
        params = {'key': 'boolean_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'True')

    def test_process_empty_variable(self):
        """测试空变量"""
        params = {'key': 'empty_var'}
        result = self.processor.process(params)
        self.assertEqual(result, '')

    def test_process_with_default_value(self):
        """测试使用默认值"""
        params = {'key': 'nonexistent_var', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    def test_process_positional_with_default(self):
        """测试位置参数带默认值"""
        params = {'_pos_0': 'nonexistent_var', '_pos_1': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    def test_process_missing_variable_no_default(self):
        """测试缺少变量且无默认值"""
        params = {'key': 'nonexistent_var'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("变量 nonexistent_var 不存在且未提供默认值", str(context.exception))

    def test_process_missing_key_param(self):
        """测试缺少key参数"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("缺少必需参数: key", str(context.exception))

    def test_update_variables(self):
        """测试更新变量"""
        new_variables = {'new_var': 'new_value'}
        self.processor.update_variables(new_variables)

        params = {'key': 'new_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'new_value')

        # 原变量应该不存在了
        params = {'key': 'string_var'}
        with self.assertRaises(ValueError):
            self.processor.process(params)

    def test_update_variables_none(self):
        """测试更新为None变量"""
        self.processor.update_variables(None)

        params = {'key': 'any_var', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')


class TestShellProcessor(unittest.TestCase):
    """@shell 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.processor = ShellProcessor()

    def test_get_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "shell")

    def test_get_positional_param_mapping(self):
        """测试位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["command", "timeout"])

    @patch('subprocess.run')
    def test_process_keyword_params(self, mock_run):
        """测试键值对参数处理"""
        # 模拟成功的命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "test output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo hello'}
        result = self.processor.process(params)

        self.assertEqual(result, "test output")
        mock_run.assert_called_once_with(
            'echo hello',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_positional_params(self, mock_run):
        """测试位置参数处理"""
        # 模拟成功的命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "ls output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'_pos_0': 'ls -la'}
        result = self.processor.process(params)

        self.assertEqual(result, "ls output")
        mock_run.assert_called_once_with(
            'ls -la',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_with_timeout(self, mock_run):
        """测试带超时参数的处理"""
        # 模拟成功的命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "command output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'sleep 1', 'timeout': '5'}
        result = self.processor.process(params)

        self.assertEqual(result, "command output")
        mock_run.assert_called_once_with(
            'sleep 1',
            shell=True,
            capture_output=True,
            text=True,
            timeout=5.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_positional_with_timeout(self, mock_run):
        """测试位置参数带超时"""
        # 模拟成功的命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'_pos_0': 'echo test', '_pos_1': '10'}
        result = self.processor.process(params)

        self.assertEqual(result, "output")
        mock_run.assert_called_once_with(
            'echo test',
            shell=True,
            capture_output=True,
            text=True,
            timeout=10.0,
            encoding='utf-8',
            errors='replace'
        )

    def test_process_missing_command_param(self):
        """测试缺少command参数"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("缺少必需参数: command", str(context.exception))

    @patch('subprocess.run')
    def test_process_invalid_timeout(self, mock_run):
        """测试无效的超时参数"""
        # 模拟成功的命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo test', 'timeout': 'invalid'}
        result = self.processor.process(params)

        # 应该使用默认超时值30秒
        mock_run.assert_called_once_with(
            'echo test',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_command_failure(self, mock_run):
        """测试命令执行失败"""
        # 模拟命令执行失败
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "command not found\n"
        mock_run.return_value = mock_result

        params = {'command': 'invalid_command'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("Shell命令执行失败: command not found", str(context.exception))

    @patch('subprocess.run')
    def test_process_command_timeout(self, mock_run):
        """测试命令执行超时"""
        # 模拟超时异常
        mock_run.side_effect = subprocess.TimeoutExpired('sleep 10', 1)

        params = {'command': 'sleep 10', 'timeout': '1'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("Shell命令执行超时 (1.0秒)", str(context.exception))

    @patch('subprocess.run')
    def test_process_subprocess_exception(self, mock_run):
        """测试subprocess异常"""
        # 模拟其他异常
        mock_run.side_effect = OSError("Permission denied")

        params = {'command': 'echo test'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("Shell命令执行异常: Permission denied", str(context.exception))

    @patch('subprocess.run')
    def test_process_empty_output(self, mock_run):
        """测试空输出的命令"""
        # 模拟空输出的成功命令
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "\n\n"  # 只有空白字符
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'true'}  # 返回成功但无输出的命令
        result = self.processor.process(params)

        self.assertEqual(result, "")  # 应该返回空字符串

    @patch('subprocess.run')
    def test_process_multiline_output(self, mock_run):
        """测试多行输出"""
        # 模拟多行输出
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "line1\nline2\nline3\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo -e "line1\\nline2\\nline3"'}
        result = self.processor.process(params)

        self.assertEqual(result, "line1\nline2\nline3")


class TestBaseSyntaxProcessor(unittest.TestCase):
    """BaseSyntaxProcessor 基类测试"""

    def setUp(self):
        """设置测试环境"""
        class TestProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test_result"

        self.processor = TestProcessor()

    def test_get_syntax_name_default(self):
        """测试默认语法名称生成"""
        # 测试类名为 TestProcessor，应该返回 'test'
        self.assertEqual(self.processor.get_syntax_name(), "test")

    def test_get_positional_param_mapping_default(self):
        """测试默认位置参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, [])

    def test_merge_positional_params_empty(self):
        """测试空参数合并"""
        result = self.processor.merge_positional_params({})
        self.assertEqual(result, {})

    def test_merge_positional_params_only_keyword(self):
        """测试仅有键值对参数"""
        params = {'key1': 'value1', 'key2': 'value2'}
        result = self.processor.merge_positional_params(params)
        self.assertEqual(result, params)

    def test_merge_positional_params_with_mapping(self):
        """测试带映射的位置参数合并"""
        class MappedProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test"

            def get_positional_param_mapping(self):
                return ["first", "second"]

        processor = MappedProcessor()
        params = {'_pos_0': 'value1', '_pos_1': 'value2', 'key': 'value3'}
        result = processor.merge_positional_params(params)

        expected = {'first': 'value1', 'second': 'value2', 'key': 'value3'}
        self.assertEqual(result, expected)

    def test_merge_positional_params_keyword_override(self):
        """测试键值对参数覆盖位置参数"""
        class MappedProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test"

            def get_positional_param_mapping(self):
                return ["key"]

        processor = MappedProcessor()
        params = {'_pos_0': 'pos_value', 'key': 'kw_value'}
        result = processor.merge_positional_params(params)

        # 键值对参数应该覆盖位置参数
        expected = {'key': 'kw_value'}
        self.assertEqual(result, expected)

    def test_validate_params_success(self):
        """测试参数验证成功"""
        params = {'required1': 'value1', 'required2': 'value2', 'optional1': 'value3'}
        required_keys = ['required1', 'required2']
        optional_keys = ['optional1', 'optional2']

        # 应该不抛出异常
        self.processor.validate_params(params, required_keys, optional_keys)

    def test_validate_params_missing_required(self):
        """测试缺少必需参数"""
        params = {'required1': 'value1'}
        required_keys = ['required1', 'required2']

        with self.assertRaises(ValueError) as context:
            self.processor.validate_params(params, required_keys)

        self.assertIn("缺少必需参数: required2", str(context.exception))

    def test_validate_params_invalid_params(self):
        """测试无效参数"""
        params = {'required1': 'value1', 'invalid': 'value2'}
        required_keys = ['required1']
        optional_keys = ['optional1']

        with self.assertRaises(ValueError) as context:
            self.processor.validate_params(params, required_keys, optional_keys)

        self.assertIn("无效参数: invalid", str(context.exception))

    def test_validate_params_no_optional_check(self):
        """测试不检查可选参数"""
        params = {'required1': 'value1', 'any_param': 'value2'}
        required_keys = ['required1']

        # 不传入 optional_keys，应该不检查无效参数
        self.processor.validate_params(params, required_keys)

    def test_resolve_path_relative(self):
        """测试相对路径解析"""
        temp_dir = Path(tempfile.mkdtemp())

        class TestProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test"

        processor = TestProcessor(temp_dir)

        try:
            result = processor.resolve_path("test/file.md")
            expected = temp_dir / "test/file.md"
            self.assertEqual(result, expected)
        finally:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_resolve_path_absolute(self):
        """测试绝对路径解析"""
        class TestProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test"

        processor = TestProcessor()

        result = processor.resolve_path("/absolute/path/file.md")
        expected = Path("/absolute/path/file.md")
        self.assertEqual(result, expected)

    def test_resolve_path_no_agents_dir(self):
        """测试无agents_dir时的路径解析"""
        class TestProcessor(BaseSyntaxProcessor):
            def _run(self):
                return "test"

        processor = TestProcessor()

        result = processor.resolve_path("relative/path.md")
        expected = Path("relative/path.md")
        self.assertEqual(result, expected)


class TestIntegration(unittest.TestCase):
    """集成测试 - 测试完整的语法处理流程"""

    def setUp(self):
        """设置测试环境"""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.processor = SyntaxProcessor(self.temp_dir)

        # 创建测试文件
        template_dir = self.temp_dir / "prompts"
        template_dir.mkdir()

        header_file = template_dir / "header.md"
        header_file.write_text("# 项目标题", encoding='utf-8')

        footer_file = template_dir / "footer.md"
        footer_file.write_text("---\n© 2024 公司版权", encoding='utf-8')

    def tearDown(self):
        """清理测试环境"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_multiple_syntax_types(self):
        """测试多种语法类型组合"""
        # 设置变量
        variables = {
            'project_name': 'SuperMagic',
            'version': '1.0.0',
        }
        self.processor.set_variables(variables)

        with patch.dict(os.environ, {'ENVIRONMENT': 'production'}):
            with patch.object(config, 'get') as mock_config:
                mock_config.return_value = '0.7'

                template = """{{ @include("prompts/header.md") }}

项目名称: {{ @variable("project_name") }}
版本: {{ @variable("version") }}
环境: {{ @env("ENVIRONMENT") }}
温度设置: {{ @config("model.temperature") }}

{{ @include("prompts/footer.md") }}"""

                result = self.processor.process_dynamic_syntax(template)

                expected = """# 项目标题

项目名称: SuperMagic
版本: 1.0.0
环境: production
温度设置: 0.7

---
© 2024 公司版权"""

                self.assertEqual(result, expected)

    def test_syntax_with_defaults(self):
        """测试带默认值的语法组合"""
        with patch.dict(os.environ, {}, clear=True):
            with patch.object(config, 'get') as mock_config:
                # config.get 被调用时，如果返回None，应该使用传入的默认值
                def side_effect(key, default=None):
                    if key == "undefined.config":
                        return default  # 返回传入的默认值
                    return None

                mock_config.side_effect = side_effect

                template = """环境: {{ @env("UNDEFINED_ENV", "development") }}
配置: {{ @config("undefined.config", "default_config") }}
变量: {{ @variable("undefined_var", "default_var") }}"""

                result = self.processor.process_dynamic_syntax(template)

                expected = """环境: development
配置: default_config
变量: default_var"""

                self.assertEqual(result, expected)

    def test_positional_and_keyword_mix(self):
        """测试位置参数和键值对参数混合使用"""
        self.processor.set_variables({'test_var': 'test_value'})

        with patch.dict(os.environ, {'API_KEY': 'secret'}):
            template = """文件内容: {{ @include("prompts/header.md") }}
环境变量: {{ @env("API_KEY", default="fallback") }}
变量值: {{ @variable("test_var") }}"""

            result = self.processor.process_dynamic_syntax(template)

            expected = """文件内容: # 项目标题
环境变量: secret
变量值: test_value"""

            self.assertEqual(result, expected)

    def test_error_handling_chain(self):
        """测试错误处理链"""
        # 测试文件不存在错误
        template1 = '{{ @include("nonexistent.md") }}'
        with self.assertRaises(RuntimeError) as context:
            self.processor.process_dynamic_syntax(template1)
        self.assertIn("包含文件不存在", str(context.exception))

        # 测试变量不存在错误
        template2 = '{{ @variable("nonexistent_var") }}'
        with self.assertRaises(RuntimeError) as context:
            self.processor.process_dynamic_syntax(template2)
        self.assertIn("变量 nonexistent_var 不存在", str(context.exception))

        # 测试环境变量不存在错误
        with patch.dict(os.environ, {}, clear=True):
            template3 = '{{ @env("NONEXISTENT_ENV") }}'
            with self.assertRaises(RuntimeError) as context:
                self.processor.process_dynamic_syntax(template3)
            self.assertIn("环境变量 NONEXISTENT_ENV 不存在", str(context.exception))

    def test_complex_parameter_parsing(self):
        """测试复杂参数解析"""
        self.processor.set_variables({'fallback': 'fallback_value'})

        with patch.dict(os.environ, {}, clear=True):
            # 测试复杂的混合参数
            template = '''{{ @env("COMPLEX_VAR", default="complex_default") }}
{{ @variable("fallback", "should_not_use_this") }}'''

            result = self.processor.process_dynamic_syntax(template)

            expected = '''complex_default
fallback_value'''

            self.assertEqual(result, expected)

    @patch('subprocess.run')
    def test_shell_syntax_integration(self, mock_run):
        """测试shell语法集成"""
        # 模拟shell命令执行
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "shell_output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        # 设置变量
        self.processor.set_variables({'test_var': 'variable_value'})

        template = """变量: {{ @variable("test_var") }}
命令: {{ @shell("echo shell_output") }}"""

        result = self.processor.process_dynamic_syntax(template)
        expected = """变量: variable_value
命令: shell_output"""

        self.assertEqual(result, expected)

    @patch('subprocess.run')
    def test_multiple_shell_commands(self, mock_run):
        """测试多个shell命令"""
        # 模拟多次命令执行
        def side_effect(*args, **kwargs):
            command = args[0]
            if 'first' in command:
                result = Mock(returncode=0, stdout="first\n", stderr="")
            elif 'second' in command:
                result = Mock(returncode=0, stdout="second\n", stderr="")
            else:
                result = Mock(returncode=0, stdout="unknown\n", stderr="")
            return result

        mock_run.side_effect = side_effect

        template = """开始: {{ @shell("echo first") }}
中间: {{ @shell("echo second") }}
结束"""

        result = self.processor.process_dynamic_syntax(template)
        expected = """开始: first
中间: second
结束"""

        self.assertEqual(result, expected)

    def test_shell_registered_syntax(self):
        """测试shell语法是否已正确注册"""
        registered_syntaxes = self.processor.get_registered_syntaxes()
        self.assertIn('shell', registered_syntaxes)


if __name__ == '__main__':
    unittest.main()
