"""
Tests for replace_range_resolver utility.
"""

import textwrap

import pytest

from app.utils.replace_range_resolver import resolve_replace_range


def _apply_range_replace(content: str, replace_start: str, replace_end: str, new_content: str) -> str:
    """Apply replacement using resolver output (same splice semantics as tool)."""
    resolved = resolve_replace_range(content, replace_start, replace_end)
    return content[:resolved.start_index] + new_content + content[resolved.end_index:]


class TestReplaceRangeResolver:
    """Core behavior tests for inclusive range replacement."""

    def test_replace_inclusive_with_both_anchors(self):
        original = "AAA\nBBB\nCCC\nDDD\n"
        result = _apply_range_replace(original, "BBB\n", "CCC\n", "XXX\n")
        assert result == "AAA\nXXX\nDDD\n"

        resolved = resolve_replace_range(original, "BBB\n", "CCC\n")
        assert resolved.start_line == 2
        assert resolved.end_line == 3

    def test_replace_with_empty_start(self):
        original = "AAA\nBBB\nCCC\n"
        result = _apply_range_replace(original, "", "BBB\n", "XXX\n")
        assert result == "XXX\nCCC\n"

    def test_replace_with_empty_end(self):
        original = "AAA\nBBB\nCCC\n"
        result = _apply_range_replace(original, "BBB\n", "", "XXX\n")
        assert result == "AAA\nXXX\n"

    def test_same_start_and_end_anchor_replaces_anchor_itself(self):
        original = "A\nB\nC\n"
        result = _apply_range_replace(original, "B\n", "B\n", "X\n")
        assert result == "A\nX\nC\n"

    def test_error_when_both_anchors_empty(self):
        with pytest.raises(ValueError, match="cannot both be empty"):
            resolve_replace_range("A\nB\n", "", "")

    def test_error_when_start_is_ambiguous(self):
        with pytest.raises(ValueError, match="replace_start is ambiguous"):
            resolve_replace_range("A\nB\nA\n", "A\n", "")

    def test_error_when_end_is_ambiguous(self):
        with pytest.raises(ValueError, match="replace_end is ambiguous"):
            resolve_replace_range("A\nB\nA\n", "", "A\n")

    def test_error_when_no_valid_ordered_range(self):
        # replace_start appears after all replace_end matches
        with pytest.raises(ValueError, match="No valid range found"):
            resolve_replace_range("END\nMID\nSTART\n", "START\n", "END\n")

    def test_error_when_range_is_ambiguous(self):
        content = "S\nx\nE\nS\ny\nE\n"
        with pytest.raises(ValueError, match="ambiguous"):
            resolve_replace_range(content, "S\n", "E\n")

    def test_replace_large_html_block_inclusive(self):
        original = textwrap.dedent(
            """\
            <!DOCTYPE html>
            <html>
            <head>
              <title>Dashboard</title>
            </head>
            <body>
              <header class="topbar">Top</header>
              <section id="hero">
                <div class="hero-title">旧标题</div>
                <div class="hero-subtitle">Old subtitle</div>
                <button class="cta">Start</button>
              </section><!-- hero -->
              <section id="content">
                <p>Body</p>
              </section>
            </body>
            </html>
            """
        )
        replacement = textwrap.dedent(
            """\
              <section id="hero">
                <div class="hero-title">新标题</div>
                <div class="hero-subtitle">New subtitle</div>
                <button class="cta">Launch</button>
                <small>Updated at 2026-02-10</small>
              </section><!-- hero -->
            """
        )

        result = _apply_range_replace(
            original,
            '  <section id="hero">\n',
            "  </section><!-- hero -->\n",
            replacement,
        )

        assert '<section id="hero">' in result
        assert "新标题" in result
        assert "Launch" in result
        assert '<section id="content">' in result
        assert result.count('<section id="hero">') == 1

    def test_replace_multilingual_markdown_section_inclusive(self):
        original = textwrap.dedent(
            """\
            # Project Notes

            ## 概览
            这是中文段落。
            This is an English paragraph.
            关键字：AI、Agent、Workflow。

            ## Usage
            1. Install
            2. Run

            ## 附录
            保留内容
            """
        )
        replacement = textwrap.dedent(
            """\
            ## 概览
            本节已更新：支持中英混排与术语统一。
            Updated summary: supports multilingual docs and stable replacement ranges.
            关键字：AI、Agent、Range Edit。

            ## Usage
            """
        )

        result = _apply_range_replace(
            original,
            "## 概览\n",
            "## Usage\n",
            replacement,
        )

        assert "本节已更新" in result
        assert "multilingual docs" in result
        assert "## 附录" in result
        assert result.count("## Usage") == 1

    def test_replace_multilingual_with_empty_end_to_file_tail(self):
        original = textwrap.dedent(
            """\
            ---
            title: 文档
            ---

            # Introduction
            Keep this section.

            ## Changelog
            - v1.0 初始版本
            - v1.1 修复 typo
            """
        )
        replacement = textwrap.dedent(
            """\
            ## Changelog
            - v2.0 统一替换语义（inclusive）
            - v2.1 新增区间编辑工具
            """
        )

        result = _apply_range_replace(original, "## Changelog\n", "", replacement)

        assert "Keep this section." in result
        assert "v2.0" in result
        assert "v1.0 初始版本" not in result
