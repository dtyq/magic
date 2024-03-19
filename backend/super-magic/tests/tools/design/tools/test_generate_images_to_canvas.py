"""测试 GenerateImagesToCanvas 工具"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.design.tools.generate_images_to_canvas import (
    GenerateImagesToCanvas,
    GenerateImagesToCanvasParams,
)


@pytest.fixture
def tool(tmp_path):
    """创建 GenerateImagesToCanvas 工具实例"""
    tool_instance = GenerateImagesToCanvas()
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
def mock_generate_image_result():
    """Mock generate_image 的返回结果"""
    def _create_result(image_count=1, base_path="/tmp/test-project/images"):
        # 生成假的图片路径
        image_paths = [
            f"{base_path}/test_image_{i}.png"
            for i in range(image_count)
        ]

        return ToolResult(
            success=True,
            message=f"Successfully generated {image_count} image(s)",
            content=f"Generated {image_count} images",
            extra_info={
                "saved_images": image_paths,
                "file_names": [f"test_image_{i}.png" for i in range(image_count)],
                "relative_paths": [f"images/test_image_{i}.png" for i in range(image_count)],
                "prompt": "test prompt",
                "mode": "generate",
                "image_count": image_count,
                "size": "2048x2048",
            }
        )

    return _create_result


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


class TestGenerateImagesToCanvas:
    """测试 GenerateImagesToCanvas 工具类"""

    @pytest.mark.asyncio
    async def test_generate_single_image(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试生成单张图片"""
        project_path = setup_project

        # 创建假的图片文件
        image_path = project_path / "images" / "test_image_0.png"
        create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=1,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="1 element created",
                content="Created 1 element",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "猫咪图片", "type": "image", "x": 100.0, "y": 100.0}
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="一只可爱的猫咪",
                size="2048x2048",
                name="猫咪图片"
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
        assert element["name"] == "猫咪图片"
        assert element["type"] == "image"

        # 验证调用了 batch_create，单张图片使用默认布局（None）
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode is None  # 单张图片不指定布局模式
        assert len(batch_params.elements) == 1

    @pytest.mark.asyncio
    async def test_generate_batch_images(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试批量生成4张图片（2x2布局）"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(4):
            image_path = project_path / "images" / f"test_image_{i}.png"
            create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=4,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="4 elements created",
                content="Created 4 elements",
                extra_info={
                    "created_elements": [
                        {"id": f"elem_{i}", "name": f"智能手表_{i+1}", "type": "image", "x": 100.0 + (i % 2) * 120.0, "y": 100.0 + (i // 2) * 120.0}
                        for i in range(4)
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="智能手表产品图：正面、侧面、背面、佩戴效果",
                size="2048x2048",
                name="智能手表",
                image_count=4
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["total_count"] == 4
        assert result.extra_info["succeeded_count"] == 4
        assert len(result.extra_info["created_elements"]) == 4

        # 验证元素名称（应该有 _1, _2, _3, _4 后缀）
        elements = result.extra_info["created_elements"]
        assert elements[0]["name"] == "智能手表_1"
        assert elements[1]["name"] == "智能手表_2"
        assert elements[2]["name"] == "智能手表_3"
        assert elements[3]["name"] == "智能手表_4"

        # 验证调用了 batch_create 并使用了 grid 布局
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert batch_params.layout_mode == "grid"
        assert batch_params.grid_columns == 2
        assert len(batch_params.elements) == 4

    @pytest.mark.asyncio
    async def test_generate_with_reference_image(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试图生图模式（基于参考图生成）"""
        project_path = setup_project

        # 创建参考图片
        ref_image = project_path / "images" / "reference.png"
        create_test_image(ref_image)

        # 创建生成的图片
        gen_image = project_path / "images" / "test_image_0.png"
        create_test_image(gen_image)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            result_data = mock_generate_image_result(
                image_count=1,
                base_path=str(project_path / "images")
            )
            # 修改 mode 为 edit
            result_data.extra_info["mode"] = "edit"
            mock_gen.return_value = result_data

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="1 element created",
                content="Created 1 element",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "玫瑰金手表", "type": "image", "x": 100.0, "y": 100.0}
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="将手表颜色改成玫瑰金",
                size="2048x2048",
                name="玫瑰金手表",
                image_paths=["images/reference.png"]
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["succeeded_count"] == 1

        # 验证 GenerateImage 被调用时的参数
        call_args = mock_gen.call_args
        assert call_args is not None
        generate_params = call_args[0][1]  # 第二个参数是 GenerateImageParams
        assert generate_params.mode == "edit"
        assert generate_params.image_paths == ["images/reference.png"]

    @pytest.mark.asyncio
    async def test_generate_image_request_metadata(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试 generateImageRequest 元数据正确传递给 batch_create"""
        project_path = setup_project

        # 创建假的图片文件
        image_path = project_path / "images" / "test_image_0.png"
        create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=1,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="1 element created",
                content="Created 1 element",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "测试图片", "type": "image"}
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试提示词",
                size="2048x2048",
                name="测试图片"
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok

        # 验证传递给 batch_create 的元素规格包含 generateImageRequest
        mock_batch.assert_called_once()
        call_args = mock_batch.call_args
        batch_params = call_args[0][1]
        assert len(batch_params.elements) == 1

        element_spec = batch_params.elements[0]
        assert "generateImageRequest" in element_spec.properties

        gen_req = element_spec.properties["generateImageRequest"]
        assert gen_req["prompt"] == "测试提示词"
        assert gen_req["size"] == "2048x2048"
        assert gen_req["resolution"] == "2048x2048"
        assert gen_req["mode"] == "generate"
        assert "model_id" in gen_req
        assert "image_id" in gen_req

    @pytest.mark.asyncio
    async def test_image_count_validation(self, tool, tool_context):
        """测试图片数量验证"""
        # 测试 image_count = 0
        with pytest.raises(ValueError, match="至少需要1张图片"):
            GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试",
                image_count=0
            )

        # 测试 image_count = 5 (超过限制)
        with pytest.raises(ValueError, match="单次最多生成4张图片"):
            GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试",
                image_count=5
            )

    @pytest.mark.asyncio
    async def test_project_not_found(self, tool, tool_context, tmp_path):
        """测试项目不存在的错误处理"""
        params = GenerateImagesToCanvasParams(
            project_path="non-existent-project",
            prompt="测试",
            size="2048x2048",
            name="测试"
        )

        result = await tool.execute(tool_context, params)

        # 验证错误结果
        assert not result.ok
        assert "does not exist" in result.message

    @pytest.mark.asyncio
    async def test_generation_failure(
        self, tool, tool_context, setup_project
    ):
        """测试图片生成失败的错误处理"""
        # Mock GenerateImage.execute 返回失败
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_execute:
            mock_execute.return_value = ToolResult(
                success=False,
                message="Image generation failed",
                content="Failed to generate images"
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试"
            )

            result = await tool.execute(tool_context, params)

        # 验证错误结果
        assert not result.ok
        assert "generation failed" in result.message.lower() or "failed" in result.content.lower()

    @pytest.mark.asyncio
    async def test_partial_success(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试部分元素创建失败的容错处理"""
        project_path = setup_project

        # 创建3张图片
        for i in range(3):
            image_path = project_path / "images" / f"test_image_{i}.png"
            create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=3,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回部分成功（2个成功，1个失败）
            mock_batch.return_value = ToolResult(
                success=True,
                message="2/3 elements created",
                content="Partial success",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "测试_1", "type": "image"},
                        {"id": "elem_2", "name": "测试_2", "type": "image"}
                    ],
                    "failed_elements": [
                        {"name": "测试_3", "error": "File not found"}
                    ]
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试",
                image_count=3
            )

            result = await tool.execute(tool_context, params)

        # 验证部分成功
        assert result.ok  # 部分成功仍返回 ok=True
        # 应该成功创建了2个元素，1个失败
        assert result.extra_info["succeeded_count"] == 2
        assert result.extra_info["failed_count"] == 1

    @pytest.mark.asyncio
    async def test_layout_two_images(
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试2张图片的横向布局"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(2):
            image_path = project_path / "images" / f"test_image_{i}.png"
            create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=2,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="2 elements created",
                content="Created 2 elements",
                extra_info={
                    "created_elements": [
                        {"id": "elem_1", "name": "对比_1", "type": "image", "x": 100.0, "y": 100.0},
                        {"id": "elem_2", "name": "对比_2", "type": "image", "x": 220.0, "y": 100.0}
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="对比图",
                size="2048x2048",
                name="对比",
                image_count=2
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
        self, tool, tool_context, setup_project, mock_generate_image_result, create_test_image
    ):
        """测试3张图片的横向布局"""
        project_path = setup_project

        # 创建假的图片文件
        for i in range(3):
            image_path = project_path / "images" / f"test_image_{i}.png"
            create_test_image(image_path)

        # Mock BatchCreateCanvasElements.execute 和 GenerateImage.execute
        with patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen, \
             patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch:

            mock_gen.return_value = mock_generate_image_result(
                image_count=3,
                base_path=str(project_path / "images")
            )

            # Mock batch_create 返回成功创建的元素
            mock_batch.return_value = ToolResult(
                success=True,
                message="3 elements created",
                content="Created 3 elements",
                extra_info={
                    "created_elements": [
                        {"id": f"elem_{i}", "name": f"三联_{i+1}", "type": "image", "x": 100.0 + i * 120.0, "y": 100.0}
                        for i in range(3)
                    ],
                    "failed_elements": []
                }
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="三联图",
                size="2048x2048",
                name="三联",
                image_count=3
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
