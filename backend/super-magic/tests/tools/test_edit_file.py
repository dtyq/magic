#!/usr/bin/env python3
"""
Unit tests for EditFile tool, focusing on fuzzy path matching and action/remark functionality
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
from app.tools.edit_file import EditFile, EditFileParams
from app.utils.file_timestamp_manager import get_global_timestamp_manager


class TestEditFileFuzzyMatch:
    """Test cases for fuzzy path matching in EditFile tool"""

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
    def edit_file_tool(self, temp_workspace):
        """Create EditFile tool instance with temp workspace"""
        tool = EditFile()
        tool.base_dir = temp_workspace
        return tool

    @pytest.mark.asyncio
    async def test_exact_match_no_fuzzy_match_needed(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test exact path match - fuzzy matching should not be triggered"""
        # Create a test file with English punctuation
        test_file = temp_workspace / "config(prod).json"
        test_content = '{"env": "production"}'
        test_file.write_text(test_content, encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Edit with exact path
        params = EditFileParams(
            file_path="config(prod).json",
            old_string='"production"',
            new_string='"staging"',
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok, f"Expected success, got error: {result.content}"

        # Verify no fuzzy match warning in content
        assert "Path Auto-Correction Applied" not in result.content
        assert "mixed Chinese/English punctuation" not in result.content

        # Verify file was edited
        edited_content = test_file.read_text(encoding="utf-8")
        assert '"staging"' in edited_content

    @pytest.mark.asyncio
    async def test_fuzzy_match_success_chinese_to_english_punctuation(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test fuzzy match with Chinese punctuation converted to English"""
        # Create a test file with English punctuation
        actual_file = temp_workspace / "settings(dev).yaml"
        test_content = "debug: true\nport: 8080"
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Try to edit with Chinese punctuation - should trigger fuzzy match
        params = EditFileParams(
            file_path="settings（dev）.yaml",  # Chinese parentheses
            old_string="8080",
            new_string="9000",
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify fuzzy match warning is present at the end
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content
        assert "settings（dev）.yaml" in result.content  # Original path
        assert "settings(dev).yaml" in result.content  # Matched path
        assert "IMPORTANT" in result.content

        # Verify file was edited correctly
        edited_content = actual_file.read_text(encoding="utf-8")
        assert "port: 9000" in edited_content

    @pytest.mark.asyncio
    async def test_fuzzy_match_in_subdirectory(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test fuzzy match for files in subdirectories"""
        # Create subdirectory and file
        subdir = temp_workspace / "configs"
        subdir.mkdir()
        actual_file = subdir / "app(v2).conf"
        test_content = "version=2\nstatus=active"
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Try to edit with Chinese punctuation
        params = EditFileParams(
            file_path="configs/app（v2）.conf",  # Chinese parentheses
            old_string="active",
            new_string="inactive",
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok, f"Expected success with fuzzy match, got error: {result.content}"

        # Verify fuzzy match warning
        assert "Path Auto-Correction Applied" in result.content
        assert "mixed Chinese/English punctuation" in result.content

        # Verify file was edited
        edited_content = actual_file.read_text(encoding="utf-8")
        assert "status=inactive" in edited_content

    @pytest.mark.asyncio
    async def test_fuzzy_match_failure_file_not_exists(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test fuzzy match fails when no matching file exists"""
        # Don't create any file

        # Try to edit non-existent file with Chinese punctuation
        params = EditFileParams(
            file_path="nonexistent（file）.txt",
            old_string="old",
            new_string="new",
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify failure
        assert not result.ok, "Expected failure for non-existent file"
        assert "File does not exist" in result.content

    @pytest.mark.asyncio
    async def test_fuzzy_match_warning_at_end_of_output(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test that fuzzy match warning appears at the end of output"""
        # Create test file
        actual_file = temp_workspace / "data(2023).txt"
        test_content = "Year: 2023\nStatus: Draft"
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Edit with Chinese punctuation
        params = EditFileParams(
            file_path="data（2023）.txt",
            old_string="Draft",
            new_string="Final",
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok

        # Check warning is at the end
        lines = result.content.split('\n')
        warning_line_idx = None
        for idx, line in enumerate(lines):
            if "Path Auto-Correction Applied" in line:
                warning_line_idx = idx
                break

        assert warning_line_idx is not None, "Warning not found in output"
        # Warning should be near the end
        total_lines = len(lines)
        assert warning_line_idx > total_lines * 0.5, f"Warning should appear near the end, but found at line {warning_line_idx} out of {total_lines}"

    @pytest.mark.asyncio
    async def test_auto_fix_punctuation_in_old_string(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test auto-fix when old_string has punctuation mismatch"""
        # Create a file with English punctuation in content
        actual_file = temp_workspace / "test.py"
        test_content = 'def hello(name):\n    print("Hello")\n'
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Try to edit with Chinese punctuation in old_string - should auto-fix
        params = EditFileParams(
            file_path="test.py",
            old_string='def hello（name）：',  # Chinese parentheses and colon
            new_string='def hello(name, age):',
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok, f"Expected success with auto-fix, got error: {result.content}"

        # Verify auto-fix warning is present
        assert "Auto-Correction Applied: Punctuation Mismatch Fixed" in result.content
        assert "IMPORTANT" in result.content
        assert "exact punctuation style" in result.content

        # Verify file was edited correctly
        edited_content = actual_file.read_text(encoding="utf-8")
        assert "def hello(name, age):" in edited_content

    @pytest.mark.asyncio
    async def test_auto_fix_fails_multiple_matches(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test auto-fix fails when there are multiple matches after normalization"""
        # Create a file with multiple occurrences of the same pattern
        actual_file = temp_workspace / "test.txt"
        test_content = 'func(test)\nfunc(test)\nfunc(test)\n'  # Same content 3 times
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Try to edit with Chinese punctuation - should fail because multiple matches
        params = EditFileParams(
            file_path="test.txt",
            old_string='func（test）',  # Chinese parentheses
            new_string='func(x)',
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Should fail with punctuation mismatch error
        assert not result.ok
        assert "PUNCTUATION MISMATCH DETECTED" in result.content

    @pytest.mark.asyncio
    async def test_auto_fix_warning_at_end_of_output(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test that auto-fix warning appears at the end of output"""
        # Create test file
        actual_file = temp_workspace / "data.txt"
        test_content = "Status: Active(2023)"
        actual_file.write_text(test_content, encoding="utf-8")

        # Update timestamp
        await get_global_timestamp_manager().update_timestamp(actual_file)

        # Edit with Chinese punctuation
        params = EditFileParams(
            file_path="data.txt",
            old_string="Active（2023）",
            new_string="Inactive(2024)",
            expected_replacements=1
        )

        result = await edit_file_tool.execute(mock_tool_context, params)

        # Verify success
        assert result.ok

        # Check warning is at the end
        lines = result.content.split('\n')
        warning_line_idx = None
        for idx, line in enumerate(lines):
            if "Auto-Correction Applied: Punctuation Mismatch Fixed" in line:
                warning_line_idx = idx
                break

        assert warning_line_idx is not None, "Auto-fix warning not found in output"
        # Warning should be near the end
        total_lines = len(lines)
        assert warning_line_idx > total_lines * 0.5, f"Warning should appear near the end, but found at line {warning_line_idx} out of {total_lines}"


class TestEditFileActionAndRemark:
    """Test cases for get_after_tool_call_friendly_action_and_remark method

    Tests the complete flow: execute -> get_after_tool_call_friendly_action_and_remark
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
        # Mock agent_context for file event dispatching
        mock_agent_context = Mock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.get_extension_typed = Mock(return_value=mock_agent_context)
        return context

    @pytest.fixture
    def edit_file_tool(self, temp_workspace):
        """Create EditFile tool instance with temp workspace"""
        tool = EditFile()
        tool.base_dir = temp_workspace
        return tool

    # ========== Success Cases ==========

    @pytest.mark.asyncio
    async def test_success_normal_file_remark_is_filename(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case - remark should be just the filename"""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Hello World", encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Execute the edit operation
        params = EditFileParams(
            file_path="test.txt",
            old_string="World",
            new_string="Python",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        # Get action and remark based on the real execution result
        arguments = {"file_path": "test.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        assert action_remark["remark"] == "test.txt"

    @pytest.mark.asyncio
    async def test_success_with_subdirectory_remark_is_basename(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case with subdirectory - remark should be basename only"""
        subdir = temp_workspace / "src"
        subdir.mkdir()
        test_file = subdir / "main.py"
        test_file.write_text("def main():\n    pass", encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Execute the edit operation
        params = EditFileParams(
            file_path="src/main.py",
            old_string="pass",
            new_string="print('Hello')",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        arguments = {"file_path": "src/main.py"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        assert result.ok
        assert action_remark["remark"] == "main.py"

    @pytest.mark.asyncio
    async def test_success_without_file_path_in_arguments(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Success case with empty arguments - should use default message"""
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Test content", encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Execute the edit operation
        params = EditFileParams(
            file_path="test.txt",
            old_string="content",
            new_string="data",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        # Empty arguments dict (no file_path)
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, {}
        )

        assert result.ok
        assert "action" in action_remark
        assert "remark" in action_remark
        # Without file_path in arguments, should use default
        assert len(action_remark["remark"]) > 0

    # ========== Error Cases ==========

    @pytest.mark.asyncio
    async def test_error_file_not_exist(self, edit_file_tool, mock_tool_context):
        """Test: File not exist error - remark should show appropriate message"""
        # Try to edit a non-existent file
        params = EditFileParams(
            file_path="missing.txt",
            old_string="old",
            new_string="new",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        arguments = {"file_path": "missing.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert result.use_custom_remark
        assert "action" in action_remark
        assert "remark" in action_remark
        # The metadata should have been set during execute
        assert mock_tool_context._metadata.get("error_type") == "edit_file.error_file_not_exist"
        # Remark should be the translated error message
        assert "找不到这个文件" in action_remark["remark"]
        # Should have AI retry suffix
        assert "AI 将尝试解决" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_error_match_failed(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Match failed error - remark should show appropriate message"""
        # Create a test file
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Hello World", encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Try to edit with non-existent old_string
        params = EditFileParams(
            file_path="test.txt",
            old_string="NonExistent",
            new_string="new",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        arguments = {"file_path": "test.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert result.use_custom_remark
        assert mock_tool_context._metadata.get("error_type") == "edit_file.error_match_failed"
        assert "没有找到要修改的内容" in action_remark["remark"]
        assert "AI 将尝试解决" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_error_replacements_mismatch(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Replacements mismatch error - remark should show appropriate message"""
        # Create a test file with multiple occurrences
        test_file = temp_workspace / "test.txt"
        test_file.write_text("test test test", encoding="utf-8")

        # Update timestamp to allow editing
        await get_global_timestamp_manager().update_timestamp(test_file)

        # Expect 1 replacement but there are 3 occurrences
        params = EditFileParams(
            file_path="test.txt",
            old_string="test",
            new_string="demo",
            expected_replacements=1
        )
        result = await edit_file_tool.execute(mock_tool_context, params)

        arguments = {"file_path": "test.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert result.use_custom_remark
        assert mock_tool_context._metadata.get("error_type") == "edit_file.error_replacements_mismatch"
        assert "找到的内容数量不符合预期" in action_remark["remark"]
        assert "AI 将尝试解决" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_error_unexpected_no_retry_suffix(self, edit_file_tool, mock_tool_context, temp_workspace):
        """Test: Unexpected error should NOT have retry suffix"""
        # Create a test file
        test_file = temp_workspace / "test.txt"
        test_file.write_text("Hello World", encoding="utf-8")

        # Manually set unexpected error type
        mock_tool_context._metadata["error_type"] = "edit_file.error_unexpected"

        # Create a failed result
        result = ToolResult.error("Unexpected error occurred")
        result.use_custom_remark = True

        arguments = {"file_path": "test.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        # Verify the error result and remark
        assert not result.ok
        assert "编辑遇到问题" in action_remark["remark"]
        # Should NOT have AI retry suffix for EDIT_ERROR_UNEXPECTED
        assert "AI 将尝试解决" not in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_error_without_file_path_uses_default(self, edit_file_tool, mock_tool_context):
        """Test: When no file_path in arguments, should use default error message"""
        # Manually set error type
        mock_tool_context._metadata["error_type"] = None

        # Create a failed result
        result = ToolResult.error("Some error")
        result.use_custom_remark = True

        # Empty arguments dict (no file_path)
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, {}
        )

        assert not result.ok
        # Should use default error message without file name
        assert action_remark["remark"] == "编辑文件时出错"

    @pytest.mark.asyncio
    async def test_error_with_file_path_in_fallback(self, edit_file_tool, mock_tool_context):
        """Test: When error_type is None but file_path exists, should use file_path in error message"""
        # No error type set
        mock_tool_context._metadata["error_type"] = None

        # Create a failed result
        result = ToolResult.error("Some error")
        result.use_custom_remark = True

        arguments = {"file_path": "error.txt"}
        action_remark = await edit_file_tool.get_after_tool_call_friendly_action_and_remark(
            "edit_file", mock_tool_context, result, 0.1, arguments
        )

        assert not result.ok
        # Should use FILE_EDIT_ERROR with file_path
        assert "编辑文件 error.txt 时出错" in action_remark["remark"]
