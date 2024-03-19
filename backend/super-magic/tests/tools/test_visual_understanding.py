"""
Test for VisualUnderstanding tool
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(override=True)

# 确保能够导入测试脚本
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 设置项目根目录
from app.paths import PathManager
PathManager.set_project_root(project_root)

# 设置日志
from agentlang.logger import get_logger, setup_logger, configure_logging_intercept
# 从环境变量获取日志级别，默认为INFO
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logger(log_name="app", console_level=log_level)
configure_logging_intercept()

import pytest
import asyncio

from agentlang.context.tool_context import ToolContext
from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams


class TestVisualUnderstanding:
    """Test cases for VisualUnderstanding tool"""

    @pytest.fixture
    def visual_understanding_tool(self):
        """Create VisualUnderstanding tool instance"""
        return VisualUnderstanding()

    @pytest.fixture
    def tool_context(self):
        """Create mock tool context"""
        # 这里可以根据实际的 ToolContext 需求来创建
        return ToolContext()

    @pytest.mark.asyncio
    async def test_execute_with_local_images(self, visual_understanding_tool, tool_context):
        """测试使用本地图片的视觉理解"""
        images = [
            "./VCG211361096134.jpg",  # 请替换为实际的本地图片路径
        ]

        if not images:
            pytest.skip("请在 images 列表中添加测试图片路径")

        params = VisualUnderstandingParams(
            images=images,
            query="请描述这些图片的内容"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果
        assert result is not None
        assert result.ok is True
        assert result.content is not None
        assert len(result.content.strip()) > 0

        # 验证额外信息
        if result.extra_info:
            assert "images" in result.extra_info
            assert "image_count" in result.extra_info
            assert result.extra_info["image_count"] == len(images)

    @pytest.mark.asyncio
    async def test_execute_with_url_images(self, visual_understanding_tool, tool_context):
        """测试使用网络图片的视觉理解"""
        images = [
            "https://vcg00.cfp.cn/creative/vcg/800/new/VCG211361096134.jpg",
        ]

        if not images:
            pytest.skip("请在 images 列表中添加测试图片URL")

        params = VisualUnderstandingParams(
            images=images,
            query="分析这些图片并描述其特征"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果
        assert result is not None
        assert result.ok is True
        assert result.content is not None
        assert len(result.content.strip()) > 0

    @pytest.mark.asyncio
    async def test_execute_with_mixed_images(self, visual_understanding_tool, tool_context):
        """测试混合使用本地和网络图片的视觉理解"""
        # TODO: 定义混合图片来源
        images = [
            "https://vcg00.cfp.cn/creative/vcg/800/new/VCG211361096134.jpg",
            "a.jpg",
            "https://vcg04.cfp.cn/creative/vcg/800/new/VCG41N970185824.jpg"
        ]

        if not images:
            pytest.skip("请在 images 列表中添加混合类型的测试图片")

        params = VisualUnderstandingParams(
            images=images,
            query="帮我看看这些图片有什么内容"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果
        assert result is not None
        assert result.ok is True
        assert result.content is not None
        assert len(result.content.strip()) > 0

        # 测试 get_tool_detail 并打印结果
        try:
            tool_detail = await visual_understanding_tool.get_tool_detail(
                tool_context,
                result,
                arguments={"images": images, "query": params.query}
            )
            print("\n=== get_tool_detail 结果 ===")
            if tool_detail:
                print(f"类型: {tool_detail.type}")
                print(f"文件名: {tool_detail.data.file_name}")
                print(f"完整内容长度: {len(tool_detail.data.content)}")
                print(f"完整内容:\n{tool_detail.data.content}")
            else:
                print("tool_detail 为 None")
            print("=== get_tool_detail 结果结束 ===\n")
        except Exception as e:
            print(f"\n调用 get_tool_detail 时发生错误: {e}\n")

    @pytest.mark.asyncio
    async def test_execute_with_single_image(self, visual_understanding_tool, tool_context):
        """测试单张图片的视觉理解"""
        # TODO: 定义单张测试图片
        images = [
            # "path/to/your/single/image.jpg",
        ]

        if not images:
            pytest.skip("请在 images 列表中添加单张测试图片路径")

        params = VisualUnderstandingParams(
            images=images,
            query="详细描述这张图片的内容，包括主要对象、颜色、场景等"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果
        assert result is not None
        assert result.ok is True
        assert result.content is not None
        assert len(result.content.strip()) > 0

        # 验证单图片特定信息
        if result.extra_info:
            assert result.extra_info["image_count"] == 1

    @pytest.mark.asyncio
    async def test_execute_with_text_extraction_query(self, visual_understanding_tool, tool_context):
        """测试文字识别功能"""
        # TODO: 定义包含文字的测试图片
        images = [
            # "path/to/your/text/image.jpg",
        ]

        if not images:
            pytest.skip("请在 images 列表中添加包含文字的测试图片路径")

        params = VisualUnderstandingParams(
            images=images,
            query="识别并提取图片中的所有文字内容"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果
        assert result is not None
        assert result.ok is True
        assert result.content is not None
        assert len(result.content.strip()) > 0

    @pytest.mark.asyncio
    async def test_execute_with_empty_images(self, visual_understanding_tool, tool_context):
        """测试空图片列表的处理"""
        params = VisualUnderstandingParams(
            images=[],
            query="描述图片内容"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果 - 应该能正常处理空列表
        assert result is not None
        # 根据实际实现，这里可能返回错误或特定响应

    @pytest.mark.asyncio
    async def test_execute_with_invalid_image_path(self, visual_understanding_tool, tool_context):
        """测试无效图片路径的处理"""
        params = VisualUnderstandingParams(
            images=["nonexistent/path/to/image.jpg"],
            query="描述图片内容"
        )

        result = await visual_understanding_tool.execute(tool_context, params)

        # 验证结果 - 应该直接报错而不是继续处理
        assert result is not None
        assert result.ok is False  # 期望返回失败
        assert result.content is not None  # 期望有错误信息
        assert "图片处理失败" in result.content  # 期望错误信息包含相关描述


if __name__ == "__main__":
    # 运行测试的便捷方式
    pytest.main([__file__, "-v"])
