#!/usr/bin/env python3
"""
Unit tests for GrepSearch tool, focusing on long-line protection.
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

import pytest

# Add project root directory to Python path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Set project root directory
from app.paths import PathManager

PathManager.set_project_root(project_root)

import app.tools.grep_search as grep_search_module
from app.tools.grep_search import GrepSearch, LineInfo


class TestGrepSearchLongLineProtection:
    """Test cases for grep_search long-line protection behavior."""

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing."""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)
        yield workspace
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def grep_tool(self, temp_workspace):
        """Create GrepSearch tool instance with temp workspace."""
        tool = GrepSearch()
        tool.base_dir = temp_workspace
        return tool

    def _build_match_event(self, file_path: Path, line_number: int, line_text: str, match_text: str) -> str:
        """Build one ripgrep JSON match event line."""
        start_byte = line_text.encode("utf-8").find(match_text.encode("utf-8"))
        end_byte = start_byte + len(match_text.encode("utf-8"))
        event = {
            "type": "match",
            "data": {
                "path": {"text": str(file_path)},
                "lines": {"text": f"{line_text}\n"},
                "line_number": line_number,
                "submatches": [
                    {
                        "match": {"text": match_text},
                        "start": start_byte,
                        "end": end_byte,
                    }
                ],
            },
        }
        return json.dumps(event, ensure_ascii=False)

    def test_parse_match_line_keeps_match_window_for_long_line(self, grep_tool, temp_workspace):
        """Long match line should be reduced to a match-centered preview."""
        file_path = temp_workspace / "long_line.log"
        long_line = f"{'a' * 600}TARGET{'b' * 700}"
        output = self._build_match_event(file_path, 10, long_line, "TARGET")

        parsed = grep_tool._parse_ripgrep_output(output)

        assert file_path in parsed
        assert len(parsed[file_path]) == 1
        parsed_line = parsed[file_path][0]
        assert parsed_line.is_match
        assert "TARGET" in parsed_line.content
        assert "[col " in parsed_line.content
        assert len(parsed_line.content) < len(long_line)

    def test_parse_match_line_supports_utf8_byte_offsets(self, grep_tool, temp_workspace):
        """UTF-8 line should map byte offsets to correct visible match content."""
        file_path = temp_workspace / "unicode.log"
        line = f"{'前缀' * 40}命中词{'后缀' * 40}"
        output = self._build_match_event(file_path, 8, line, "命中词")

        parsed = grep_tool._parse_ripgrep_output(output)

        assert file_path in parsed
        parsed_line = parsed[file_path][0]
        assert parsed_line.is_match
        assert "命中词" in parsed_line.content
        assert "[col " in parsed_line.content

    def test_parse_context_line_is_safely_truncated(self, grep_tool, temp_workspace):
        """Long context line should be truncated safely."""
        file_path = temp_workspace / "context.log"
        long_context = "x" * 2000
        event = {
            "type": "context",
            "data": {
                "path": {"text": str(file_path)},
                "lines": {"text": f"{long_context}\n"},
                "line_number": 3,
            },
        }
        output = json.dumps(event, ensure_ascii=False)

        parsed = grep_tool._parse_ripgrep_output(output)

        parsed_line = parsed[file_path][0]
        assert not parsed_line.is_match
        assert "truncated" in parsed_line.content
        assert len(parsed_line.content) < len(long_context)

    @pytest.mark.asyncio
    async def test_format_matches_truncates_when_output_budget_exceeded(self, grep_tool, temp_workspace, monkeypatch):
        """Formatted output should be truncated when budget is exceeded."""
        target_file = temp_workspace / "sample.txt"
        target_file.write_text("line1\nline2\nline3\n", encoding="utf-8")

        lines = [
            LineInfo(line_number=index + 1, content=f"{'x' * 220}TARGET{'y' * 220}", is_match=True)
            for index in range(30)
        ]
        matches = {target_file: lines}

        monkeypatch.setattr(grep_search_module, "MAX_FORMATTED_OUTPUT_TOKENS", 80)
        monkeypatch.setattr(grep_search_module, "MAX_FORMATTED_OUTPUT_CHARS", 600)

        formatted = await grep_tool._format_matches(matches, max_files=20)

        assert "Output truncated" in formatted
        assert "Narrow path/include/pattern" in formatted
