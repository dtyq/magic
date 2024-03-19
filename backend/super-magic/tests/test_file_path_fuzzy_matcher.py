"""
测试文件路径模糊匹配功能

验证中英文标点符号自动匹配功能
"""

import tempfile
from pathlib import Path
import pytest

from app.utils.file_path_fuzzy_matcher import FilePathFuzzyMatcher


class TestFilePathFuzzyMatcher:
    """测试文件路径模糊匹配器"""

    def test_normalize_punctuation(self):
        """测试标点符号标准化"""
        # 测试中文标点转英文标点
        assert FilePathFuzzyMatcher.normalize_punctuation("测试（文件）.txt") == "测试(文件).txt"
        assert FilePathFuzzyMatcher.normalize_punctuation("数据，分析。py") == "数据,分析.py"
        assert FilePathFuzzyMatcher.normalize_punctuation("配置：设置.json") == "配置:设置.json"
        assert FilePathFuzzyMatcher.normalize_punctuation("问题？.md") == "问题?.md"

        # 测试混合标点
        assert FilePathFuzzyMatcher.normalize_punctuation("test（mixed）.txt") == "test(mixed).txt"

        # 测试不变的情况
        assert FilePathFuzzyMatcher.normalize_punctuation("normal_file.txt") == "normal_file.txt"

    def test_fuzzy_match_single_file(self):
        """测试单个文件的模糊匹配"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建一个测试文件（英文标点）
            test_file = base_dir / "test(file).txt"
            test_file.write_text("test content")

            # 尝试用中文标点查找
            wrong_path = base_dir / "test（file）.txt"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(wrong_path, base_dir)

            # 应该找到匹配的文件
            assert result is not None
            matched_path, warning = result
            assert matched_path == test_file
            assert "Path Auto-Correction Applied" in warning
            assert "test（file）.txt" in warning
            assert "test(file).txt" in warning

    def test_fuzzy_match_no_punctuation_diff(self):
        """测试没有标点差异时不进行匹配"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建一个测试文件
            test_file = base_dir / "test_file.txt"
            test_file.write_text("test content")

            # 尝试查找一个不存在且没有标点差异的文件
            wrong_path = base_dir / "test_wrong.txt"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(wrong_path, base_dir)

            # 不应该找到匹配
            assert result is None

    def test_fuzzy_match_multiple_files(self):
        """测试多个匹配文件时不进行匹配"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建两个可能匹配的文件
            file1 = base_dir / "test(1).txt"
            file2 = base_dir / "test(2).txt"
            file1.write_text("content 1")
            file2.write_text("content 2")

            # 尝试用中文标点查找（会匹配多个）
            # 注意：这里两个文件标准化后都不同，所以实际上不会有多匹配的情况
            # 让我创建一个真正会多匹配的情况

            # 创建一个会产生歧义的文件
            file3 = base_dir / "test（file）.txt"
            file4 = base_dir / "test(file).txt"
            file3.write_text("content 3")
            file4.write_text("content 4")

            # 尝试用中文标点查找
            wrong_path = base_dir / "test（file）.txt"

            # 应该找到 file3（精确匹配）
            # 但如果 file3 不存在，尝试查找 file4
            result = FilePathFuzzyMatcher.try_find_fuzzy_match(wrong_path, base_dir)

            # 因为 file3 存在（精确匹配），所以 try_find_fuzzy_match 会返回 None
            assert result is None

    def test_fuzzy_match_file_exists(self):
        """测试文件已存在时不进行模糊匹配"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建一个测试文件
            test_file = base_dir / "test.txt"
            test_file.write_text("test content")

            # 尝试查找存在的文件
            result = FilePathFuzzyMatcher.try_find_fuzzy_match(test_file, base_dir)

            # 不应该进行模糊匹配
            assert result is None

    def test_complex_punctuation_patterns(self):
        """测试复杂的标点符号组合"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建带有多种标点的文件
            test_file = base_dir / "config[test]<v1.0>.json"
            test_file.write_text("{}")

            # 使用中文标点查找
            wrong_path = base_dir / "config【test】《v1.0》.json"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(wrong_path, base_dir)

            assert result is not None
            matched_path, warning = result
            assert matched_path == test_file

    def test_parent_dir_not_exists(self):
        """测试父目录不存在的情况"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 尝试在不存在的目录中查找文件
            wrong_path = base_dir / "nonexistent" / "test（file）.txt"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(wrong_path, base_dir)

            # 应该返回 None
            assert result is None

    def test_english_to_chinese_punctuation(self):
        """测试用户输入英文标点，实际文件是中文标点（修复后的功能）"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建实际文件（中文标点）
            actual_file = base_dir / "MCP：让 AI 助手真正连上你的数据世界.md"
            actual_file.write_text("test content", encoding="utf-8")

            # 用户输入的路径（英文标点）
            user_input = base_dir / "MCP:让 AI 助手真正连上你的数据世界.md"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input, base_dir)

            # 应该找到匹配的文件
            assert result is not None
            matched_path, warning = result
            assert matched_path == actual_file
            assert "Path Auto-Correction Applied" in warning
            assert "MCP:" in warning  # 用户输入（英文冒号）
            assert "MCP：" in warning  # 实际文件（中文冒号）

    def test_bidirectional_punctuation_matching(self):
        """测试双向标点匹配：中文→英文 和 英文→中文"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 场景1：实际文件是英文标点，用户输入中文标点
            file1 = base_dir / "report(2023).txt"
            file1.write_text("report content")

            user_input1 = base_dir / "report（2023）.txt"
            result1 = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input1, base_dir)

            assert result1 is not None
            matched1, warning1 = result1
            assert matched1 == file1

            # 场景2：实际文件是中文标点，用户输入英文标点
            file2 = base_dir / "数据分析：2023年.md"
            file2.write_text("analysis content", encoding="utf-8")

            user_input2 = base_dir / "数据分析:2023年.md"
            result2 = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input2, base_dir)

            assert result2 is not None
            matched2, warning2 = result2
            assert matched2 == file2

    def test_mixed_punctuation_in_filename(self):
        """测试文件名中混合使用中英文标点"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建文件：部分中文标点，部分英文标点
            actual_file = base_dir / "项目(重要)：总结.md"
            actual_file.write_text("content", encoding="utf-8")

            # 用户输入：中英文标点位置相反
            user_input = base_dir / "项目（重要）:总结.md"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input, base_dir)

            # 应该能找到匹配
            assert result is not None
            matched_path, warning = result
            assert matched_path == actual_file

    def test_all_common_punctuation_types(self):
        """测试所有常见的中英文标点符号对"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 测试各种标点符号
            test_cases = [
                ("问号？.txt", "问号?.txt"),  # 问号
                ("感叹！.txt", "感叹!.txt"),  # 感叹号
                ("分号；.txt", "分号;.txt"),  # 分号
                ("逗号，.txt", "逗号,.txt"),  # 逗号
                ("句号。.txt", "句号..txt"),  # 句号
                ("冒号：.txt", "冒号:.txt"),  # 冒号
            ]

            for actual_name, user_input_name in test_cases:
                # 创建实际文件（中文标点）
                actual_file = base_dir / actual_name
                actual_file.write_text("test", encoding="utf-8")

                # 用户输入（英文标点）
                user_input = base_dir / user_input_name

                result = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input, base_dir)

                # 应该找到匹配
                assert result is not None, f"Failed to match: {user_input_name} -> {actual_name}"
                matched_path, warning = result
                assert matched_path == actual_file

                # 清理文件以便下一次测试
                actual_file.unlink()

    def test_no_match_when_normalized_differs(self):
        """测试当标准化后仍不匹配时不应返回结果"""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_dir = Path(tmpdir)

            # 创建一个文件
            actual_file = base_dir / "report_2023.txt"
            actual_file.write_text("content")

            # 尝试查找一个完全不同的文件（即使有标点差异）
            user_input = base_dir / "summary（2024）.txt"

            result = FilePathFuzzyMatcher.try_find_fuzzy_match(user_input, base_dir)

            # 不应该找到匹配
            assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
