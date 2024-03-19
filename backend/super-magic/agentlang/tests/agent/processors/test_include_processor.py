"""
@include 语法处理器单元测试模块

测试 IncludeProcessor 的完整功能，包括：
- 文件包含功能
- 相对路径和绝对路径处理
- 参数解析（位置参数和键值对参数）
- 错误处理和边界情况
- 递归处理动态语法
- 循环引用检测
"""

import os
import tempfile
import unittest
from pathlib import Path

from agentlang.agent.processors import IncludeProcessor
from agentlang.agent.syntax import SyntaxProcessor


class TestIncludeProcessor(unittest.TestCase):
    """@include 语法处理器测试"""

    def setUp(self):
        """设置测试环境"""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.processor = IncludeProcessor(self.temp_dir)

        # 创建 SyntaxProcessor 实例用于递归测试
        self.syntax_processor = SyntaxProcessor(self.temp_dir)

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

    def test_process_with_extension_param(self):
        """测试带扩展名参数的处理"""
        # 创建没有扩展名的文件
        no_ext_file = self.temp_dir / "noext"
        no_ext_file.write_text("无扩展名文件内容", encoding='utf-8')

        params = {'path': 'noext', 'extension': ''}
        result = self.processor.process(params)
        self.assertEqual(result, "无扩展名文件内容")

    def test_process_nested_directory(self):
        """测试嵌套目录处理"""
        # 创建嵌套目录结构
        nested_dir = self.temp_dir / "level1" / "level2"
        nested_dir.mkdir(parents=True)
        nested_file = nested_dir / "nested.md"
        nested_file.write_text("嵌套文件内容", encoding='utf-8')

        params = {'path': 'level1/level2/nested.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "嵌套文件内容")

    def test_process_chinese_filename(self):
        """测试中文文件名处理"""
        chinese_file = self.temp_dir / "中文文件.md"
        chinese_file.write_text("中文文件内容", encoding='utf-8')

        params = {'path': '中文文件.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "中文文件内容")

    def test_process_empty_file(self):
        """测试空文件处理"""
        empty_file = self.temp_dir / "empty.md"
        empty_file.write_text("", encoding='utf-8')

        params = {'path': 'empty.md'}
        result = self.processor.process(params)
        self.assertEqual(result, "")

    def test_process_missing_extension_auto_match(self):
        """测试缺少extension参数时自动匹配.prompt文件"""
        # 创建没有扩展名的路径和对应的.prompt文件
        template_file = self.temp_dir / "mytemplate.prompt"
        template_file.write_text("这是模板文件内容", encoding='utf-8')

        # 使用没有扩展名的路径，不提供extension参数
        # 应该自动匹配到.prompt文件
        params = {'path': 'mytemplate'}
        result = self.processor.process(params)
        self.assertEqual(result, "这是模板文件内容")

        # 创建子目录中的模板文件测试
        sub_template_dir = self.temp_dir / "subprompts"
        sub_template_dir.mkdir()
        sub_template_file = sub_template_dir / "subtemplate.prompt"
        sub_template_file.write_text("子目录模板内容", encoding='utf-8')

        params = {'path': 'subprompts/subtemplate'}
        result = self.processor.process(params)
        self.assertEqual(result, "子目录模板内容")

    # ========== 递归处理相关测试 ==========

    def test_include_with_variable(self):
        """测试包含文件中的 @variable 语法"""
        # 创建包含变量的模板文件
        template_file = self.temp_dir / "template.md"
        template_file.write_text("Hello {{ @variable(\"user_name\") }}!")

        # 设置变量
        self.syntax_processor.set_variables({"user_name": "Alice"})

        # 测试包含文件
        result = self.syntax_processor.process_dynamic_syntax('{{ @include("./template.md") }}')
        self.assertEqual(result, "Hello Alice!")

    def test_nested_include(self):
        """测试嵌套的 @include 语法"""
        # 创建第一层模板
        template1 = self.temp_dir / "template1.md"
        template1.write_text("Level 1: {{ @include(\"./template2.md\") }}")

        # 创建第二层模板
        template2 = self.temp_dir / "template2.md"
        template2.write_text("Level 2: {{ @variable(\"message\") }}")

        # 设置变量
        self.syntax_processor.set_variables({"message": "Nested Include Works!"})

        # 测试嵌套包含
        result = self.syntax_processor.process_dynamic_syntax('{{ @include("./template1.md") }}')
        self.assertEqual(result, "Level 1: Level 2: Nested Include Works!")

    def test_circular_reference_detection(self):
        """测试循环引用检测"""
        # 创建相互引用的文件
        file_a = self.temp_dir / "file_a.md"
        file_b = self.temp_dir / "file_b.md"

        file_a.write_text("A: {{ @include(\"./file_b.md\") }}")
        file_b.write_text("B: {{ @include(\"./file_a.md\") }}")

        # 测试循环引用
        with self.assertRaises(RuntimeError) as context:
            self.syntax_processor.process_dynamic_syntax('{{ @include("./file_a.md") }}')

        self.assertIn("检测到循环引用", str(context.exception))

    def test_self_reference_detection(self):
        """测试自引用检测"""
        # 创建自引用文件
        self_ref = self.temp_dir / "self_ref.md"
        self_ref.write_text("Self: {{ @include(\"./self_ref.md\") }}")

        # 测试自引用
        with self.assertRaises(RuntimeError) as context:
            self.syntax_processor.process_dynamic_syntax('{{ @include("./self_ref.md") }}')

        self.assertIn("检测到循环引用", str(context.exception))

    def test_complex_nested_syntax(self):
        """测试复杂的嵌套语法场景"""
        # 创建主模板
        main_template = self.temp_dir / "main.template"
        main_template.write_text("""
# {{ @variable("title") }}

{{ @include("./header.md") }}

## Content
{{ @include("./content.md") }}

## Footer
Generated at: {{ @timestamp() }}
""")

        # 创建头部模板
        header = self.temp_dir / "header.md"
        header.write_text("Author: {{ @variable(\"author\") }}")

        # 创建内容模板
        content = self.temp_dir / "content.md"
        content.write_text("""
{{ @variable("content_text") }}

Sub-section: {{ @include("./subsection.md") }}
""")

        # 创建子节模板
        subsection = self.temp_dir / "subsection.md"
        subsection.write_text("Details: {{ @variable(\"details\") }}")

        # 设置变量
        self.syntax_processor.set_variables({
            "title": "Test Document",
            "author": "Test Author",
            "content_text": "Main content here",
            "details": "Detailed information"
        })

        # 测试复杂嵌套
        result = self.syntax_processor.process_dynamic_syntax('{{ @include("./main") }}')

        # 验证结果包含所有预期内容
        self.assertIn("# Test Document", result)
        self.assertIn("Author: Test Author", result)
        self.assertIn("Main content here", result)
        self.assertIn("Details: Detailed information", result)
        self.assertIn("Generated at:", result)

    def test_include_with_env_variable(self):
        """测试包含文件中的 @env 语法"""
        # 创建包含环境变量的模板
        env_template = self.temp_dir / "env_template.md"
        env_template.write_text("API Key: {{ @env(\"TEST_API_KEY\", \"default_key\") }}")

        # 设置环境变量
        os.environ["TEST_API_KEY"] = "secret_key_123"

        try:
            # 测试包含文件
            result = self.syntax_processor.process_dynamic_syntax('{{ @include("./env_template.md") }}')
            self.assertEqual(result, "API Key: secret_key_123")
        finally:
            # 清理环境变量
            os.environ.pop("TEST_API_KEY", None)

    def test_multiple_includes_in_one_file(self):
        """测试一个文件中多个 @include"""
        # 创建多个小模板
        part1 = self.temp_dir / "part1.md"
        part2 = self.temp_dir / "part2.md"
        part3 = self.temp_dir / "part3.md"

        part1.write_text("Part 1: {{ @variable(\"var1\") }}")
        part2.write_text("Part 2: {{ @variable(\"var2\") }}")
        part3.write_text("Part 3: {{ @variable(\"var3\") }}")

        # 创建主模板
        main = self.temp_dir / "main.md"
        main.write_text("""
{{ @include("./part1.md") }}
---
{{ @include("./part2.md") }}
---
{{ @include("./part3.md") }}
""")

        # 设置变量
        self.syntax_processor.set_variables({
            "var1": "Value 1",
            "var2": "Value 2",
            "var3": "Value 3"
        })

        # 测试多个包含
        result = self.syntax_processor.process_dynamic_syntax('{{ @include("./main.md") }}')

        # 验证结果
        self.assertIn("Part 1: Value 1", result)
        self.assertIn("Part 2: Value 2", result)
        self.assertIn("Part 3: Value 3", result)
        self.assertIn("---", result)


if __name__ == '__main__':
    unittest.main()
