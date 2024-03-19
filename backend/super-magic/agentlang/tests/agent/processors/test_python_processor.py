"""PythonProcessor 测试模块

测试Python代码执行语法处理器的各种功能和边界情况。
"""

import unittest
import time
from pathlib import Path

from agentlang.agent.processors.python import PythonProcessor


class TestPythonProcessor(unittest.TestCase):
    """PythonProcessor 测试类"""

    def setUp(self):
        """每个测试方法前的设置"""
        self.processor = PythonProcessor()

    def test_basic_python_execution(self):
        """测试基本Python代码执行"""
        # 测试简单打印
        result = self.processor.process({'code': "print('hello world')"})
        self.assertEqual(result, "hello world")

    def test_python_calculation(self):
        """测试Python计算"""
        # 测试数学计算
        result = self.processor.process({'code': "print(2 + 3)"})
        self.assertEqual(result, "5")

        # 测试复杂计算
        result = self.processor.process({'code': "print(10 * 5 + 2)"})
        self.assertEqual(result, "52")

    def test_python_string_operations(self):
        """测试Python字符串操作"""
        # 测试字符串拼接
        result = self.processor.process({'code': "print('hello' + ' ' + 'world')"})
        self.assertEqual(result, "hello world")

        # 测试字符串格式化
        result = self.processor.process({'code': "print(f'result: {2+3}')"})
        self.assertEqual(result, "result: 5")

    def test_python_multiline_code(self):
        """测试多行Python代码"""
        code = """x = 10
y = 20
result = x + y
print(result)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "30")

    def test_python_with_imports(self):
        """测试带导入的Python代码"""
        # 测试标准库导入
        result = self.processor.process({'code': "import math; print(math.sqrt(16))"})
        self.assertEqual(result, "4.0")

        # 测试datetime导入
        result = self.processor.process({'code': "import datetime; print(type(datetime.datetime.now()).__name__)"})
        self.assertEqual(result, "datetime")

    def test_keyword_parameters(self):
        """测试关键字参数"""
        # 测试code参数
        result = self.processor.process({'code': "print('keyword test')"})
        self.assertEqual(result, "keyword test")

    def test_timeout_parameter(self):
        """测试超时参数"""
        # 测试自定义超时（快速执行的代码）
        result = self.processor.process({'code': "print('timeout test')", 'timeout': '5'})
        self.assertEqual(result, "timeout test")

    def test_positional_parameters(self):
        """测试位置参数"""
        # 测试位置参数
        result = self.processor.process({'_pos_0': "print('positional test')"})
        self.assertEqual(result, "positional test")

        # 测试位置参数+超时
        result = self.processor.process({'_pos_0': "print('timeout test')", '_pos_1': '5'})
        self.assertEqual(result, "timeout test")

    def test_python_variables(self):
        """测试Python变量操作"""
        code = """data = [1, 2, 3, 4, 5]
total = sum(data)
print(total)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "15")

    def test_python_functions(self):
        """测试Python函数定义和调用"""
        code = """def add_numbers(a, b):
    return a + b

result = add_numbers(10, 20)
print(result)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "30")

    def test_python_loops(self):
        """测试Python循环"""
        code = """total = 0
for i in range(1, 6):
    total += i
print(total)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "15")

    def test_python_conditionals(self):
        """测试Python条件语句"""
        code = """x = 10
if x > 5:
    print("greater")
else:
    print("smaller")"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "greater")

    def test_python_data_structures(self):
        """测试Python数据结构"""
        # 测试字典
        code = """data = {"name": "test", "value": 42}
print(data["value"])"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "42")

        # 测试列表
        code = """numbers = [1, 2, 3, 4, 5]
print(len(numbers))"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "5")

    def test_python_error_handling(self):
        """测试Python错误处理"""
        # 测试语法错误
        with self.assertRaises(ValueError):
            self.processor.process({'code': "print(invalid syntax"})

        # 测试运行时错误
        with self.assertRaises(ValueError):
            self.processor.process({'code': "print(undefined_variable)"})

    def test_python_timeout_error(self):
        """测试Python超时错误"""
        # 测试超时（使用很短的超时时间和可能较慢的操作）
        with self.assertRaises(ValueError):
            self.processor.process({'code': "import time; time.sleep(2)", 'timeout': '0.1'})

    def test_invalid_timeout_parameter(self):
        """测试无效超时参数"""
        # 无效超时参数应该使用默认值，不应该报错
        result = self.processor.process({'code': "print('test')", 'timeout': 'invalid'})
        self.assertEqual(result, "test")

    def test_empty_code(self):
        """测试空代码"""
        # 空代码应该返回空字符串
        result = self.processor.process({'code': ""})
        self.assertEqual(result, "")

    def test_whitespace_only_code(self):
        """测试只有空白字符的代码"""
        result = self.processor.process({'code': "   "})
        self.assertEqual(result, "")

    def test_python_output_with_newlines(self):
        """测试包含换行符的输出"""
        code = """print("line1")
print("line2")"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "line1\nline2")

    def test_python_no_output(self):
        """测试没有输出的代码"""
        # 只有赋值，没有print
        result = self.processor.process({'code': "x = 10"})
        self.assertEqual(result, "")

    def test_syntax_name(self):
        """测试语法名称"""
        self.assertEqual(self.processor.get_syntax_name(), "python")

    def test_parameter_mapping(self):
        """测试参数映射"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["code", "timeout"])

    def test_required_params(self):
        """测试必需参数"""
        required = self.processor.get_required_params()
        self.assertEqual(required, ["code"])

    def test_optional_params(self):
        """测试可选参数"""
        optional = self.processor.get_optional_params()
        self.assertEqual(optional, ["timeout"])

    def test_missing_required_parameter(self):
        """测试缺少必需参数"""
        with self.assertRaises(ValueError):
            self.processor.process({})

    def test_complex_python_operations(self):
        """测试复杂Python操作"""
        code = """import json
data = {"numbers": [1, 2, 3, 4, 5]}
total = sum(data["numbers"])
result = {"sum": total, "count": len(data["numbers"])}
print(json.dumps(result))"""
        result = self.processor.process({'code': code})

        # 验证JSON输出
        import json
        parsed = json.loads(result)
        self.assertEqual(parsed["sum"], 15)
        self.assertEqual(parsed["count"], 5)

    def test_python_exception_handling_in_code(self):
        """测试代码内的异常处理"""
        code = """try:
    result = 10 / 0
except ZeroDivisionError:
    result = "division by zero"
print(result)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "division by zero")

    def test_python_unicode_handling(self):
        """测试Unicode字符处理"""
        result = self.processor.process({'code': "print('你好世界')"})
        self.assertEqual(result, "你好世界")

    def test_python_special_characters(self):
        """测试特殊字符处理"""
        # 测试引号转义
        result = self.processor.process({'code': "print('hello \"world\"')"})
        self.assertEqual(result, 'hello "world"')

    def test_python_return_vs_print(self):
        """测试return和print的区别"""
        # 只有return，没有print，应该没有输出
        code = """def get_value():
    return 42

result = get_value()"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "")

        # 有print才有输出
        code = """def get_value():
    return 42

result = get_value()
print(result)"""
        result = self.processor.process({'code': code})
        self.assertEqual(result, "42")


if __name__ == '__main__':
    unittest.main()
