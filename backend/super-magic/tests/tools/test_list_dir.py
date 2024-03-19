#!/usr/bin/env python3
"""
ListDir工具单元测试

测试 app.tools.list_dir 模块中的 ListDir 工具类的各种功能：
- 基本目录列表
- 不同层级深度
- 二进制文件过滤
- 错误处理
- HTML生成
- 边界条件测试
"""

import os
import sys
import pytest
import tempfile
import shutil
import asyncio
from pathlib import Path
from typing import Dict, Any
from unittest.mock import Mock, patch, MagicMock

# 添加项目根目录到Python路径
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# 设置项目根目录
from app.paths import PathManager
PathManager.set_project_root(project_root)

# 导入测试目标
from app.tools.list_dir import ListDir, ListDirParams
from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, ToolDetail, FileTreeContent, FileTreeNode, FileTreeNodeType


class TestListDir:
    """ListDir工具测试类"""

    @pytest.fixture
    def temp_workspace(self):
        """创建临时工作区用于测试"""
        temp_dir = tempfile.mkdtemp()
        workspace = Path(temp_dir)

        # 创建测试文件结构
        (workspace / "root_file.txt").write_text("Root file content")
        (workspace / "root_file.py").write_text("print('Hello Python')")
        (workspace / "binary_file.jpg").write_bytes(b'\xFF\xD8\xFF\xE0')  # JPEG header

        # 创建目录结构
        level1_dir = workspace / "level1"
        level1_dir.mkdir()
        (level1_dir / "level1_file.txt").write_text("Level 1 file")
        (level1_dir / "level1_script.py").write_text("# Level 1 Python script")
        (level1_dir / "level1_image.png").write_bytes(b'\x89PNG\r\n\x1a\n')  # PNG header

        level2_dir = level1_dir / "level2"
        level2_dir.mkdir()
        (level2_dir / "level2_file.txt").write_text("Level 2 file")
        (level2_dir / "level2_config.json").write_text('{"key": "value"}')

        level3_dir = level2_dir / "level3"
        level3_dir.mkdir()
        (level3_dir / "deep_file.txt").write_text("Deep file content")

        # 创建空目录
        empty_dir = workspace / "empty_dir"
        empty_dir.mkdir()

        # 创建隐藏文件和目录（应该被过滤）
        (workspace / ".hidden_file").write_text("Hidden content")
        hidden_dir = workspace / ".hidden_dir"
        hidden_dir.mkdir()
        (hidden_dir / "hidden_content.txt").write_text("Hidden directory content")

        yield workspace

        # 清理
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def mock_tool_context(self):
        """创建模拟的ToolContext"""
        context = Mock(spec=ToolContext)
        return context

    @pytest.fixture
    def list_dir_tool(self, temp_workspace):
        """创建ListDir工具实例"""
        tool = ListDir()
        # 设置base_dir为临时工作区
        tool.base_dir = temp_workspace
        return tool

    def test_list_dir_params_validation(self):
        """测试ListDirParams参数验证"""
        # 测试默认参数
        params = ListDirParams()
        assert params.relative_workspace_path == "."
        assert params.level == 3
        assert params.filter_binary is False

        # 测试自定义参数
        params = ListDirParams(
            relative_workspace_path="test/path",
            level=5,
            filter_binary=True
        )
        assert params.relative_workspace_path == "test/path"
        assert params.level == 5
        assert params.filter_binary is True

    @pytest.mark.asyncio
    async def test_execute_basic_listing(self, list_dir_tool, mock_tool_context, temp_workspace):
        """测试基本目录列表功能"""
        params = ListDirParams(relative_workspace_path=".", level=1, filter_binary=False)

        result = await list_dir_tool.execute(mock_tool_context, params)

        assert isinstance(result, ToolResult)
        assert result.ok
        assert "[DIR] ./" in result.content
        assert "root_file.txt" in result.content
        assert "root_file.py" in result.content
        assert "binary_file.jpg" in result.content
        assert "level1/" in result.content
        # 隐藏文件应该被过滤
        assert ".hidden_file" not in result.content
        assert ".hidden_dir" not in result.content

    @pytest.mark.asyncio
    async def test_execute_with_level_limit(self, list_dir_tool, mock_tool_context):
        """测试层级深度限制"""
        # 测试level=1，只显示根目录内容
        params = ListDirParams(relative_workspace_path=".", level=1, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok
        assert "level1/" in result.content
        assert "level1_file.txt" not in result.content  # 不应该显示子目录内容

        # 测试level=2，显示两层
        params = ListDirParams(relative_workspace_path=".", level=2, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok
        assert "level1/" in result.content
        assert "level1_file.txt" in result.content  # 应该显示子目录内容
        assert "level2/" in result.content
        assert "level2_file.txt" not in result.content  # 不应该显示第三层内容

    @pytest.mark.asyncio
    async def test_execute_with_binary_filter(self, list_dir_tool, mock_tool_context):
        """测试二进制文件过滤"""
        params = ListDirParams(relative_workspace_path=".", level=2, filter_binary=True)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok
        # 文本文件应该显示
        assert "root_file.txt" in result.content
        assert "root_file.py" in result.content
        assert "level1_file.txt" in result.content
        assert "level1_script.py" in result.content

        # 二进制文件应该被过滤
        assert "binary_file.jpg" not in result.content
        assert "level1_image.png" not in result.content

        # 测试非过滤模式，确保二进制文件会显示
        params_no_filter = ListDirParams(relative_workspace_path=".", level=2, filter_binary=False)
        result_no_filter = await list_dir_tool.execute(mock_tool_context, params_no_filter)

        # 非过滤模式下二进制文件应该显示
        assert "binary_file.jpg" in result_no_filter.content or "level1_image.png" in result_no_filter.content

    @pytest.mark.asyncio
    async def test_execute_level_boundary_conditions(self, list_dir_tool, mock_tool_context):
        """测试层级边界条件"""
        # 测试level=0，应该被调整为1
        params = ListDirParams(relative_workspace_path=".", level=0, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)
        assert result.ok

        # 测试level超过最大值，应该被限制
        params = ListDirParams(relative_workspace_path=".", level=15, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)
        assert result.ok

    @pytest.mark.asyncio
    async def test_execute_nonexistent_path(self, list_dir_tool, mock_tool_context):
        """测试不存在的路径"""
        params = ListDirParams(relative_workspace_path="nonexistent/path", level=1, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok  # ToolResult应该是ok，但内容包含错误信息
        assert "错误：路径不存在" in result.content

    @pytest.mark.asyncio
    async def test_execute_file_as_directory(self, list_dir_tool, mock_tool_context):
        """测试将文件当作目录来列出"""
        params = ListDirParams(relative_workspace_path="root_file.txt", level=1, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok
        assert "错误：路径不是目录" in result.content

    @pytest.mark.asyncio
    async def test_execute_empty_directory(self, list_dir_tool, mock_tool_context):
        """测试空目录"""
        params = ListDirParams(relative_workspace_path="empty_dir", level=1, filter_binary=False)
        result = await list_dir_tool.execute(mock_tool_context, params)

        assert result.ok
        assert "No files found" in result.content

    def test_is_text_file(self, list_dir_tool, temp_workspace):
        """测试文本文件判断"""
        # 文本文件
        txt_file = temp_workspace / "test.txt"
        py_file = temp_workspace / "test.py"
        json_file = temp_workspace / "test.json"

        assert list_dir_tool._is_text_file(txt_file)
        assert list_dir_tool._is_text_file(py_file)
        assert list_dir_tool._is_text_file(json_file)

        # 二进制文件
        jpg_file = temp_workspace / "test.jpg"
        exe_file = temp_workspace / "test.exe"

        assert not list_dir_tool._is_text_file(jpg_file)
        assert not list_dir_tool._is_text_file(exe_file)

    def test_format_size(self, list_dir_tool):
        """测试文件大小格式化"""
        assert list_dir_tool._format_size(0) == "0B"
        assert list_dir_tool._format_size(1024) == "1KB"
        assert list_dir_tool._format_size(1024 * 1024) == "1.0MB"
        assert list_dir_tool._format_size(1024 * 1024 * 1024) == "1.0GB"

    def test_build_file_tree_recursive(self, list_dir_tool, temp_workspace):
        """测试递归文件树构建（替代原来的_list_directory_recursive_tree测试）"""
        stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}

        # 测试递归构建
        tree = list_dir_tool._build_file_tree(
            temp_workspace, ".", 1, 2, False, stats
        )

        assert len(tree) > 0
        assert stats["total_files"] > 0
        assert stats["total_dirs"] > 0

        # 检查是否有目录和文件节点
        has_dir = any(node.is_directory for node in tree)
        has_file = any(not node.is_directory for node in tree if not node.error)
        assert has_dir
        assert has_file

    def test_build_file_tree_with_filter(self, list_dir_tool, temp_workspace):
        """测试带过滤的文件树构建（替代原来的带过滤测试）"""
        stats_no_filter = {"total_files": 0, "total_dirs": 0, "total_size": 0}
        stats_with_filter = {"total_files": 0, "total_dirs": 0, "total_size": 0}

        # 不过滤
        tree_no_filter = list_dir_tool._build_file_tree(
            temp_workspace, ".", 1, 2, False, stats_no_filter
        )

        # 过滤二进制文件
        tree_with_filter = list_dir_tool._build_file_tree(
            temp_workspace, ".", 1, 2, True, stats_with_filter
        )

        # 过滤后的文件数应该更少（因为过滤掉了二进制文件）
        assert stats_with_filter["total_files"] <= stats_no_filter["total_files"]
        assert len(tree_with_filter) <= len(tree_no_filter)

    @pytest.mark.asyncio
    async def test_get_tool_detail(self, list_dir_tool, mock_tool_context):
        """测试工具详情生成"""
        # 先执行获取结果
        params = ListDirParams(relative_workspace_path=".", level=2, filter_binary=True)
        result = await list_dir_tool.execute(mock_tool_context, params)

        # 获取工具详情
        arguments = {
            "relative_workspace_path": ".",
            "level": 2,
            "filter_binary": True
        }

        tool_detail = await list_dir_tool.get_tool_detail(mock_tool_context, result, arguments)

        assert isinstance(tool_detail, ToolDetail)
        assert tool_detail.type == DisplayType.FILE_TREE
        assert isinstance(tool_detail.data, FileTreeContent)
        assert tool_detail.data.root_path == "."
        assert tool_detail.data.level == 2
        assert tool_detail.data.filter_binary is True
        assert isinstance(tool_detail.data.total_files, int)
        assert isinstance(tool_detail.data.total_dirs, int)
        assert isinstance(tool_detail.data.total_size, int)
        assert isinstance(tool_detail.data.tree, list)

    @pytest.mark.asyncio
    async def test_get_tool_detail_failed_result(self, list_dir_tool, mock_tool_context):
        """测试失败结果的工具详情"""
        # 创建失败的结果
        failed_result = ToolResult(content="Error message", ok=False)

        tool_detail = await list_dir_tool.get_tool_detail(mock_tool_context, failed_result)

        assert tool_detail is None

    def test_scan_directory_tree(self, list_dir_tool):
        """测试目录树扫描功能"""
        file_tree_content = list_dir_tool._scan_directory_tree(".", 2, True)

        assert isinstance(file_tree_content, FileTreeContent)
        assert hasattr(file_tree_content, 'total_files')
        assert hasattr(file_tree_content, 'total_dirs')
        assert hasattr(file_tree_content, 'total_size')
        assert hasattr(file_tree_content, 'tree')

        assert isinstance(file_tree_content.total_files, int)
        assert isinstance(file_tree_content.total_dirs, int)
        assert isinstance(file_tree_content.total_size, int)
        assert isinstance(file_tree_content.tree, list)

    def test_build_file_tree(self, list_dir_tool, temp_workspace):
        """测试文件树构建功能"""
        stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}

        tree = list_dir_tool._build_file_tree(
            temp_workspace, ".", 1, 2, False, stats
        )

        assert isinstance(tree, list)
        assert len(tree) > 0
        assert stats["total_files"] > 0
        assert stats["total_dirs"] > 0
        assert stats["total_size"] >= 0

        # 检查节点结构
        for node in tree:
            assert isinstance(node, FileTreeNode)
            assert hasattr(node, 'file_name')
            assert hasattr(node, 'relative_file_path')
            assert hasattr(node, 'is_directory')
            assert hasattr(node, 'file_size')
            assert hasattr(node, 'updated_at')
            assert hasattr(node, 'children')
            assert hasattr(node, 'type')

            if node.is_directory:
                assert node.file_size is None
                if node.children:
                    assert isinstance(node.children, list)
            else:
                assert isinstance(node.file_size, int)
                assert node.children is None

    @pytest.mark.asyncio
    async def test_get_after_tool_call_friendly_action_and_remark(self, list_dir_tool, mock_tool_context):
        """测试工具调用后的友好动作和备注"""
        # 测试成功结果
        success_result = ToolResult(content="Directory listing", ok=True)
        arguments = {"relative_workspace_path": "test/path"}

        action_remark = await list_dir_tool.get_after_tool_call_friendly_action_and_remark(
            "list_dir", mock_tool_context, success_result, 0.1, arguments
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        assert action_remark["remark"] == "test/path"

        # 测试失败结果
        failed_result = ToolResult(content="Error occurred", ok=False)

        action_remark = await list_dir_tool.get_after_tool_call_friendly_action_and_remark(
            "list_dir", mock_tool_context, failed_result, 0.1
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        assert "Error occurred" in action_remark["remark"]

    @pytest.mark.asyncio
    async def test_permission_error_handling(self, list_dir_tool, mock_tool_context, temp_workspace):
        """测试权限错误处理"""
        # 创建一个受限目录（在某些系统上可能无法真正限制权限）
        restricted_dir = temp_workspace / "restricted"
        restricted_dir.mkdir()

        # 模拟权限错误，测试新的架构
        with patch.object(Path, 'iterdir', side_effect=PermissionError("Permission denied")):
            # 测试_build_file_tree的错误处理
            stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}
            tree = list_dir_tool._build_file_tree(
                restricted_dir, ".", 1, 1, False, stats
            )

            # 应该返回包含错误信息的节点
            assert len(tree) == 1
            error_node = tree[0]
            assert error_node.error == "Permission denied"

            # 测试字符串转换也能正确显示错误
            file_tree_content = list_dir_tool._scan_directory_tree(".", 1, False)
            if file_tree_content.tree:
                string_result = list_dir_tool._convert_file_tree_to_string(file_tree_content)
                # 注意：在模拟环境下可能不会触发，所以这里只是确保方法能正常运行
                assert isinstance(string_result, str)

    @pytest.mark.asyncio
    async def test_get_file_tree_string(self, list_dir_tool):
        """测试get_file_tree_string公共接口方法"""
                # 测试正常路径
        string_result = list_dir_tool.get_file_tree_string(".", 1, False)
        assert isinstance(string_result, str)
        assert "[DIR]" in string_result

        # 测试不存在的路径
        string_result = list_dir_tool.get_file_tree_string("nonexistent", 1, False)
        assert "错误：路径不存在" in string_result

    @pytest.mark.asyncio
    async def test_get_file_tree_string_comprehensive(self, list_dir_tool, temp_workspace):
        """全面测试get_file_tree_string方法的各种参数组合"""
        # 测试不同的level参数
        result_level_1 = list_dir_tool.get_file_tree_string(".", 1, False)
        result_level_2 = list_dir_tool.get_file_tree_string(".", 2, False)
        assert isinstance(result_level_1, str)
        assert isinstance(result_level_2, str)
        assert "[DIR]" in result_level_1
        assert "[DIR]" in result_level_2

        # 测试filter_binary参数
        result_no_filter = list_dir_tool.get_file_tree_string(".", 1, False)
        result_with_filter = list_dir_tool.get_file_tree_string(".", 1, True)
        assert isinstance(result_no_filter, str)
        assert isinstance(result_with_filter, str)

    @pytest.mark.asyncio
    async def test_deep_nesting_performance(self, list_dir_tool, mock_tool_context):
        """测试深层嵌套的性能"""
        import time

        params = ListDirParams(relative_workspace_path=".", level=5, filter_binary=False)

        start_time = time.time()
        result = await list_dir_tool.execute(mock_tool_context, params)
        end_time = time.time()

        assert result.ok
        execution_time = end_time - start_time
        # 执行时间应该在合理范围内（比如1秒内）
        assert execution_time < 1.0, f"Execution took too long: {execution_time:.3f}s"



    def test_build_file_tree_error_handling(self, list_dir_tool, temp_workspace):
        """测试_build_file_tree方法的错误处理功能"""
        # 测试权限错误
        with patch.object(Path, 'iterdir', side_effect=PermissionError("Permission denied")):
            stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}
            tree = list_dir_tool._build_file_tree(
                temp_workspace, ".", 1, 2, False, stats
            )

            # 应该返回一个包含错误信息的节点
            assert isinstance(tree, list)
            assert len(tree) == 1
            error_node = tree[0]
            assert isinstance(error_node, FileTreeNode)
            assert error_node.error == "Permission denied"
            assert error_node.file_name == "Permission denied"
            assert not error_node.is_directory

        # 测试一般访问错误
        with patch.object(Path, 'iterdir', side_effect=OSError("Cannot access directory")):
            stats = {"total_files": 0, "total_dirs": 0, "total_size": 0}
            tree = list_dir_tool._build_file_tree(
                temp_workspace, ".", 1, 2, False, stats
            )

            # 应该返回一个包含错误信息的节点
            assert isinstance(tree, list)
            assert len(tree) == 1
            error_node = tree[0]
            assert isinstance(error_node, FileTreeNode)
            assert error_node.error == "Cannot access: Cannot access directory"
            assert error_node.file_name == "Cannot access: Cannot access directory"
            assert not error_node.is_directory

    def test_convert_file_tree_to_string_with_errors(self, list_dir_tool):
        """测试包含错误节点的文件树字符串转换"""
        # 创建包含错误节点的FileTreeContent
        error_node = FileTreeNode(
            file_name="Permission denied",
            relative_file_path="./[ERROR]",
            is_directory=False,
            file_size=None,
            updated_at="",
            children=None,
            type=FileTreeNodeType.FILE,
            error="Permission denied"
        )

        file_tree_content = FileTreeContent(
            root_path=".",
            level=1,
            filter_binary=False,
            total_files=0,
            total_dirs=0,
            total_size=0,
            tree=[error_node]
        )

        result_string = list_dir_tool._convert_file_tree_to_string(file_tree_content)

        # 检查错误信息是否正确显示
        assert "[DIR] ./" in result_string
        assert "[ERROR] Permission denied" in result_string

    @pytest.mark.asyncio
    async def test_list_current_workspace_files(self, mock_tool_context):
        """测试列举当前项目 .workspace 目录下的文件（10层深度）"""
        from pathlib import Path

        # 创建使用真实工作空间的 ListDir 工具
        real_workspace_tool = ListDir()
        # 使用项目根目录下的 .workspace 作为 base_dir
        project_root = Path(__file__).resolve().parent.parent.parent
        workspace_dir = project_root / ".workspace"
        real_workspace_tool.base_dir = workspace_dir

        if not workspace_dir.exists():
            pytest.skip(f"工作空间目录不存在: {workspace_dir}")

        # 简单测试：列举10层目录，不报错就算成功
        params = ListDirParams(relative_workspace_path=".", level=10, filter_binary=False)
        result = await real_workspace_tool.execute(mock_tool_context, params)

        # 只要没报错就算测试通过
        assert result.ok
        print(f"\n📁 扫描结果:")
        print(result.content)


if __name__ == "__main__":
    # 运行特定测试
    pytest.main([__file__, "-v", "-s"])
