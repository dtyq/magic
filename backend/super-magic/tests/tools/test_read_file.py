#!/usr/bin/env python3
"""
Unit tests for ReadFile tool, focusing on fuzzy path matching functionality
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock

import pytest

# Add project root directory to Python path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Set project root directory
from app.paths import PathManager
PathManager.set_project_root(project_root)

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.read_file import ReadFile, ReadFileParams


class TestReadFileFuzzyMatch:
    """Test cases for fuzzy path matching in ReadFile tool"""

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing"""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)

        yield workspace

        # Clean up
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def mock_tool_context(self):
        """Create mock ToolContext"""
        context = Mock(spec=ToolContext)
        return context

    @pytest.fixture
    def read_file_tool(self, temp_workspace):
        """Create ReadFile tool instance with temp workspace"""
        tool = ReadFile()
        tool.base_dir = temp_workspace
        return tool

    @pytest.mark.asyncio
    async def test_exact_match_no_fuzzy_match_needed(self, read_file_tool, temp_workspace):
        """Test exact path match - fuzzy matching should not be triggered"""
        # Create a test file with English punctuation
        test_file = temp_workspace / "test_file(1).txt"
        test_content = "This is a test file with English punctuation."
        test_file.write_text(test_content, encoding="utf-8")

        # Read with exact path
        params = ReadFileParams(
            file_path="test_file(1).txt",
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok, f"Expected success, got error: {result.content}"

        # Verify no fuzzy match warning in content
        assert "Path Auto-Correction Applied" not in result.content
        assert "mixed Chinese/English punctuation" not in result.content

        # Verify file content is present
        assert "test file with English punctuation" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_success_chinese_to_english_punctuation(self, read_file_tool, temp_workspace):
        """Test fuzzy match with Chinese punctuation converted to English"""
        # Create a test file with English punctuation
        actual_file = temp_workspace / "report(2023).txt"
        test_content = "This is the 2023 report."
        actual_file.write_text(test_content, encoding="utf-8")

        # Try to read with Chinese punctuation - should trigger fuzzy match
        params = ReadFileParams(
            file_path="report（2023）.txt",  # Chinese parentheses
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify fuzzy match warning is present
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content
        assert "report（2023）.txt" in result.content  # Original path with Chinese punctuation
        assert "report(2023).txt" in result.content  # Matched path with English punctuation
        assert "IMPORTANT" in result.content  # Should have important notice

        # Verify file content is correctly read
        assert "2023 report" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_multiple_punctuation_types(self, read_file_tool, temp_workspace):
        """Test fuzzy match with multiple types of Chinese punctuation"""
        # Create a test file with multiple English punctuations
        actual_file = temp_workspace / "data[2023-12-31].csv"
        test_content = "date,value\n2023-12-31,100"
        actual_file.write_text(test_content, encoding="utf-8")

        # Try to read with Chinese punctuation
        params = ReadFileParams(
            file_path="data【2023－12－31】.csv",  # Chinese brackets and dashes
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success with fuzzy match
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify warning message
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content

        # Verify content is read correctly
        assert "date,value" in result.content or "2023-12-31" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_in_subdirectory(self, read_file_tool, temp_workspace):
        """Test fuzzy match for files in subdirectories"""
        # Create subdirectory and file
        subdir = temp_workspace / "reports"
        subdir.mkdir()
        actual_file = subdir / "summary(final).md"
        test_content = "# Final Summary\n\nThis is the final report."
        actual_file.write_text(test_content, encoding="utf-8")

        # Try to read with Chinese punctuation
        params = ReadFileParams(
            file_path="reports/summary（final）.md",  # Chinese parentheses
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify fuzzy match warning
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content

        # Verify file content
        assert "Final Summary" in result.content or "final report" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_failure_file_not_exists(self, read_file_tool, temp_workspace):
        """Test fuzzy match fails when no matching file exists"""
        # Don't create any file

        # Try to read non-existent file with Chinese punctuation
        params = ReadFileParams(
            file_path="nonexistent（file）.txt",
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify failure
        assert not result.ok, "Expected failure for non-existent file"
        assert "无法找到要读取的文件" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_warning_content_structure(self, read_file_tool, temp_workspace):
        """Test that fuzzy match warning appears at the end of content"""
        # Create test file
        actual_file = temp_workspace / "test(123).txt"
        test_content = "Line 1\nLine 2\nLine 3"
        actual_file.write_text(test_content, encoding="utf-8")

        # Read with Chinese punctuation
        params = ReadFileParams(
            file_path="test（123）.txt",
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok

        # Split content into lines and check warning is at the end
        lines = result.content.split('\n')
        # The warning should appear at the end (after the file content)
        warning_line_idx = None
        for idx, line in enumerate(lines):
            if "Path Auto-Correction Applied" in line:
                warning_line_idx = idx
                break

        assert warning_line_idx is not None, "Warning not found in content"
        # Warning should be near the end (after the file content)
        total_lines = len(lines)
        # Warning should appear in the last portion of the content
        assert warning_line_idx > total_lines * 0.5, f"Warning should appear near the end, but found at line {warning_line_idx} out of {total_lines}"

    @pytest.mark.asyncio
    async def test_fuzzy_match_with_offset_and_limit(self, read_file_tool, temp_workspace):
        """Test fuzzy match works correctly with offset and limit parameters"""
        # Create test file with multiple lines
        actual_file = temp_workspace / "lines(test).txt"
        test_content = "\n".join([f"Line {i}" for i in range(1, 21)])  # 20 lines
        actual_file.write_text(test_content, encoding="utf-8")

        # Read with Chinese punctuation, offset and limit
        params = ReadFileParams(
            file_path="lines（test）.txt",
            offset=5,  # Start from line 6
            limit=5    # Read 5 lines
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok, f"Expected success, got error: {result.content}"

        # Verify fuzzy match warning
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content

        # Verify correct lines are read (line 6-10)
        assert "Line 6" in result.content
        assert "Line 10" in result.content
        # Line 5 and Line 11 should not be in the displayed content (though metadata might mention line numbers)
        # We need to check the actual content part, not metadata

    @pytest.mark.asyncio
    async def test_no_fuzzy_match_when_file_has_no_chinese_punctuation(self, read_file_tool, temp_workspace):
        """Test that fuzzy match is not attempted when filename has no Chinese punctuation"""
        # Create a test file
        actual_file = temp_workspace / "normal_file.txt"
        test_content = "Normal file content"
        actual_file.write_text(test_content, encoding="utf-8")

        # Try to read a different file (no Chinese punctuation, but file doesn't exist)
        params = ReadFileParams(
            file_path="nonexistent_file.txt",  # No Chinese punctuation
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify failure (fuzzy match should not help since no Chinese punctuation)
        assert not result.ok
        assert "无法找到要读取的文件" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_extra_info_contains_correct_paths(self, read_file_tool, temp_workspace):
        """Test that extra_info contains correct original and read paths after fuzzy match"""
        # Create test file
        actual_file = temp_workspace / "doc(v1).txt"
        test_content = "Document version 1"
        actual_file.write_text(test_content, encoding="utf-8")

        # Read with Chinese punctuation
        params = ReadFileParams(
            file_path="doc（v1）.txt",
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success
        assert result.ok

        # Check extra_info
        assert result.extra_info is not None
        assert "original_file_path" in result.extra_info
        assert "read_path" in result.extra_info

        # Both paths should point to the actual file (with English punctuation)
        # because fuzzy match resolved the path
        original_path = Path(result.extra_info["original_file_path"])
        read_path = Path(result.extra_info["read_path"])

        # After fuzzy match, both should be the actual file
        assert original_path.name == "doc(v1).txt"
        assert read_path.name == "doc(v1).txt"

    @pytest.mark.asyncio
    async def test_fuzzy_match_mixed_punctuation_in_both_sides(self, read_file_tool, temp_workspace):
        """Test fuzzy match when both file and input have mixed Chinese/English punctuation"""
        # Create a file with mixed punctuation: Chinese and English
        actual_file = temp_workspace / "你好（1）(2).txt"
        test_content = "Mixed punctuation test content"
        actual_file.write_text(test_content, encoding="utf-8")

        # Try to read with different mixed punctuation: English and Chinese (reversed)
        params = ReadFileParams(
            file_path="你好(1)（2）.txt",  # Different mixed pattern
            offset=0,
            limit=-1
        )

        result = await read_file_tool.execute_purely(params)

        # Verify success - should match because both normalize to "你好(1)(2).txt"
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify fuzzy match warning is present
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content

        # Verify file content is correctly read
        assert "Mixed punctuation test" in result.content

        # Verify the matched file is the actual file
        assert result.extra_info is not None
        original_path = Path(result.extra_info["original_file_path"])
        assert original_path.name == "你好（1）(2).txt"


class TestReadFileActionAndRemark:
    """Test cases for get_after_tool_call_friendly_action_and_remark method

    Tests the complete flow: execute_purely -> get_after_tool_call_friendly_action_and_remark
    """

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing"""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)
        yield workspace
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def mock_tool_context(self):
        """Create mock ToolContext with metadata tracking"""
        context = Mock(spec=ToolContext)
        # Store metadata in a dict to support get/set
        context._metadata = {}
        context.get_metadata = Mock(side_effect=lambda key: context._metadata.get(key))
        context.set_metadata = Mock(side_effect=lambda key, value: context._metadata.update({key: value}))
        return context

    @pytest.fixture
    def read_file_tool(self, temp_workspace):
        """Create ReadFile tool instance with temp workspace"""
        tool = ReadFile()
        tool.base_dir = temp_workspace
        return tool

    # ========== Success Cases ==========

    @pytest.mark.asyncio
    async def test_success_normal_file_remark_is_filename(self, read_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case - remark should be just the filename"""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Test content", encoding="utf-8")

        # Execute the read operation
        params = ReadFileParams(file_path="test.txt", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        # Get action and remark based on the real execution result
        arguments = {"file_path": "test.txt"}
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        assert action_remark["remark"] == "test.txt"

    @pytest.mark.asyncio
    async def test_success_with_subdirectory_remark_is_basename(self, read_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case with subdirectory - remark should be basename only"""
        subdir = temp_workspace / "subdir"
        subdir.mkdir()
        test_file = subdir / "document.md"
        test_file.write_text("Document content", encoding="utf-8")

        # Execute the read operation
        params = ReadFileParams(file_path="subdir/document.md", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        arguments = {"file_path": "subdir/document.md"}
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert action_remark["remark"] == "document.md"

    @pytest.mark.asyncio
    async def test_success_without_file_path_in_arguments(self, read_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case with empty arguments - should use default message"""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Test content", encoding="utf-8")

        # Execute the read operation
        params = ReadFileParams(file_path="test.txt", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        # Empty arguments dict (no file_path)
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, {}
        )

        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        # Without file_path in arguments, should use translated default fallback
        # Check that we got the translated default value
        assert len(action_remark["remark"]) > 0

    # ========== Error Cases ==========

    @pytest.mark.asyncio
    async def test_error_file_not_exist(self, read_file_tool, mock_tool_context):
        """Test: File not exist error - remark should show file name"""
        # Try to read a non-existent file
        params = ReadFileParams(file_path="missing.txt", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        arguments = {"file_path": "missing.txt"}
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert result.use_custom_remark
        assert "action" in action_remark
        assert "remark" in action_remark
        # The metadata should have been set during execute_purely
        assert mock_tool_context._metadata.get("error_type") == "read_file.error_file_not_exist"
        assert mock_tool_context._metadata.get("error_file_path") == "missing.txt"
        # Remark should match: "找不到文件 {{file_name}}"
        assert action_remark["remark"] == "找不到文件 missing.txt"

    @pytest.mark.asyncio
    async def test_error_is_directory(self, read_file_tool, mock_tool_context, temp_workspace):
        """Test: Is directory error - remark should show directory name"""
        # Create a directory
        test_dir = temp_workspace / "testdir"
        test_dir.mkdir()

        # Try to read the directory as a file
        params = ReadFileParams(file_path="testdir", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        arguments = {"file_path": "testdir"}
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert result.use_custom_remark
        assert mock_tool_context._metadata.get("error_type") == "read_file.error_is_directory"
        assert mock_tool_context._metadata.get("error_file_path") == "testdir"
        # Remark should match: "{{file_name}} 是一个文件夹，无法读取"
        assert action_remark["remark"] == "testdir 是一个文件夹，无法读取"

    @pytest.mark.asyncio
    async def test_error_fallback_to_arguments_for_file_path(self, read_file_tool, mock_tool_context):
        """Test: When metadata has no file_path, should fallback to arguments"""
        # Try to read non-existent file
        params = ReadFileParams(file_path="nonexist.txt", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        # Clear the error_file_path from metadata (simulating edge case)
        mock_tool_context._metadata["error_file_path"] = None

        arguments = {"file_path": "nonexist.txt"}
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, arguments
        )

        assert not result.ok
        # Should fallback to file_path from arguments
        assert action_remark["remark"] == "找不到文件 nonexist.txt"

    @pytest.mark.asyncio
    async def test_error_without_file_path_anywhere(self, read_file_tool, mock_tool_context):
        """Test: When no file_path in metadata or arguments, should show simple error message"""
        # Try to read non-existent file
        params = ReadFileParams(file_path="test.txt", offset=0, limit=-1)
        result = await read_file_tool.execute_purely(params, mock_tool_context)

        # Clear file_path from metadata
        mock_tool_context._metadata["error_file_path"] = None

        # Empty arguments dict (no file_path)
        action_remark = await read_file_tool.get_after_tool_call_friendly_action_and_remark(
            "read_file", mock_tool_context, result, 0.1, {}
        )

        assert not result.ok
        # Should show simple message without placeholder
        assert action_remark["remark"] == "找不到文件"
