"""
Unit tests for XMLEscapeFixer utility
"""

import pytest
from app.utils.xml_escape_fixer import XMLEscapeFixer


class TestXMLEscapeFixer:
    """Test suite for XMLEscapeFixer class"""

    def test_no_fixes_needed(self):
        """Test that valid XML is left unchanged"""
        xml_string = '<requirements><requirement><name>Test</name></requirement></requirements>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_fix_ampersand(self):
        """Test fixing unescaped ampersand"""
        xml_string = '<name>Tech & Finance</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<name>Tech &amp; Finance</name>'
        assert len(fixes) == 1
        assert fixes[0]['char'] == '&'
        assert fixes[0]['escaped_as'] == '&amp;'

    def test_preserve_valid_ampersand_entity(self):
        """Test that valid &amp; entity is preserved"""
        xml_string = '<name>Tech &amp; Finance</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_fix_multiple_ampersands(self):
        """Test fixing multiple unescaped ampersands"""
        xml_string = '<name>AT&T & Verizon</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<name>AT&amp;T &amp; Verizon</name>'
        assert len(fixes) == 2
        assert all(f['char'] == '&' for f in fixes)

    def test_fix_less_than_in_content(self):
        """Test fixing unescaped < in content"""
        xml_string = '<query>price < 100</query>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<query>price &lt; 100</query>'
        assert len(fixes) == 1
        assert fixes[0]['char'] == '<'
        assert fixes[0]['escaped_as'] == '&lt;'

    def test_fix_greater_than_in_content(self):
        """Test fixing unescaped > in content"""
        xml_string = '<query>price > 100</query>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<query>price &gt; 100</query>'
        assert len(fixes) == 1
        assert fixes[0]['char'] == '>'
        assert fixes[0]['escaped_as'] == '&gt;'

    def test_preserve_tags_with_less_than(self):
        """Test that < in tags is not escaped"""
        xml_string = '<requirement><name>Test</name></requirement>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_fix_double_quotes_in_content(self):
        """Test fixing unescaped double quotes in content"""
        xml_string = '<name>Say "Hello"</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<name>Say &quot;Hello&quot;</name>'
        assert len(fixes) == 2
        assert all(f['char'] == '"' for f in fixes)

    def test_fix_single_quotes_in_content(self):
        """Test fixing unescaped single quotes in content"""
        xml_string = "<name>It's working</name>"
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == "<name>It&apos;s working</name>"
        assert len(fixes) == 1
        assert fixes[0]['char'] == "'"
        assert fixes[0]['escaped_as'] == '&apos;'

    def test_fix_mixed_special_characters(self):
        """Test fixing multiple types of special characters"""
        xml_string = '<name>Test & "demo" < 100</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == '<name>Test &amp; &quot;demo&quot; &lt; 100</name>'
        assert len(fixes) == 4  # 1 ampersand, 2 quotes, 1 less-than

    def test_preserve_all_entity_types(self):
        """Test that all valid entity types are preserved"""
        xml_string = '<name>&amp; &lt; &gt; &quot; &apos; &#65; &#x41;</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_fix_incomplete_entity(self):
        """Test fixing incomplete entity reference"""
        xml_string = '<name>Test &amp value</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        # &amp without ; should be treated as separate & and amp
        assert '&amp;' in fixed
        assert len(fixes) >= 1

    def test_real_world_web_search_example(self):
        """Test with real-world example from web_search tool"""
        xml_string = '''<requirements>
    <requirement>
        <name>Tech & Finance News</name>
        <query>2025年12月8日 科技 财经 新闻</query>
    </requirement>
</requirements>'''
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert 'Tech &amp; Finance News' in fixed
        assert len(fixes) == 1
        assert fixes[0]['char'] == '&'

    def test_complex_nested_xml(self):
        """Test with complex nested XML structure"""
        xml_string = '''<requirements>
    <requirement>
        <name>AT&T Analysis</name>
        <query>AT&T "quarterly report" > Q3</query>
        <description>Price < $50 & trending up</description>
    </requirement>
</requirements>'''
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert '&amp;' in fixed
        assert '&lt;' in fixed
        assert '&gt;' in fixed
        assert '&quot;' in fixed
        assert len(fixes) > 0

    def test_format_fixes_message_single_fix(self):
        """Test formatting single fix into message"""
        fixes = [
            {'char': '&', 'escaped_as': '&amp;', 'position': 10, 'context': 'Tech [&] Finance'}
        ]
        message = XMLEscapeFixer.format_fixes_message(fixes)

        assert 'XML格式已自动修复' in message
        assert "'&'" in message
        assert "'&amp;'" in message
        assert '1处' in message

    def test_format_fixes_message_multiple_fixes(self):
        """Test formatting multiple fixes into message"""
        fixes = [
            {'char': '&', 'escaped_as': '&amp;', 'position': 10, 'context': 'Tech [&] Finance'},
            {'char': '&', 'escaped_as': '&amp;', 'position': 20, 'context': 'AT[&]T'},
            {'char': '<', 'escaped_as': '&lt;', 'position': 30, 'context': 'price [<] 100'},
        ]
        message = XMLEscapeFixer.format_fixes_message(fixes)

        assert 'XML格式已自动修复' in message
        assert "'&'" in message
        assert '2处' in message  # 2 ampersands
        assert "'<'" in message
        assert '1处' in message  # 1 less-than

    def test_format_fixes_message_empty(self):
        """Test formatting empty fixes list"""
        message = XMLEscapeFixer.format_fixes_message([])
        assert message == ""

    def test_get_context(self):
        """Test context extraction"""
        text = "This is a test string with special & character in the middle"
        pos = text.index('&')
        context = XMLEscapeFixer._get_context(text, pos, context_length=10)

        assert '[&]' in context
        assert 'special' in context
        assert 'character' in context

    def test_get_context_at_start(self):
        """Test context extraction at start of string"""
        text = "& character at start"
        context = XMLEscapeFixer._get_context(text, 0, context_length=10)

        assert '[&]' in context
        assert not context.startswith('...')

    def test_get_context_at_end(self):
        """Test context extraction at end of string"""
        text = "character at end &"
        pos = len(text) - 1
        context = XMLEscapeFixer._get_context(text, pos, context_length=10)

        assert '[&]' in context
        assert not context.endswith('...')

    def test_empty_string(self):
        """Test with empty string"""
        fixed, fixes = XMLEscapeFixer.fix_xml_string('')
        assert fixed == ''
        assert len(fixes) == 0

    def test_string_with_only_tags(self):
        """Test string with only XML tags, no content"""
        xml_string = '<root><child></child></root>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_preserve_numeric_entity_decimal(self):
        """Test that decimal numeric entities are preserved"""
        xml_string = '<name>Letter A: &#65;</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_preserve_numeric_entity_hex(self):
        """Test that hexadecimal numeric entities are preserved"""
        xml_string = '<name>Letter A: &#x41;</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        assert fixed == xml_string
        assert len(fixes) == 0

    def test_multiple_ampersands_mixed(self):
        """Test mix of valid and invalid ampersands"""
        xml_string = '<name>Valid &amp; entity & invalid &lt; also valid & another invalid</name>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        # Valid entities preserved, invalid ones fixed
        assert fixed.count('&amp;') == 3  # 1 original + 2 fixed
        assert fixed.count('&lt;') == 1  # preserved
        assert len(fixes) == 2  # 2 invalid ampersands fixed

    def test_quotes_in_attribute_vs_content(self):
        """Test that quotes in attributes are handled differently from content"""
        # Note: Our fixer focuses on content between tags
        xml_string = '<element attr="value">Content with "quotes"</element>'
        fixed, fixes = XMLEscapeFixer.fix_xml_string(xml_string)

        # Quotes in content should be fixed
        assert '&quot;' in fixed
        # The implementation should handle this correctly


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
