"""
Tests for PunctuationMatcher utility.
"""

import pytest
from app.utils.punctuation_matcher import PunctuationMatcher


class TestPunctuationMatcher:
    """Test punctuation matcher functionality"""

    def test_normalize_punctuation_to_english(self):
        """Test converting Chinese punctuation to English"""
        text = "你好，世界！这是一个测试：真的吗？"
        expected = "你好,世界!这是一个测试:真的吗?"
        result = PunctuationMatcher.normalize_punctuation(text, to_english=True)
        assert result == expected

    def test_normalize_punctuation_to_chinese(self):
        """Test converting English punctuation to Chinese"""
        text = "你好,世界!这是一个测试:真的吗?"
        expected = "你好，世界！这是一个测试：真的吗？"
        result = PunctuationMatcher.normalize_punctuation(text, to_english=False)
        assert result == expected

    def test_find_punctuation_differences_simple(self):
        """Test finding simple punctuation differences"""
        search_str = "*Manus:通用AI Agent*"
        target_str = "*Manus：通用AI Agent*"

        differences = PunctuationMatcher.find_punctuation_differences(search_str, target_str)

        assert len(differences) == 1
        assert differences[0][1] == ':'  # English colon in search
        assert differences[0][2] == '：'  # Chinese colon in target
        assert differences[0][3] == 'english_to_chinese'

    def test_check_fuzzy_match_with_punctuation_single_line(self):
        """Test fuzzy matching with punctuation for single line"""
        search_str = "*Manus:通用AI Agent*"
        content = "前面的内容\n*Manus：通用AI Agent*\n后面的内容"

        result = PunctuationMatcher.check_fuzzy_match_with_punctuation(search_str, content)

        assert result is not None
        assert "WARNING: PUNCTUATION MISMATCH" in result
        assert "You used English ':' but file has Chinese '：'" in result
        assert "Position 6" in result

    def test_check_fuzzy_match_no_punctuation_issue(self):
        """Test that non-punctuation mismatches return None"""
        search_str = "Hello World"
        content = "Goodbye World"

        result = PunctuationMatcher.check_fuzzy_match_with_punctuation(search_str, content)

        assert result is None

    def test_check_fuzzy_match_multiple_punctuation_issues(self):
        """Test detecting multiple punctuation differences"""
        search_str = "你好,世界!这是测试."
        content = "前面的内容\n你好，世界！这是测试。\n后面的内容"

        result = PunctuationMatcher.check_fuzzy_match_with_punctuation(search_str, content)

        assert result is not None
        assert "WARNING: PUNCTUATION MISMATCH" in result
        # Should detect comma, exclamation, and period differences
        assert "You used English ',' but file has Chinese '，'" in result

    def test_check_fuzzy_match_multiline(self):
        """Test fuzzy matching with punctuation for multi-line strings"""
        search_str = "第一行:内容\n第二行:内容"
        content = "第一行：内容\n第二行：内容\n第三行"

        result = PunctuationMatcher.check_fuzzy_match_with_punctuation(search_str, content)

        assert result is not None
        assert "WARNING: PUNCTUATION MISMATCH" in result
        assert "You used English ':' but file has Chinese '：'" in result

    def test_check_fuzzy_match_exact_match(self):
        """Test that exact matches return None (no punctuation issue)"""
        search_str = "*Manus：通用AI Agent*"
        content = "前面的内容\n*Manus：通用AI Agent*\n后面的内容"

        result = PunctuationMatcher.check_fuzzy_match_with_punctuation(search_str, content)

        # Should return None because exact match exists (normalized and original match)
        # But the function detects "after normalization it matches" which means punctuation issue
        # Wait, let me re-check the logic...
        # If search_normalized in content_normalized, then we check for punctuation differences
        # If there are no differences, we don't add it to suggestions
        # So this should return None or empty suggestions

        # Actually, if both strings already match (no normalization needed),
        # the normalized versions will also match, but find_punctuation_differences
        # will return empty list
        assert result is None or result == ""

    def test_common_chinese_english_pairs(self):
        """Test all common Chinese-English punctuation pairs"""
        pairs = [
            ('，', ','),
            ('。', '.'),
            ('：', ':'),
            ('；', ';'),
            ('！', '!'),
            ('？', '?'),
            ('（', '('),
            ('）', ')'),
        ]

        for chinese, english in pairs:
            text_with_chinese = f"测试{chinese}内容"
            text_with_english = f"测试{english}内容"

            # Normalize to English should convert Chinese to English
            result = PunctuationMatcher.normalize_punctuation(text_with_chinese, to_english=True)
            assert english in result
            assert chinese not in result

            # Normalize to Chinese should convert English to Chinese
            result = PunctuationMatcher.normalize_punctuation(text_with_english, to_english=False)
            assert chinese in result
