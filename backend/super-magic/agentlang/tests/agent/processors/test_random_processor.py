"""RandomProcessor 测试模块

测试随机值语法处理器的各种功能和边界情况。
"""

import unittest
import string
from pathlib import Path

from agentlang.agent.processors.random import RandomProcessor


class TestRandomProcessor(unittest.TestCase):
    """RandomProcessor 测试类"""

    def setUp(self):
        """每个测试方法前的设置"""
        self.processor = RandomProcessor()

    def test_basic_random_int(self):
        """测试基本随机整数生成"""
        # 测试默认参数（0-100的整数）
        result = self.processor.process({})

        # 验证结果是数字字符串
        self.assertTrue(result.isdigit() or (result.startswith('-') and result[1:].isdigit()))

        # 验证范围
        value = int(result)
        self.assertGreaterEqual(value, 0)
        self.assertLessEqual(value, 100)

    def test_random_int_with_range(self):
        """测试指定范围的随机整数"""
        # 测试1-10范围
        result = self.processor.process({'type': 'int', 'min': '1', 'max': '10'})
        value = int(result)
        self.assertGreaterEqual(value, 1)
        self.assertLessEqual(value, 10)

        # 测试负数范围
        result = self.processor.process({'type': 'int', 'min': '-10', 'max': '-1'})
        value = int(result)
        self.assertGreaterEqual(value, -10)
        self.assertLessEqual(value, -1)

    def test_random_int_keyword_params(self):
        """测试关键字参数的随机整数"""
        result = self.processor.process({'type': 'int', 'min': '5', 'max': '15'})
        value = int(result)
        self.assertGreaterEqual(value, 5)
        self.assertLessEqual(value, 15)

    def test_random_float(self):
        """测试随机浮点数生成"""
        # 测试默认范围（0.0-1.0）
        result = self.processor.process({'type': 'float'})
        value = float(result)
        self.assertGreaterEqual(value, 0.0)
        self.assertLessEqual(value, 1.0)

        # 测试指定范围
        result = self.processor.process({'type': 'float', 'min': '1.5', 'max': '2.5'})
        value = float(result)
        self.assertGreaterEqual(value, 1.5)
        self.assertLessEqual(value, 2.5)

    def test_random_float_keyword_params(self):
        """测试关键字参数的随机浮点数"""
        result = self.processor.process({'type': 'float', 'min': '0.1', 'max': '0.9'})
        value = float(result)
        self.assertGreaterEqual(value, 0.1)
        self.assertLessEqual(value, 0.9)

    def test_random_string_default(self):
        """测试默认随机字符串"""
        result = self.processor.process({'type': 'string'})

        # 验证长度
        self.assertEqual(len(result), 8)

        # 验证字符集（字母数字）
        valid_chars = string.ascii_letters + string.digits
        self.assertTrue(all(c in valid_chars for c in result))

    def test_random_string_custom_length(self):
        """测试自定义长度的随机字符串"""
        result = self.processor.process({'type': 'string', 'length': '12'})
        self.assertEqual(len(result), 12)

    def test_random_string_charset_letters(self):
        """测试字母字符集"""
        result = self.processor.process({'type': 'string', 'length': '10', 'charset': 'letters'})

        # 验证只包含字母
        self.assertTrue(all(c in string.ascii_letters for c in result))
        self.assertEqual(len(result), 10)

    def test_random_string_charset_digits(self):
        """测试数字字符集"""
        result = self.processor.process({'type': 'string', 'length': '6', 'charset': 'digits'})

        # 验证只包含数字
        self.assertTrue(all(c in string.digits for c in result))
        self.assertEqual(len(result), 6)

    def test_random_string_charset_all(self):
        """测试所有可见字符字符集"""
        result = self.processor.process({'type': 'string', 'length': '15', 'charset': 'all'})

        # 验证包含所有可见字符
        valid_chars = string.ascii_letters + string.digits + string.punctuation
        self.assertTrue(all(c in valid_chars for c in result))
        self.assertEqual(len(result), 15)

    def test_random_string_keyword_params(self):
        """测试字符串的关键字参数"""
        result = self.processor.process({'type': 'string', 'length': '5', 'charset': 'alphanumeric'})

        valid_chars = string.ascii_letters + string.digits
        self.assertTrue(all(c in valid_chars for c in result))
        self.assertEqual(len(result), 5)

    def test_positional_parameters(self):
        """测试位置参数"""
        # 测试所有位置参数
        result = self.processor.process({'_pos_0': 'string', '_pos_1': '10', '_pos_2': '20', '_pos_3': '8', '_pos_4': 'letters'})

        # 对于字符串类型，min和max参数会被忽略，只使用length和charset
        self.assertEqual(len(result), 8)
        self.assertTrue(all(c in string.ascii_letters for c in result))

    def test_backward_compatibility(self):
        """测试向后兼容性（min_val, max_val参数）"""
        result = self.processor.process({'type': 'int', 'min_val': '10', 'max_val': '20'})
        value = int(result)
        self.assertGreaterEqual(value, 10)
        self.assertLessEqual(value, 20)

    def test_invalid_type(self):
        """测试无效类型"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'invalid_type'})

    def test_invalid_range(self):
        """测试无效范围"""
        # 最小值大于最大值
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'int', 'min': '10', 'max': '5'})

    def test_invalid_numeric_params(self):
        """测试无效数值参数"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'int', 'min': 'invalid', 'max': '10'})

    def test_invalid_string_length(self):
        """测试无效字符串长度"""
        # 零长度
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'string', 'length': '0'})

        # 负长度
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'string', 'length': '-5'})

    def test_invalid_charset(self):
        """测试无效字符集"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'type': 'string', 'charset': 'invalid'})

    def test_edge_cases(self):
        """测试边界情况"""
        # 相同的最小值和最大值
        result = self.processor.process({'type': 'int', 'min': '5', 'max': '5'})
        self.assertEqual(result, "5")

        # 最小长度字符串
        result = self.processor.process({'type': 'string', 'length': '1'})
        self.assertEqual(len(result), 1)

    def test_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "random")

    def test_parameter_mapping(self):
        """测试参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["type", "min", "max", "length", "charset"])

    def test_required_params(self):
        """测试必需参数"""
        required = self.processor.get_required_params()
        self.assertEqual(required, [])

    def test_optional_params(self):
        """测试可选参数"""
        optional = self.processor.get_optional_params()
        self.assertEqual(optional, ["type", "min", "max", "min_val", "max_val", "length", "charset"])

    def test_dynamic_behavior(self):
        """测试动态行为 - 每次调用应返回不同结果"""
        # 连续调用多次，验证结果不同
        results = []
        for _ in range(10):
            result = self.processor.process({'type': 'int', 'min': '1', 'max': '1000'})
            results.append(result)

        # 验证结果不完全相同（至少有一个不同）
        unique_results = set(results)
        self.assertGreaterEqual(len(unique_results), 2)

    def test_string_randomness(self):
        """测试字符串随机性"""
        # 生成多个字符串，验证不完全相同
        results = []
        for _ in range(5):
            result = self.processor.process({'type': 'string', 'length': '10'})
            results.append(result)

        # 验证结果不完全相同
        unique_results = set(results)
        self.assertGreaterEqual(len(unique_results), 2)

    def test_float_precision(self):
        """测试浮点数精度"""
        result = self.processor.process({'type': 'float', 'min': '0.1', 'max': '0.2'})
        value = float(result)

        # 验证精度合理（不是整数）
        self.assertNotEqual(value, int(value))
        self.assertGreaterEqual(value, 0.1)
        self.assertLessEqual(value, 0.2)

    def test_large_numbers(self):
        """测试大数值"""
        # 测试大整数范围
        result = self.processor.process({'type': 'int', 'min': '1000000', 'max': '2000000'})
        value = int(result)
        self.assertGreaterEqual(value, 1000000)
        self.assertLessEqual(value, 2000000)

        # 测试大浮点数范围
        result = self.processor.process({'type': 'float', 'min': '1000.0', 'max': '2000.0'})
        value = float(result)
        self.assertGreaterEqual(value, 1000.0)
        self.assertLessEqual(value, 2000.0)

    def test_long_string(self):
        """测试长字符串生成"""
        result = self.processor.process({'type': 'string', 'length': '100'})
        self.assertEqual(len(result), 100)

        # 验证字符有一定的随机性
        char_counts = {}
        for char in result:
            char_counts[char] = char_counts.get(char, 0) + 1

        # 不应该所有字符都相同
        self.assertGreater(len(char_counts), 1)


if __name__ == '__main__':
    unittest.main()
