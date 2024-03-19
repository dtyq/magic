"""
@variable 语法处理器单元测试模块

测试 VariableProcessor 的完整功能，包括：
- 变量读取功能
- 变量更新功能
- 默认值处理
- 参数解析（位置参数和键值对参数）
- 错误处理和边界情况
"""

import unittest

from agentlang.agent.processors import VariableProcessor


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

    def test_process_list_variable(self):
        """测试列表类型变量"""
        list_variables = {'list_var': ['item1', 'item2', 'item3']}
        processor = VariableProcessor(variables=list_variables)

        params = {'key': 'list_var'}
        result = processor.process(params)
        self.assertEqual(result, "['item1', 'item2', 'item3']")

    def test_process_dict_variable(self):
        """测试字典类型变量"""
        dict_variables = {'dict_var': {'key1': 'value1', 'key2': 'value2'}}
        processor = VariableProcessor(variables=dict_variables)

        params = {'key': 'dict_var'}
        result = processor.process(params)
        self.assertEqual(result, "{'key1': 'value1', 'key2': 'value2'}")

    def test_process_none_variable(self):
        """测试None值变量"""
        none_variables = {'none_var': None}
        processor = VariableProcessor(variables=none_variables)

        params = {'key': 'none_var'}
        result = processor.process(params)
        self.assertEqual(result, 'None')

    def test_process_zero_variable(self):
        """测试零值变量"""
        zero_variables = {'zero_var': 0}
        processor = VariableProcessor(variables=zero_variables)

        params = {'key': 'zero_var'}
        result = processor.process(params)
        self.assertEqual(result, '0')

    def test_process_false_variable(self):
        """测试False值变量"""
        false_variables = {'false_var': False}
        processor = VariableProcessor(variables=false_variables)

        params = {'key': 'false_var'}
        result = processor.process(params)
        self.assertEqual(result, 'False')

    def test_process_float_variable(self):
        """测试浮点数变量"""
        float_variables = {'float_var': 3.14}
        processor = VariableProcessor(variables=float_variables)

        params = {'key': 'float_var'}
        result = processor.process(params)
        self.assertEqual(result, '3.14')

    def test_process_unicode_variable(self):
        """测试Unicode变量"""
        unicode_variables = {'unicode_var': '你好世界 🌍'}
        processor = VariableProcessor(variables=unicode_variables)

        params = {'key': 'unicode_var'}
        result = processor.process(params)
        self.assertEqual(result, '你好世界 🌍')

    def test_partial_update_variables(self):
        """测试部分更新变量"""
        # 添加新变量，保留原有变量
        new_variables = {'new_var': 'new_value', 'string_var': 'updated_value'}
        self.processor.update_variables(new_variables)

        # 测试新变量
        params = {'key': 'new_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'new_value')

        # 测试更新的变量
        params = {'key': 'string_var'}
        result = self.processor.process(params)
        self.assertEqual(result, 'updated_value')

        # 原来的其他变量应该不存在了
        params = {'key': 'number_var', 'default': 'not_found'}
        result = self.processor.process(params)
        self.assertEqual(result, 'not_found')

    def test_variable_override_default(self):
        """测试变量值覆盖默认值"""
        params = {'key': 'string_var', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'test_value')  # 应该使用变量值，不是默认值

    def test_case_sensitive_variables(self):
        """测试变量名大小写敏感"""
        case_variables = {'test_var': 'lowercase', 'TEST_VAR': 'uppercase'}
        processor = VariableProcessor(variables=case_variables)

        # 测试小写变量名
        params1 = {'key': 'test_var'}
        result1 = processor.process(params1)
        self.assertEqual(result1, 'lowercase')

        # 测试大写变量名
        params2 = {'key': 'TEST_VAR'}
        result2 = processor.process(params2)
        self.assertEqual(result2, 'uppercase')


if __name__ == '__main__':
    unittest.main()
