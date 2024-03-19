"""测试 SearchImagesToCanvas 工具"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.design.tools.search_images_to_canvas import (
    SearchImagesToCanvas,
    SearchImagesToCanvasParams,
)
from app.tools.image_search import FilteredImage


@pytest.fixture
def tool(tmp_path):
    """创建 SearchImagesToCanvas 工具实例"""
    tool_instance = SearchImagesToCanvas()
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    """创建真实的工具上下文"""
    context = ToolContext(metadata={"workspace_dir": str(tmp_path)})

    # Mock agent_context
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()

    context.register_extension("agent_context", agent_context)

    return context


@pytest.fixture
def setup_project(tmp_path):
    """创建一个测试项目，包含 magic.project.js 和 images 目录"""
    project_path = tmp_path / "test-project"
    project_path.mkdir()

    # 创建 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": []
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    # 创建 images 目录
    images_dir = project_path / "images"
    images_dir.mkdir()

    return project_path


@pytest.fixture
def create_test_image():
    """创建测试图片文件"""
    def _create_image(path: Path):
        """创建一个假的 PNG 图片文件"""
        # PNG 文件的最小有效头部
        png_header = b'\x89PNG\r\n\x1a\n'
        # IHDR chunk (13 bytes data: width=100, height=100, bit depth=8, color type=2 (RGB))
        ihdr_data = b'\x00\x00\x00\x64\x00\x00\x00\x64\x08\x02\x00\x00\x00'
        ihdr_crc = b'\xff\x80\x02\x03'  # CRC (不需要真实计算)
        ihdr_chunk = b'\x00\x00\x00\x0d' + b'IHDR' + ihdr_data + ihdr_crc

        # IEND chunk
        iend_chunk = b'\x00\x00\x00\x00' + b'IEND' + b'\xae\x42\x60\x82'

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png_header + ihdr_chunk + iend_chunk)
        return path

    return _create_image


@pytest.fixture
def mock_image_search_result(tmp_path):
    """Mock image_search 的返回结果"""
    def _create_result(image_count=1, requirement_name="产品图"):
        # 创建假的 FilteredImage 对象
        filtered_images = []
        for i in range(image_count):
            local_path = tmp_path / "test-project" / "images" / f"search_image_{i}.jpg"
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.touch()  # 创建空文件

            img = FilteredImage(
                url=f"https://example.com/image_{i}.jpg",
                name=f"search_image_{i}.jpg",
                width=1920,
                height=1080,
                file_size=512000,
                encoding_format="jpeg",
                date_published=None,
                host_page_url=None,
                thumbnail_url=None,
                visual_analysis=None,  # 已关闭视觉理解
                local_path=str(local_path),
                is_fallback=False
            )
            filtered_images.append(img)

        # 构建 requirement_results 结构
        requirement_results = [
            {
                'requirement_data': {
                    'name': requirement_name,
                    'query': 'test query',
                    'expected_aspect_ratio': '16:9',
                    'count': image_count
                },
                'images': filtered_images,
                'original_count': image_count + 5  # 模拟过滤前的数量
            }
        ]

        return ToolResult(
            success=True,
            message=f"搜索成功，找到 {image_count} 张图片",
            content=f"## 图片搜索结果\n\n主题ID: test-topic\n总计: {image_count} 张图片",
            extra_info={
                "topic_id": "test-topic",
                "requirement_names": [requirement_name],
                "result_count": image_count,
                "original_count": image_count + 5,
                "requirement_count": 1,
                "deduplicated": 0,
                "requirement_results": requirement_results
            }
        )

    return _create_result


class TestSearchImagesToCanvas:
    """测试 SearchImagesToCanvas 工具类"""

    @pytest.mark.asyncio
    async def test_search_single_image(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试搜索单张图片"""
        project_path = setup_project

        # 创建假的图片文件
        image_path = project_path / "images" / "search_image_0.jpg"
        create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=1,
                requirement_name="产品图"
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="1 element created",
                content="Created 1 element",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "产品图", "type": "image", "x": 100.0, "y": 100.0}
                    ],
                    "failed_elements": []
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>产品图</name>
        <query>智能手表 产品 摄影</query>
        <visual_understanding_prompt>分析是否适合产品展示</visual_understanding_prompt>
        <requirement_explanation>需要清晰的智能手表产品图</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>1</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok

        # 验证 extra_info
        assert result.extra_info is not None
        assert result.extra_info["total_count"] == 1
        assert result.extra_info["succeeded_count"] == 1
        assert result.extra_info["failed_count"] == 0
        assert len(result.extra_info["created_elements"]) == 1

        # 验证创建的元素
        element = result.extra_info["created_elements"][0]
        assert element["name"] == "产品图"
        assert element["type"] == "image"

        # 验证 image_search 调用时关闭了视觉理解
        mock_search.assert_called_once()
        call_args = mock_search.call_args
        # 第二个参数应该是 enable_visual_understanding=False
        assert call_args[1]["enable_visual_understanding"] is False

        # 验证调用了 batch_create，单张图片使用默认布局（None）
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode is None  # 单张图片不指定布局模式
        assert len(batch_params.elements) == 1

    @pytest.mark.asyncio
    async def test_search_batch_images(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试批量搜索4张图片（2x2布局）"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(4):
            image_path = project_path / "images" / f"search_image_{i}.jpg"
            create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=4,
                requirement_name="案例展示"
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="4 elements created",
                content="Created 4 elements",
                extra_info={
                    "created_elements": [
                        {"id": f"elem_{i}", "name": f"案例展示_{i+1}", "type": "image", "x": 100.0 + (i % 2) * 120.0, "y": 100.0 + (i // 2) * 120.0}
                        for i in range(4)
                    ],
                    "failed_elements": []
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>案例展示</name>
        <query>智能手表 使用场景</query>
        <visual_understanding_prompt>分析是否展示真实使用场景</visual_understanding_prompt>
        <requirement_explanation>需要智能手表在不同场景下的使用照片</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>4</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["total_count"] == 4
        assert result.extra_info["succeeded_count"] == 4
        assert len(result.extra_info["created_elements"]) == 4

        # 验证元素名称（应该有 _1, _2, _3, _4 后缀）
        elements = result.extra_info["created_elements"]
        assert elements[0]["name"] == "案例展示_1"
        assert elements[1]["name"] == "案例展示_2"
        assert elements[2]["name"] == "案例展示_3"
        assert elements[3]["name"] == "案例展示_4"

        # 验证调用了 batch_create 并使用了 grid 布局
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode == "grid"
        assert batch_params.grid_columns == 2
        assert len(batch_params.elements) == 4

    @pytest.mark.asyncio
    async def test_search_with_name_prefix(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试使用自定义名称前缀"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(3):
            image_path = project_path / "images" / f"search_image_{i}.jpg"
            create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=3,
                requirement_name="原始需求名"
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="3 elements created",
                content="Created 3 elements",
                extra_info={
                    "created_elements": [
                        {"id": f"elem_{i}", "name": f"自定义名称_{i+1}", "type": "image"}
                        for i in range(3)
                    ],
                    "failed_elements": []
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>原始需求名</name>
        <query>测试查询</query>
        <visual_understanding_prompt>分析内容</visual_understanding_prompt>
        <requirement_explanation>测试说明</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>3</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip(),
                name_prefix="自定义名称"
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert len(result.extra_info["created_elements"]) == 3

        # 验证元素名称使用了自定义前缀
        elements = result.extra_info["created_elements"]
        assert elements[0]["name"] == "自定义名称_1"
        assert elements[1]["name"] == "自定义名称_2"
        assert elements[2]["name"] == "自定义名称_3"

    @pytest.mark.asyncio
    async def test_project_not_found(self, tool, tool_context, tmp_path):
        """测试项目不存在的错误处理"""
        requirements_xml = """
<requirements>
    <requirement>
        <name>测试</name>
        <query>测试</query>
        <visual_understanding_prompt>测试</visual_understanding_prompt>
        <requirement_explanation>测试</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>1</count>
    </requirement>
</requirements>
"""

        params = SearchImagesToCanvasParams(
            project_path="non-existent-project",
            topic_id="test-topic",
            requirements_xml=requirements_xml.strip()
        )

        result = await tool.execute(tool_context, params)

        # 验证错误结果
        assert not result.ok
        assert "does not exist" in result.message

    @pytest.mark.asyncio
    async def test_search_failure(
        self, tool, tool_context, setup_project
    ):
        """测试图片搜索失败的错误处理"""
        requirements_xml = """
<requirements>
    <requirement>
        <name>测试</name>
        <query>测试</query>
        <visual_understanding_prompt>测试</visual_understanding_prompt>
        <requirement_explanation>测试</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>1</count>
    </requirement>
</requirements>
"""

        # Mock ImageSearch.execute_purely 返回失败
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_execute:
            mock_execute.return_value = ToolResult(
                success=False,
                message="Image search failed",
                content="Failed to search images"
            )

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证错误结果
        assert not result.ok
        assert "search failed" in result.message.lower() or "failed" in result.content.lower()

    @pytest.mark.asyncio
    async def test_no_images_found(
        self, tool, tool_context, setup_project
    ):
        """测试搜索到0张图片的处理"""
        requirements_xml = """
<requirements>
    <requirement>
        <name>测试</name>
        <query>测试</query>
        <visual_understanding_prompt>测试</visual_understanding_prompt>
        <requirement_explanation>测试</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>1</count>
    </requirement>
</requirements>
"""

        # Mock ImageSearch.execute_purely 返回空结果
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_execute:
            mock_execute.return_value = ToolResult(
                success=True,
                message="搜索完成，但未找到图片",
                content="## 图片搜索结果\n\n未找到符合条件的图片",
                extra_info={
                    "topic_id": "test-topic",
                    "requirement_names": ["测试"],
                    "result_count": 0,
                    "requirement_results": []
                }
            )

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证错误结果
        assert not result.ok
        assert "No images found" in result.message or "No images found" in result.content

    @pytest.mark.asyncio
    async def test_partial_success(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试部分元素创建失败的容错处理"""
        project_path = setup_project

        # 创建3张图片
        for i in range(3):
            image_path = project_path / "images" / f"search_image_{i}.jpg"
            create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=3,
                requirement_name="测试图片"
            )

            # Mock batch_create 返回部分成功（2个成功，1个失败）
            mock_batch.return_value = ToolResult(
                success=True,
                message="2/3 elements created",
                content="Partial success",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "测试图片_1", "type": "image"},
                        {"id": "elem_2", "name": "测试图片_2", "type": "image"}
                    ],
                    "failed_elements": [
                        {"name": "测试图片_3", "error": "File not found"}
                    ]
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>测试图片</name>
        <query>测试</query>
        <visual_understanding_prompt>测试</visual_understanding_prompt>
        <requirement_explanation>测试</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>3</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证部分成功
        assert result.ok  # 部分成功仍返回 ok=True
        # 应该成功创建了2个元素，1个失败
        assert result.extra_info["succeeded_count"] == 2
        assert result.extra_info["failed_count"] == 1

    @pytest.mark.asyncio
    async def test_layout_two_images(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试2张图片的横向布局"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(2):
            image_path = project_path / "images" / f"search_image_{i}.jpg"
            create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=2,
                requirement_name="对比图"
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="2 elements created",
                content="Created 2 elements",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "对比图_1", "type": "image", "x": 100.0, "y": 100.0},
                        {"id": "elem_2", "name": "对比图_2", "type": "image", "x": 220.0, "y": 100.0}
                    ],
                    "failed_elements": []
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>对比图</name>
        <query>对比</query>
        <visual_understanding_prompt>对比分析</visual_understanding_prompt>
        <requirement_explanation>对比说明</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>2</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert len(result.extra_info["created_elements"]) == 2

        # 验证调用了 batch_create 并使用了 horizontal 布局
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode == "horizontal"
        assert len(batch_params.elements) == 2

    @pytest.mark.asyncio
    async def test_layout_three_images(
        self, tool, tool_context, setup_project, mock_image_search_result, create_test_image
    ):
        """测试3张图片的横向布局"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(3):
            image_path = project_path / "images" / f"search_image_{i}.jpg"
            create_test_image(image_path)

        # Mock ImageSearch.execute_purely 和 BatchCreateCanvasElements.execute
        with patch.object(tool._search_tool, 'execute_purely', new_callable=AsyncMock) as mock_search, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_search.return_value = mock_image_search_result(
                image_count=3,
                requirement_name="三联图"
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="3 elements created",
                content="Created 3 elements",
                extra_info={
                    "created_elements": [
                        {"id": f"elem_{i}", "name": f"三联图_{i+1}", "type": "image", "x": 100.0 + i * 120.0, "y": 100.0}
                        for i in range(3)
                    ],
                    "failed_elements": []
                }
            )

            requirements_xml = """
<requirements>
    <requirement>
        <name>三联图</name>
        <query>三联</query>
        <visual_understanding_prompt>三联分析</visual_understanding_prompt>
        <requirement_explanation>三联说明</requirement_explanation>
        <expected_aspect_ratio>1:1</expected_aspect_ratio>
        <count>3</count>
    </requirement>
</requirements>
"""

            params = SearchImagesToCanvasParams(
                project_path="test-project",
                topic_id="test-topic",
                requirements_xml=requirements_xml.strip()
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert len(result.extra_info["created_elements"]) == 3

        # 验证调用了 batch_create 并使用了 horizontal 布局
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode == "horizontal"
        assert len(batch_params.elements) == 3
