"""UuidProcessor 测试模块

测试UUID语法处理器的各种功能和边界情况。
"""

import unittest
import uuid
import re
from pathlib import Path

from agentlang.agent.processors.uuid import UuidProcessor


class TestUuidProcessor(unittest.TestCase):
    """UuidProcessor 测试类"""

    def setUp(self):
        """每个测试方法前的设置"""
        self.processor = UuidProcessor()

    def test_basic_uuid_generation(self):
        """测试基本UUID生成"""
        # 测试默认参数（UUID4）
        result = self.processor.process({})

        # 验证UUID格式
        uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        self.assertRegex(result, uuid_pattern)

        # 验证可以解析为有效UUID
        parsed_uuid = uuid.UUID(result)
        self.assertIsInstance(parsed_uuid, uuid.UUID)

        # 验证是UUID4
        self.assertEqual(parsed_uuid.version, 4)

    def test_uuid4_generation(self):
        """测试UUID4生成"""
        result = self.processor.process({'version': '4'})

        # 验证UUID格式
        parsed_uuid = uuid.UUID(result)
        self.assertEqual(parsed_uuid.version, 4)

    def test_uuid1_generation(self):
        """测试UUID1生成"""
        result = self.processor.process({'version': '1'})

        # 验证UUID格式
        parsed_uuid = uuid.UUID(result)
        self.assertEqual(parsed_uuid.version, 1)

    def test_positional_version_parameter(self):
        """测试位置参数版本"""
        # 测试UUID1
        result = self.processor.process({'_pos_0': '1'})
        parsed_uuid = uuid.UUID(result)
        self.assertEqual(parsed_uuid.version, 1)

        # 测试UUID4
        result = self.processor.process({'_pos_0': '4'})
        parsed_uuid = uuid.UUID(result)
        self.assertEqual(parsed_uuid.version, 4)

    def test_uppercase_option(self):
        """测试大写选项"""
        result = self.processor.process({'uppercase': 'true'})

        # 验证是大写
        self.assertTrue(result.isupper())

        # 验证仍然是有效UUID
        parsed_uuid = uuid.UUID(result)
        self.assertIsInstance(parsed_uuid, uuid.UUID)

    def test_no_hyphens_option(self):
        """测试无连字符选项"""
        result = self.processor.process({'no_hyphens': 'true'})

        # 验证没有连字符
        self.assertNotIn("-", result)

        # 验证长度是32位
        self.assertEqual(len(result), 32)

        # 验证是有效的十六进制字符串
        self.assertTrue(all(c in "0123456789abcdef" for c in result))

    def test_combined_options(self):
        """测试选项组合"""
        # 测试大写+无连字符
        result = self.processor.process({'uppercase': 'true', 'no_hyphens': 'true'})

        # 验证是大写
        self.assertTrue(result.isupper())

        # 验证没有连字符
        self.assertNotIn("-", result)

        # 验证长度
        self.assertEqual(len(result), 32)

    def test_boolean_parameter_parsing(self):
        """测试布尔参数解析"""
        # 测试各种true值
        true_values = ["true", "True", "TRUE", "1", "yes", "Yes", "on", "On"]
        for val in true_values:
            result = self.processor.process({'uppercase': val})
            self.assertTrue(result.isupper())

        # 测试各种false值
        false_values = ["false", "False", "FALSE", "0", "no", "No", "off", "Off"]
        for val in false_values:
            result = self.processor.process({'uppercase': val})
            self.assertTrue(result.islower())

    def test_invalid_version(self):
        """测试无效版本"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'version': '5'})

        with self.assertRaises(RuntimeError):
            self.processor.process({'version': '0'})

    def test_invalid_version_type(self):
        """测试无效版本类型"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'version': 'invalid'})

    def test_invalid_boolean_value(self):
        """测试无效布尔值"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'uppercase': 'invalid'})

    def test_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "uuid")

    def test_parameter_mapping(self):
        """测试参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["version", "uppercase", "no_hyphens"])

    def test_required_params(self):
        """测试必需参数"""
        required = self.processor.get_required_params()
        self.assertEqual(required, [])

    def test_optional_params(self):
        """测试可选参数"""
        optional = self.processor.get_optional_params()
        self.assertEqual(optional, ["version", "uppercase", "no_hyphens"])

    def test_dynamic_behavior(self):
        """测试动态行为 - 每次调用应返回不同结果"""
        # 连续调用多次，验证UUID不同
        results = []
        for _ in range(5):
            result = self.processor.process({})
            results.append(result)

        # 验证所有UUID都不相同
        unique_results = set(results)
        self.assertEqual(len(unique_results), len(results))

    def test_uuid_format_validation(self):
        """测试UUID格式验证"""
        # 测试标准格式
        result = self.processor.process({})

        # 验证标准UUID格式（8-4-4-4-12）
        parts = result.split('-')
        self.assertEqual(len(parts), 5)
        self.assertEqual(len(parts[0]), 8)
        self.assertEqual(len(parts[1]), 4)
        self.assertEqual(len(parts[2]), 4)
        self.assertEqual(len(parts[3]), 4)
        self.assertEqual(len(parts[4]), 12)


if __name__ == '__main__':
    unittest.main()
