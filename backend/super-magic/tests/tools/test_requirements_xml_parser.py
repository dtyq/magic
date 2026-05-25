"""基于真实失败 case 的单元测试

LLM 连续多次调用 web_search 均因 XML 解析失败而报错，
最终修正后才成功。以下测试覆盖了这些真实的失败 XML 输入模式。
"""

import unittest

from app.tools.web_search_utils.requirements_xml_parser import fallback_parse_requirements_xml


class TestFallbackFromDebugLog(unittest.TestCase):
    """真实失败 case 还原"""

    def test_case1_limit_tag_not_closed(self):
        """第1次失败: <limit> 标签未闭合（缺少 </limit>）"""
        xml = (
            "<requirements>\n"
            "    <requirement>\n"
            "        <name>实时天气查询</name>\n"
            "        <query>天气 2026 年 5 月 25 日 实时</query>\n"
            "        <limit>10\n"
            "    </requirement>\n"
            "    <requirement>\n"
            "        <name>天气预报</name>\n"
            "        <query>天气预报 今日 明天</query>\n"
            "        <limit>10\n"
            "    </requirement>\n"
            "</requirements>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 2
        assert requirements[0]['query'] == "天气 2026 年 5 月 25 日 实时"
        assert requirements[0]['name'] == "实时天气查询"
        assert requirements[1]['query'] == "天气预报 今日 明天"
        assert requirements[1]['name'] == "天气预报"
        assert "兜底" in msg

    def test_case2_limit_tag_not_closed_variant(self):
        """第2次失败: 同样是 <limit> 未闭合，略有不同的格式"""
        xml = (
            "<requirements>\n"
            "    <requirement>\n"
            "        <name>实时天气查询</name>\n"
            "        <query>天气 2026 年 5 月 25 日 实时</query>\n"
            "        <limit>10\n"
            "    </requirement>\n"
            "    <requirement>\n"
            "        <name>天气预报</name>\n"
            "        <query>天气预报 今日 明天</query>\n"
            "        <limit>10\n"
            "    </requirement>\n"
            "</requirements>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 2
        assert requirements[0]['query'] == "天气 2026 年 5 月 25 日 实时"
        assert requirements[1]['query'] == "天气预报 今日 明天"

    def test_case3_limit_not_closed_with_newline(self):
        """第3次失败: <limit> 未闭合，换行格式不同"""
        xml = (
            "<requirements>\n"
            "<requirement>\n"
            "<name>实时天气查询</name>\n"
            "<query>天气 2026 年 5 月 25 日</query>\n"
            "<limit>10\n"
            "<requirement>\n"
            "<name>天气预报</name>\n"
            "<query>天气预报今日</query>\n"
            "<limit>10\n"
            "</requirement>\n"
            "</requirements>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        # 至少能提取出 query 内容
        assert len(requirements) >= 1
        queries = [r['query'] for r in requirements]
        assert "天气 2026 年 5 月 25 日" in queries or "天气预报今日" in queries

    def test_case4_single_requirement_limit_not_closed(self):
        """第4次失败: 简化后的单个 requirement，<limit> 仍未闭合"""
        xml = (
            "<requirements><requirement><name>天气查询</name>"
            "<query>天气实时</query><limit>10</requirement></requirements>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) >= 1
        assert requirements[0]['query'] == "天气实时"
        assert requirements[0]['name'] == "天气查询"

    def test_case5_successful_xml_format(self):
        """最终成功: LLM 修正了格式，使用换行分隔的正确格式
        验证兜底解析对正确格式也能处理"""
        xml = (
            "<requirements>\n"
            "<requirement>\n"
            "<name>天气查询</name>\n"
            "<query>天气实时</query>\n"
            "</requirement>\n"
            "</requirements>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 1
        assert requirements[0]['query'] == "天气实时"
        assert requirements[0]['name'] == "天气查询"


class TestFallbackStrategy1ExtractRequirementsFragment(unittest.TestCase):
    """策略1: 从字符串中提取 <requirements> 片段"""

    def test_xml_with_leading_text(self):
        """XML 前面有额外文本"""
        xml = "这是搜索需求：\n<requirements><requirement><name>测试</name><query>hello world</query></requirement></requirements>"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 1
        assert requirements[0]['query'] == "hello world"
        assert "片段" in msg

    def test_xml_with_trailing_text(self):
        """XML 后面有额外文本"""
        xml = "<requirements><requirement><name>测试</name><query>hello world</query></requirement></requirements>\n以上是搜索需求"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 1
        assert requirements[0]['query'] == "hello world"

    def test_xml_case_insensitive_root(self):
        """根标签大小写不敏感"""
        xml = "<Requirements><requirement><name>测试</name><query>search term</query></requirement></Requirements>"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 1
        assert requirements[0]['query'] == "search term"


class TestFallbackStrategy2RegexExtractQuery(unittest.TestCase):
    """策略2: 正则提取 <query> 标签"""

    def test_broken_structure_but_valid_query_tags(self):
        """XML 结构完全错误，但 <query> 标签内容可提取"""
        xml = (
            "<search>\n"
            "  <item>\n"
            "    <name>新闻搜索</name>\n"
            "    <query>最新科技新闻 2026</query>\n"
            "  </item>\n"
            "  <item>\n"
            "    <name>天气搜索</name>\n"
            "    <query>今日天气预报</query>\n"
            "  </item>\n"
            "</search>"
        )
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 2
        assert requirements[0]['query'] == "最新科技新闻 2026"
        assert requirements[0]['name'] == "新闻搜索"
        assert requirements[1]['query'] == "今日天气预报"
        assert requirements[1]['name'] == "天气搜索"
        assert "正则" in msg

    def test_query_without_name(self):
        """有 <query> 但没有 <name>"""
        xml = "<broken><query>Python教程</query><query>Rust入门</query></broken>"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 2
        assert requirements[0]['query'] == "Python教程"
        assert requirements[1]['query'] == "Rust入门"
        # name 应该用 query 前20字符兜底
        assert requirements[0]['name'] == "Python教程"

    def test_nested_broken_xml(self):
        """嵌套严重错误的 XML，但 query 可提取"""
        xml = "<requirements><requirement><name>搜索<query>关键词测试</query></name></requirement></requirements>"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) >= 1
        assert any(r['query'] == "关键词测试" for r in requirements)


class TestFallbackStrategy3PlainText(unittest.TestCase):
    """策略3: 纯文本兜底"""

    def test_single_line_plain_text(self):
        """纯文本单行"""
        xml = "今日天气预报"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 1
        assert requirements[0]['query'] == "今日天气预报"
        assert "纯文本" in msg

    def test_multi_line_plain_text(self):
        """纯文本多行"""
        xml = "Python教程\nRust入门\nGo语言指南"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 3
        assert requirements[0]['query'] == "Python教程"
        assert requirements[1]['query'] == "Rust入门"
        assert requirements[2]['query'] == "Go语言指南"

    def test_max_5_lines(self):
        """纯文本最多取5行"""
        xml = "\n".join([f"搜索词{i}" for i in range(10)])
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 5

    def test_empty_lines_ignored(self):
        """空行应被忽略"""
        xml = "搜索词A\n\n\n搜索词B\n\n"
        requirements, msg = fallback_parse_requirements_xml(xml)
        assert len(requirements) == 2


class TestFallbackAllStrategiesFail(unittest.TestCase):
    """所有策略都失败的情况"""

    def test_empty_string(self):
        """空字符串"""
        with self.assertRaises(ValueError):
            fallback_parse_requirements_xml("")

    def test_whitespace_only(self):
        """只有空白字符"""
        with self.assertRaises(ValueError):
            fallback_parse_requirements_xml("   \n\n  ")

    def test_xml_with_empty_queries(self):
        """有 XML 标签但 query 全为空"""
        xml = "<requirements><requirement><name>测试</name><query></query></requirement></requirements>"
        with self.assertRaises(ValueError):
            fallback_parse_requirements_xml(xml)


class TestDefaultValues(unittest.TestCase):
    """验证兜底解析的默认值正确"""

    def test_default_fields(self):
        """验证默认字段值"""
        xml = "机器学习入门"
        requirements, _ = fallback_parse_requirements_xml(xml)
        req = requirements[0]
        assert req['limit'] == 10
        assert req['offset'] == 0
        assert req['language'] == 'zh-CN'
        assert req['region'] == 'CN'
        assert req['time_period'] is None

    def test_optional_fields_preserved_in_strategy1(self):
        """策略1中可选字段应被正确提取"""
        xml = (
            "<requirements><requirement>"
            "<name>测试</name>"
            "<query>搜索词</query>"
            "<limit>5</limit>"
            "<offset>2</offset>"
            "<language>en-US</language>"
            "<region>US</region>"
            "<time_period>week</time_period>"
            "</requirement></requirements>"
        )
        requirements, _ = fallback_parse_requirements_xml(xml)
        req = requirements[0]
        assert req['limit'] == 5
        assert req['offset'] == 2
        assert req['language'] == 'en-US'
        assert req['region'] == 'US'
        assert req['time_period'] == 'week'
