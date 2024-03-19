"""
@shell 语法处理器单元测试模块

测试 ShellProcessor 的完整功能，包括：
- Shell命令执行功能
- 超时处理
- 参数解析（位置参数和键值对参数）
- 错误处理和边界情况
"""

import subprocess
import unittest
from unittest.mock import patch, Mock

from agentlang.agent.processors import ShellProcessor


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

    @patch('subprocess.run')
    def test_process_with_stderr_output(self, mock_run):
        """测试有stderr输出的命令"""
        # 模拟有stderr但命令成功的情况
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "stdout content\n"
        mock_result.stderr = "warning message\n"
        mock_run.return_value = mock_result

        params = {'command': 'echo stdout; echo warning >&2'}
        result = self.processor.process(params)

        self.assertEqual(result, "stdout content")  # 只返回stdout

    @patch('subprocess.run')
    def test_process_zero_timeout(self, mock_run):
        """测试零超时值"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo test', 'timeout': '0'}
        result = self.processor.process(params)

        # 零超时值应该被正常解析并传递
        mock_run.assert_called_once_with(
            'echo test',
            shell=True,
            capture_output=True,
            text=True,
            timeout=0.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_negative_timeout(self, mock_run):
        """测试负数超时值"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo test', 'timeout': '-5'}
        result = self.processor.process(params)

        # 负数超时值应该被正常解析并传递
        mock_run.assert_called_once_with(
            'echo test',
            shell=True,
            capture_output=True,
            text=True,
            timeout=-5.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_large_timeout(self, mock_run):
        """测试大超时值"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo test', 'timeout': '3600'}  # 1小时
        result = self.processor.process(params)

        mock_run.assert_called_once_with(
            'echo test',
            shell=True,
            capture_output=True,
            text=True,
            timeout=3600.0,
            encoding='utf-8',
            errors='replace'
        )

    @patch('subprocess.run')
    def test_process_command_with_special_chars(self, mock_run):
        """测试包含特殊字符的命令"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "special output\n"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        params = {'command': 'echo "hello world"; echo $USER'}
        result = self.processor.process(params)

        self.assertEqual(result, "special output")
        mock_run.assert_called_once_with(
            'echo "hello world"; echo $USER',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30.0,
            encoding='utf-8',
            errors='replace'
        )


if __name__ == '__main__':
    unittest.main()
