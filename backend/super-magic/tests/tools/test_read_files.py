#!/usr/bin/env python3
"""
Unit tests for ReadFiles tool, focusing on batch file reading and fuzzy path matching
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock

import pytest

# Add project root directory to Python path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Set project root directory
from app.paths import PathManager
PathManager.set_project_root(project_root)

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.read_files import ReadFiles, ReadFilesParams, FileReadOperation


class TestReadFilesFuzzyMatch:
    """Test cases for fuzzy path matching in ReadFiles tool (batch reading)"""

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for testing"""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)
        yield workspace
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def mock_tool_context(self):
        """Create mock ToolContext"""
        context = Mock(spec=ToolContext)
        context.get_metadata = Mock(return_value=None)
        context.set_metadata = Mock()
        # Mock agent_context for file event dispatching
        mock_agent_context = Mock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.get_extension_typed = Mock(return_value=mock_agent_context)
        return context

    @pytest.fixture
    def read_files_tool(self, temp_workspace):
        """Create ReadFiles tool instance with temp workspace"""
        tool = ReadFiles()
        tool.base_dir = temp_workspace
        return tool

    @pytest.mark.asyncio
    async def test_single_file_exact_match_no_fuzzy(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test single file with exact path - no fuzzy matching"""
        # Create test file
        test_file = temp_workspace / "test(1).txt"
        test_file.write_text("Test content", encoding="utf-8")

        # Read with exact path
        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="test(1).txt", offset=0, limit=-1)
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        assert "Test content" in result.content
        # No fuzzy match warning
        assert "Path Auto-Correction Applied" not in result.content

    @pytest.mark.asyncio
    async def test_single_file_fuzzy_match_chinese_punctuation(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test single file with Chinese punctuation - should trigger fuzzy match"""
        # Create file with English punctuation
        actual_file = temp_workspace / "report(2023).txt"
        actual_file.write_text("This is the 2023 report.", encoding="utf-8")

        # Read with Chinese punctuation
        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="report（2023）.txt", offset=0, limit=-1)
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        assert "2023 report" in result.content
        # Should have fuzzy match warning
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content
        assert "report（2023）.txt" in result.content
        assert "report(2023).txt" in result.content

    @pytest.mark.asyncio
    async def test_multiple_files_all_exact_match(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test multiple files with exact paths - no fuzzy matching"""
        # Create multiple test files
        file1 = temp_workspace / "file1.txt"
        file1.write_text("Content of file 1", encoding="utf-8")
        file2 = temp_workspace / "file2.txt"
        file2.write_text("Content of file 2", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="file1.txt", offset=0, limit=-1),
                FileReadOperation(file_path="file2.txt", offset=0, limit=-1)
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        assert "Content of file 1" in result.content
        assert "Content of file 2" in result.content
        # No fuzzy match warnings
        assert "Path Auto-Correction Applied" not in result.content

    @pytest.mark.asyncio
    async def test_multiple_files_mixed_fuzzy_and_exact(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test multiple files with mixed fuzzy and exact matches"""
        # Create files with English punctuation
        file1 = temp_workspace / "data(2023).csv"
        file1.write_text("year,value\n2023,100", encoding="utf-8")
        file2 = temp_workspace / "normal.txt"
        file2.write_text("Normal file", encoding="utf-8")

        # Read with one Chinese punctuation and one exact
        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="data（2023）.csv", offset=0, limit=-1),  # Fuzzy
                FileReadOperation(file_path="normal.txt", offset=0, limit=-1)  # Exact
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        # CSV content is converted by plugin, so check for the year value
        assert "2023" in result.content and "100" in result.content
        assert "Normal file" in result.content
        # Should have fuzzy match warning for the first file
        assert "Path Auto-Correction Applied" in result.content
        assert "data（2023）.csv" in result.content
        assert "data(2023).csv" in result.content

    @pytest.mark.asyncio
    async def test_multiple_files_all_fuzzy_match(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test multiple files all requiring fuzzy matching"""
        # Create files with English punctuation
        file1 = temp_workspace / "file(1).txt"
        file1.write_text("First file", encoding="utf-8")
        file2 = temp_workspace / "file[2].txt"
        file2.write_text("Second file", encoding="utf-8")

        # Read with Chinese punctuation
        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="file（1）.txt", offset=0, limit=-1),
                FileReadOperation(file_path="file【2】.txt", offset=0, limit=-1)
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        assert "First file" in result.content
        assert "Second file" in result.content
        # Should have fuzzy match warnings for both files
        assert result.content.count("Path Auto-Correction Applied") == 2

    @pytest.mark.asyncio
    async def test_fuzzy_match_in_subdirectory(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test fuzzy match for files in subdirectories"""
        # Create subdirectory structure
        subdir = temp_workspace / "reports"
        subdir.mkdir()
        file1 = subdir / "summary(final).md"
        file1.write_text("Final summary", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="reports/summary（final）.md", offset=0, limit=-1)
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok
        assert "Final summary" in result.content
        assert "Path Auto-Correction Applied" in result.content

    @pytest.mark.asyncio
    async def test_one_file_fails_fuzzy_match_others_succeed(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test batch read where one file fails but others succeed"""
        # Create only one file
        file1 = temp_workspace / "exists.txt"
        file1.write_text("This exists", encoding="utf-8")
        # Don't create the second file

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="exists.txt", offset=0, limit=-1),
                FileReadOperation(file_path="missing（file）.txt", offset=0, limit=-1)  # Non-existent
            ]
        )

        result = await read_files_tool.execute(mock_tool_context, params)

        # Should still succeed (partial success)
        assert result.ok
        # First file content should be present
        assert "This exists" in result.content
        # Error for second file should be noted
        assert "missing" in result.content or "失败" in result.content


class TestReadFilesActionAndRemark:
    """Test cases for get_after_tool_call_friendly_action_and_remark method"""

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
        context._metadata = {}
        context.get_metadata = Mock(side_effect=lambda key: context._metadata.get(key))
        context.set_metadata = Mock(side_effect=lambda key, value: context._metadata.update({key: value}))
        # Mock agent_context for file event dispatching
        mock_agent_context = Mock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.get_extension_typed = Mock(return_value=mock_agent_context)
        return context

    @pytest.fixture
    def read_files_tool(self, temp_workspace):
        """Create ReadFiles tool instance with temp workspace"""
        tool = ReadFiles()
        tool.base_dir = temp_workspace
        return tool

    # ========== Success Cases ==========

    @pytest.mark.asyncio
    async def test_success_single_file_remark(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test: Success with single file - remark should be filename"""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Test content", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="test.txt", offset=0, limit=-1)
            ]
        )
        result = await read_files_tool.execute(mock_tool_context, params)

        arguments = {
            "operations": [{"file_path": "test.txt", "offset": 0, "limit": -1}]
        }
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        # For single file, should show success message with filename
        assert "test.txt" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_success_multiple_files_remark(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test: Success with multiple files - remark should show count"""
        file1 = temp_workspace / "file1.txt"
        file1.write_text("Content 1", encoding="utf-8")
        file2 = temp_workspace / "file2.txt"
        file2.write_text("Content 2", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="file1.txt", offset=0, limit=-1),
                FileReadOperation(file_path="file2.txt", offset=0, limit=-1)
            ]
        )
        result = await read_files_tool.execute(mock_tool_context, params)

        arguments = {
            "operations": [
                {"file_path": "file1.txt", "offset": 0, "limit": -1},
                {"file_path": "file2.txt", "offset": 0, "limit": -1}
            ]
        }
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        # For multiple files, should show first filename and count
        assert "file1.txt" in action_remark["remark"]
        assert "2" in action_remark["remark"]  # File count

    @pytest.mark.asyncio
    async def test_success_with_subdirectory(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test: Success with subdirectory path - remark should use basename"""
        subdir = temp_workspace / "docs"
        subdir.mkdir()
        test_file = subdir / "readme.md"
        test_file.write_text("Readme content", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="docs/readme.md", offset=0, limit=-1)
            ]
        )
        result = await read_files_tool.execute(mock_tool_context, params)

        arguments = {
            "operations": [{"file_path": "docs/readme.md", "offset": 0, "limit": -1}]
        }
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert "readme.md" in action_remark["remark"]

    # ========== Error Cases ==========
    # Note: Empty operations test is not possible due to pydantic validation (min_items=1)

    @pytest.mark.asyncio
    async def test_error_single_file_not_exist(self, read_files_tool, mock_tool_context):
        """Test: Error when single file doesn't exist"""
        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="missing.txt", offset=0, limit=-1)
            ]
        )
        result = await read_files_tool.execute(mock_tool_context, params)

        arguments = {
            "operations": [{"file_path": "missing.txt", "offset": 0, "limit": -1}]
        }
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, arguments
        )

        # Should still have result (with error info in content)
        assert "action" in action_remark
        assert "remark" in action_remark
        # Remark should mention the file
        assert "missing.txt" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_partial_failure_remark(self, read_files_tool, mock_tool_context, temp_workspace):
        """Test: Partial failure - some files succeed, some fail"""
        # Create only one file
        file1 = temp_workspace / "exists.txt"
        file1.write_text("Exists", encoding="utf-8")

        params = ReadFilesParams(
            operations=[
                FileReadOperation(file_path="exists.txt", offset=0, limit=-1),
                FileReadOperation(file_path="missing.txt", offset=0, limit=-1)
            ]
        )
        result = await read_files_tool.execute(mock_tool_context, params)

        arguments = {
            "operations": [
                {"file_path": "exists.txt", "offset": 0, "limit": -1},
                {"file_path": "missing.txt", "offset": 0, "limit": -1}
            ]
        }
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, arguments
        )

        # Should be successful overall (partial success model)
        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        # Should show first file and count
        assert "exists.txt" in action_remark["remark"]
        assert "2" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_error_metadata_without_file_path(self, read_files_tool, mock_tool_context):
        """Test: Error case where metadata doesn't have file path info"""
        # Set error type manually
        mock_tool_context._metadata["error_type"] = "read_file.failed"

        # Create a failed result
        result = ToolResult.error("Some error")
        result.use_custom_remark = True

        # No operations in arguments
        action_remark = await read_files_tool.get_after_tool_call_friendly_action_and_remark(
            "read_files", mock_tool_context, result, 0.1, {}
        )

        assert not result.ok
        # Should use READ_ERROR_NO_FILE when no file name available
        assert action_remark["remark"] == "找不到文件"
