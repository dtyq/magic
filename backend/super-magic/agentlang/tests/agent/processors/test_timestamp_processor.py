"""TimestampProcessor 测试模块

测试时间戳语法处理器的各种功能和边界情况。
"""

import unittest
import time
from pathlib import Path

from agentlang.agent.processors.timestamp import TimestampProcessor


class TestTimestampProcessor(unittest.TestCase):
    """TimestampProcessor 测试类"""

    def setUp(self):
        """每个测试方法前的设置"""
        self.processor = TimestampProcessor()

    def test_basic_timestamp_generation(self):
        """测试基本时间戳生成"""
        # 测试默认格式（秒）
        result = self.processor.process({})

        # 验证结果是数字字符串
        self.assertTrue(result.isdigit())

        # 验证时间戳合理性（应该接近当前时间）
        current_time = int(time.time())
        timestamp = int(result)
        self.assertLessEqual(abs(timestamp - current_time), 2)

    def test_seconds_format(self):
        """测试秒格式时间戳"""
        result = self.processor.process({'format': 's'})

        # 验证是10位数字（秒级时间戳）
        self.assertTrue(result.isdigit())
        self.assertEqual(len(result), 10)

    def test_milliseconds_format(self):
        """测试毫秒格式时间戳"""
        result = self.processor.process({'format': 'ms'})

        # 验证是13位数字（毫秒级时间戳）
        self.assertTrue(result.isdigit())
        self.assertEqual(len(result), 13)

    def test_microseconds_format(self):
        """测试微秒格式时间戳"""
        result = self.processor.process({'format': 'us'})

        # 验证是16位数字（微秒级时间戳）
        self.assertTrue(result.isdigit())
        self.assertEqual(len(result), 16)

    def test_time_offset(self):
        """测试时间偏移"""
        # 获取当前时间作为基准
        base_time = int(time.time())

        # 测试正偏移（1小时后）
        result = self.processor.process({'offset': '3600'})
        timestamp = int(result)

        # 验证时间差大约是1小时（允许几秒误差）
        time_diff = timestamp - base_time
        self.assertGreaterEqual(time_diff, 3595)
        self.assertLessEqual(time_diff, 3605)

    def test_positional_parameters(self):
        """测试位置参数"""
        # 测试单个位置参数（format）
        result = self.processor.process({'_pos_0': 'ms'})
        self.assertTrue(result.isdigit())
        self.assertEqual(len(result), 13)

        # 测试两个位置参数（format, offset）
        result = self.processor.process({'_pos_0': 's', '_pos_1': '60'})
        timestamp = int(result)
        current_time = int(time.time())
        time_diff = timestamp - current_time
        self.assertGreaterEqual(time_diff, 55)
        self.assertLessEqual(time_diff, 65)

    def test_invalid_format(self):
        """测试无效格式"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'format': 'invalid'})

    def test_invalid_offset(self):
        """测试无效偏移量"""
        with self.assertRaises(RuntimeError):
            self.processor.process({'offset': 'invalid'})

    def test_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "timestamp")

    def test_parameter_mapping(self):
        """测试参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["format", "offset"])

    def test_required_params(self):
        """测试必需参数"""
        required = self.processor.get_required_params()
        self.assertEqual(required, [])

    def test_optional_params(self):
        """测试可选参数"""
        optional = self.processor.get_optional_params()
        self.assertEqual(optional, ["format", "offset"])

    def test_dynamic_behavior(self):
        """测试动态行为 - 每次调用应返回不同结果"""
        # 连续调用多次，验证时间在递增
        results = []
        for _ in range(3):
            result = self.processor.process({})
            results.append(int(result))
            time.sleep(0.1)  # 短暂延迟确保时间差异

        # 验证时间戳递增
        for i in range(1, len(results)):
            self.assertGreaterEqual(results[i], results[i-1])


if __name__ == '__main__':
    unittest.main()
