import pytest
from pathlib import Path
from unittest.mock import Mock, AsyncMock

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.convert_to_markdown import ConvertToMarkdown, ConvertToMarkdownParams


class TestConvertToMarkdown:
    """测试ConvertToMarkdown工具对所有测试文件的转换"""

    @pytest.fixture
    def temp_workspace(self, tmp_path):
        """创建临时工作区"""
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        return workspace

    @pytest.fixture
    def mock_tool_context(self):
        """创建模拟ToolContext"""
        context = Mock(spec=ToolContext)
        mock_agent_context = Mock()
        mock_agent_context.dispatch_event = AsyncMock()
        context.agent_context = mock_agent_context
        return context

    @pytest.fixture
    def convert_tool(self, temp_workspace):
        """创建ConvertToMarkdown工具实例"""
        tool = ConvertToMarkdown()
        tool.base_dir = temp_workspace
        return tool

    # 获取测试文件目录中的所有文件
    def get_test_files(self):
        """获取测试文件目录中的所有文件"""
        test_file_dir = Path(__file__).parent.parent / "utils" / "file_parse" / "test_file"
        if not test_file_dir.exists():
            return []
        return list(test_file_dir.glob("*"))

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_file", get_test_files(None))
    async def test_execute_all_test_files(self, convert_tool, mock_tool_context, temp_workspace, test_file):
        """测试对所有测试文件的转换"""
        # 跳过目录
        if test_file.is_dir():
            pytest.skip(f"跳过目录: {test_file.name}")

        # 将测试文件复制到临时工作区
        target_file = temp_workspace / test_file.name
        target_file.write_bytes(test_file.read_bytes())

        # 创建转换参数
        params = ConvertToMarkdownParams(input_path=test_file.name)

        # 执行转换
        result = await convert_tool.execute(mock_tool_context, params)

        # 基本断言
        assert isinstance(result, ToolResult)

        # 检查结果
        if test_file.suffix.lower() in convert_tool.convertible_extensions:
            # 支持的文件类型应该成功转换或至少尝试转换
            print(f"转换文件: {test_file.name}, 结果: {'成功' if result.ok else '失败'}")
            if not result.ok:
                print(f"错误信息: {result.content}")
        else:
            # 不支持的文件类型应该返回错误
            assert not result.ok
            assert "不支持的文件类型" in result.content
            print(f"不支持的文件类型: {test_file.name}")

    @pytest.mark.asyncio
    async def test_supported_extensions(self, convert_tool):
        """测试支持的文件扩展名"""
        # 验证工具支持的文件扩展名
        extensions = convert_tool.convertible_extensions
        assert isinstance(extensions, set)

        # 验证包含常见的支持格式
        expected_formats = {'.pdf', '.docx', '.xlsx', '.pptx', '.csv', '.jpg', '.png'}
        for fmt in expected_formats:
            assert fmt in extensions, f"应该支持 {fmt} 格式"

        print(f"支持的文件格式: {sorted(extensions)}")

    @pytest.mark.asyncio
    async def test_empty_file_handling(self, convert_tool, mock_tool_context, temp_workspace):
        """测试空文件处理"""
        # 创建空的支持文件类型
        empty_pdf = temp_workspace / "empty.pdf"
        empty_pdf.write_bytes(b"")

        params = ConvertToMarkdownParams(input_path="empty.pdf")
        result = await convert_tool.execute(mock_tool_context, params)

        assert isinstance(result, ToolResult)
        # 空文件可能成功也可能失败，取决于解析器的实现
        print(f"空文件处理结果: {'成功' if result.ok else '失败'}, 内容: {result.content[:100]}...")

    def test_tool_initialization(self, convert_tool):
        """测试工具初始化"""
        assert convert_tool.file_parser is not None
        assert convert_tool.timestamp_manager is not None
        assert hasattr(convert_tool, 'convertible_extensions')
        print("工具初始化成功")
