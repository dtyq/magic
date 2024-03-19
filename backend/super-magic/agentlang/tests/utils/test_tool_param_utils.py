"""
测试 tool_param_utils 模块
测试 Unicode 转义解码和其他参数处理工具
"""
import pytest
from agentlang.utils.tool_param_utils import decode_unicode_escapes_in_dict


class TestDecodeUnicodeEscapesInDict:
    """测试 Unicode 转义解码函数"""

    def test_simple_chinese_unicode_escapes(self):
        """测试简单的中文 Unicode 转义序列解码"""
        input_data = {
            "file_path": "\\u56e2\\u961f\\u4e0e\\u7ba1\\u7406/\\u56e2\\u961f\\u4eba\\u5458\\u6e05\\u5355-20251223.html"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["file_path"] == "团队与管理/团队人员清单-20251223.html"

    def test_html_content_with_unicode_escapes(self):
        """测试包含 Unicode 转义的 HTML 内容解码"""
        input_data = {
            "content": "<title>\\u56e2\\u961f\\u4eba\\u5458\\u6e05\\u5355 2025</title>"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["content"] == "<title>团队人员清单 2025</title>"

    def test_no_garbled_text_produced(self):
        """测试解码不会产生乱码（针对旧 bug 的回归测试）"""
        input_data = {
            "text": "\\u56e2\\u961f"
        }
        result = decode_unicode_escapes_in_dict(input_data)

        # 不应该包含旧 bug 产生的乱码
        assert "å¢é" not in result['text']
        assert "å¢éäººå" not in result['text']

        # 应该包含正确的解码文本
        assert result['text'] == "团队"

    def test_mixed_unicode_and_ascii(self):
        """测试混合 Unicode 转义和 ASCII 字符的解码"""
        input_data = {
            "title": "\\u56e2\\u961f\\u4eba\\u5458\\u6e05\\u5355 2025",
            "year": "2025"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["title"] == "团队人员清单 2025"
        assert result["year"] == "2025"

    def test_nested_dict_with_unicode(self):
        """测试嵌套字典中的 Unicode 转义解码"""
        input_data = {
            "outer": {
                "inner": "\\u6d4b\\u8bd5"
            }
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["outer"]["inner"] == "测试"

    def test_list_with_unicode_strings(self):
        """测试包含 Unicode 转义字符串的列表解码"""
        input_data = {
            "items": [
                "\\u7b2c\\u4e00\\u9879",
                "\\u7b2c\\u4e8c\\u9879",
                "normal string"
            ]
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["items"][0] == "第一项"
        assert result["items"][1] == "第二项"
        assert result["items"][2] == "normal string"

    def test_list_with_nested_dicts(self):
        """测试包含嵌套字典的列表解码"""
        input_data = {
            "employees": [
                {"name": "\\u5f20\\u4e09", "age": 30},
                {"name": "\\u674e\\u56db", "age": 25}
            ]
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["employees"][0]["name"] == "张三"
        assert result["employees"][0]["age"] == 30
        assert result["employees"][1]["name"] == "李四"
        assert result["employees"][1]["age"] == 25

    def test_no_unicode_escapes(self):
        """测试不含 Unicode 转义的字符串保持不变"""
        input_data = {
            "name": "John Doe",
            "age": 30,
            "active": True
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result == input_data

    def test_already_decoded_chinese(self):
        """测试已解码的中文字符保持不变"""
        input_data = {
            "name": "团队人员清单",
            "description": "这是一个测试"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result == input_data

    def test_key_with_unicode_escapes(self):
        """测试字典键中的 Unicode 转义解码"""
        input_data = {
            "\\u59d3\\u540d": "test"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert "姓名" in result
        assert result["姓名"] == "test"

    def test_japanese_unicode_escapes(self):
        """测试日文 Unicode 转义解码"""
        input_data = {
            "text": "\\u3053\\u3093\\u306b\\u3061\\u306f"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["text"] == "こんにちは"

    def test_korean_unicode_escapes(self):
        """测试韩文 Unicode 转义解码"""
        input_data = {
            "text": "\\uc548\\ub155\\ud558\\uc138\\uc694"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["text"] == "안녕하세요"

    def test_empty_dict(self):
        """测试空字典"""
        input_data = {}
        result = decode_unicode_escapes_in_dict(input_data)
        assert result == {}

    def test_none_values(self):
        """测试包含 None 值的字典"""
        input_data = {
            "name": None,
            "description": "\\u6d4b\\u8bd5"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["name"] is None
        assert result["description"] == "测试"

    def test_numeric_values_preserved(self):
        """测试数字值被保留"""
        input_data = {
            "count": 123,
            "price": 45.67,
            "name": "\\u4ef7\\u683c"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["count"] == 123
        assert result["price"] == 45.67
        assert result["name"] == "价格"

    def test_boolean_values_preserved(self):
        """测试布尔值被保留"""
        input_data = {
            "active": True,
            "deleted": False,
            "name": "\\u6d4b\\u8bd5"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["active"] is True
        assert result["deleted"] is False
        assert result["name"] == "测试"

    def test_deeply_nested_structure(self):
        """测试深层嵌套结构中的 Unicode 解码"""
        input_data = {
            "level1": {
                "level2": {
                    "level3": {
                        "text": "\\u6df1\\u5ea6\\u5d4c\\u5957"
                    }
                }
            }
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["level1"]["level2"]["level3"]["text"] == "深度嵌套"

    def test_list_with_mixed_content(self):
        """测试包含混合类型的列表"""
        input_data = {
            "mixed": [
                "\\u6587\\u672c",
                123,
                True,
                None,
                {"key": "\\u503c"}
            ]
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["mixed"][0] == "文本"
        assert result["mixed"][1] == 123
        assert result["mixed"][2] is True
        assert result["mixed"][3] is None
        assert result["mixed"][4]["key"] == "值"

    def test_special_characters_preserved(self):
        """测试特殊字符在解码过程中被保留"""
        input_data = {
            "path": "\\u6587\\u4ef6/\\u8def\\u5f84.txt",
            "email": "test@example.com",
            "url": "https://example.com/\\u8def\\u5f84"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["path"] == "文件/路径.txt"
        assert result["email"] == "test@example.com"
        assert result["url"] == "https://example.com/路径"


class TestRealWorldScenarios:
    """基于真实生产场景的测试用例"""

    def test_production_log_scenario(self):
        """测试触发 bug 报告的生产日志真实场景"""
        # 这是来自生产日志的真实输入
        input_data = {
            "file_path": "\\u56e2\\u961f\\u4e0e\\u7ba1\\u7406/\\u56e2\\u961f\\u4eba\\u5458\\u6e05\\u5355-20251223.html",
            "content": "<!DOCTYPE html>\\n<html>\\n<title>\\u56e2\\u961f\\u4eba\\u5458\\u6e05\\u5355 2025</title>\\n</html>"
        }
        result = decode_unicode_escapes_in_dict(input_data)

        # 不应该产生乱码
        assert "å¢é" not in result["file_path"]
        assert "å¢éäººå" not in result["file_path"]
        assert "å¢éäººåæ¸å" not in result["content"]

        # 应该产生正确的中文
        assert result["file_path"] == "团队与管理/团队人员清单-20251223.html"
        assert "团队人员清单" in result["content"]

    def test_large_html_content_with_unicode(self):
        """测试包含多个 Unicode 转义的大型 HTML 内容"""
        input_data = {
            "content": "<div class='\\u5bb9\\u5668'>\\n  <h1>\\u6807\\u9898</h1>\\n  <p>\\u5185\\u5bb9</p>\\n</div>"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert "容器" in result["content"]
        assert "标题" in result["content"]
        assert "内容" in result["content"]

    def test_json_like_string_with_unicode(self):
        """测试包含 Unicode 转义的 JSON 格式字符串"""
        input_data = {
            "json_str": '{"\\u540d\\u79f0": "\\u6d4b\\u8bd5", "\\u503c": 123}'
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert "名称" in result["json_str"]
        assert "测试" in result["json_str"]
        assert "值" in result["json_str"]

    def test_multiple_languages_mixed(self):
        """测试混合多种语言的内容"""
        input_data = {
            "text": "English \\u4e2d\\u6587 \\u65e5\\u672c\\u8a9e \\ud55c\\uad6d\\uc5b4"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert "English" in result["text"]
        assert "中文" in result["text"]
        assert "日本語" in result["text"]
        assert "한국어" in result["text"]

    def test_file_path_with_unicode_folder_names(self):
        """测试文件夹名包含 Unicode 字符的文件路径"""
        input_data = {
            "paths": [
                "/\\u9879\\u76ee/\\u6587\\u6863/\\u6587\\u4ef6.txt",
                "C:\\\\\\u7528\\u6237\\\\\\u6587\\u6863\\\\data.json",
                "./\\u6570\\u636e/output.csv"
            ]
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["paths"][0] == "/项目/文档/文件.txt"
        assert result["paths"][1] == "C:\\用户\\文档\\data.json"
        assert result["paths"][2] == "./数据/output.csv"


class TestEdgeCases:
    """边界情况和错误处理测试"""

    def test_empty_string(self):
        """测试空字符串值"""
        input_data = {
            "empty": "",
            "normal": "\\u6d4b\\u8bd5"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["empty"] == ""
        assert result["normal"] == "测试"

    def test_whitespace_only(self):
        """测试仅包含空白字符的字符串"""
        input_data = {
            "spaces": "   ",
            "tabs": "\t\t",
            "newlines": "\n\n"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["spaces"] == "   "
        assert result["tabs"] == "\t\t"
        assert result["newlines"] == "\n\n"

    def test_backslash_without_unicode(self):
        """测试包含反斜杠但非 Unicode 转义的字符串"""
        input_data = {
            "path": "C:\\Users\\test",
            "regex": "\\d+\\w+"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        # 这些应该保持不变，因为它们不包含 \u
        assert result == input_data

    def test_partial_unicode_escape(self):
        """测试处理不完整或格式错误的 Unicode 转义"""
        input_data = {
            "incomplete": "\\u56",
            "normal": "\\u6d4b\\u8bd5"
        }
        result = decode_unicode_escapes_in_dict(input_data)
        # 不完整的转义应该被优雅处理
        assert "normal" in result
        assert result["normal"] == "测试"

    def test_very_long_string_with_unicode(self):
        """测试包含 Unicode 转义的超长字符串性能"""
        long_text = "\\u6d4b\\u8bd5 " * 1000
        input_data = {
            "long_text": long_text
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert "测试" in result["long_text"]
        assert result["long_text"].count("测试") == 1000

    def test_empty_list(self):
        """测试空列表"""
        input_data = {
            "items": []
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["items"] == []

    def test_nested_empty_structures(self):
        """测试嵌套的空字典和列表"""
        input_data = {
            "empty_dict": {},
            "empty_list": [],
            "nested": {
                "also_empty": {},
                "list": []
            }
        }
        result = decode_unicode_escapes_in_dict(input_data)
        assert result["empty_dict"] == {}
        assert result["empty_list"] == []
        assert result["nested"]["also_empty"] == {}
        assert result["nested"]["list"] == []
