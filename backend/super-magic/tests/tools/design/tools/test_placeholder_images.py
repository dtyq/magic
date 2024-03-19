"""测试占位图功能（3阶段图片生成流程）"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.design.tools.generate_images_to_canvas import (
    GenerateImagesToCanvas,
    GenerateImagesToCanvasParams,
)
from app.tools.design.tools.batch_create_canvas_elements import (
    BatchCreateCanvasElements,
    BatchCreateCanvasElementsParams,
    ElementCreationSpec,
)
from app.tools.design.tools.batch_update_canvas_elements import (
    BatchUpdateCanvasElements,
    BatchUpdateCanvasElementsParams,
    ElementUpdate,
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
    """创建一个测试项目，包含 magic.project.js"""
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
    def _create_result(image_count=1, base_path="/tmp/test-project/images", success=True):
        if not success:
            return ToolResult(
                success=False,
                message="Image generation failed",
                content="Failed to generate images"
            )

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
                "relative_paths": [f"test-project/images/test_image_{i}.png" for i in range(image_count)],
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
        # IHDR chunk (13 bytes data: width=2048, height=2048, bit depth=8, color type=2 (RGB))
        ihdr_data = b'\x00\x00\x08\x00\x00\x00\x08\x00\x08\x02\x00\x00\x00'
        ihdr_crc = b'\xff\x80\x02\x03'  # CRC
        ihdr_chunk = b'\x00\x00\x00\x0d' + b'IHDR' + ihdr_data + ihdr_crc

        # IEND chunk
        iend_chunk = b'\x00\x00\x00\x00' + b'IEND' + b'\xae\x42\x60\x82'

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png_header + ihdr_chunk + iend_chunk)
        return path

    return _create_image


class TestPlaceholderImages:
    """测试占位图功能（3阶段流程）"""

    @pytest.mark.asyncio
    async def test_phase1_create_placeholder(
        self, tool, tool_context, setup_project
    ):
        """测试阶段1：创建带 status='processing' 的占位符"""
        project_path = setup_project

        # Mock batch_create 和 generate_image
        with patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, 'execute', new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen:

            # 阶段1：batch_create 创建占位符
            mock_batch_create.return_value = ToolResult(
                success=True,
                message="2 placeholders created",
                content="Created 2 placeholders",
                extra_info={
                    "created_elements": [
                        {
                            "id": "placeholder_1",
                            "name": "测试图片_1",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0,
                            "width": 2048.0,
                            "height": 2048.0,
                            "status": "processing"
                        },
                        {
                            "id": "placeholder_2",
                            "name": "测试图片_2",
                            "type": "image",
                            "x": 2348.0,
                            "y": 100.0,
                            "width": 2048.0,
                            "height": 2048.0,
                            "status": "processing"
                        }
                    ],
                    "failed_elements": []
                }
            )

            # 阶段2：generate_image 成功
            mock_gen.return_value = ToolResult(
                success=True,
                message="Generated 2 images",
                content="Success",
                extra_info={
                    "saved_images": [
                        str(project_path / "images" / "test_image_0.png"),
                        str(project_path / "images" / "test_image_1.png"),
                    ]
                }
            )

            # 阶段3：batch_update 更新占位符
            mock_batch_update.return_value = ToolResult(
                success=True,
                message="2 elements updated",
                content="Updated 2 elements"
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试图片",
                size="2048x2048",
                name="测试图片",
                image_count=2
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok

        # 验证阶段1：batch_create 被调用，创建带 status='processing' 的占位符
        mock_batch_create.assert_called_once()
        batch_create_call = mock_batch_create.call_args
        batch_create_params = batch_create_call[0][1]

        # 验证创建了2个元素
        assert len(batch_create_params.elements) == 2

        # 验证每个元素都有 status='processing'
        for element_spec in batch_create_params.elements:
            assert element_spec.properties.get('status') == 'processing'
            # 验证尺寸已预计算
            assert element_spec.width == 2048.0
            assert element_spec.height == 2048.0

    @pytest.mark.asyncio
    async def test_phase3_update_to_completed(
        self, tool, tool_context, setup_project, mock_generate_image_result
    ):
        """测试阶段3：成功生成后更新为 status='completed'"""
        project_path = setup_project

        with patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, 'execute', new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen:

            # 阶段1：创建占位符
            mock_batch_create.return_value = ToolResult(
                success=True,
                message="1 placeholder created",
                content="Created",
                extra_info={
                    "created_elements": [
                        {
                            "id": "placeholder_1",
                            "name": "测试图片",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0,
                            "status": "processing"
                        }
                    ],
                    "failed_elements": []
                }
            )

            # 阶段2：生成成功
            mock_gen.return_value = mock_generate_image_result(
                image_count=1,
                base_path=str(project_path / "images"),
                success=True
            )

            # 阶段3：更新成功
            mock_batch_update.return_value = ToolResult(
                success=True,
                message="1 element updated",
                content="Updated"
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试图片"
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["succeeded_count"] == 1
        assert result.extra_info["failed_count"] == 0

        # 验证阶段3：batch_update 被调用，更新为 completed
        mock_batch_update.assert_called_once()
        batch_update_call = mock_batch_update.call_args
        batch_update_params = batch_update_call[0][1]

        # 验证更新参数
        assert len(batch_update_params.updates) == 1
        update = batch_update_params.updates[0]

        # 验证 element_id 正确
        assert update.element_id == "placeholder_1"

        # 验证 properties 包含 status='completed' 和 src
        assert update.properties.get('status') == 'completed'
        assert 'src' in update.properties
        assert 'generateImageRequest' in update.properties

    @pytest.mark.asyncio
    async def test_phase3_update_to_failed(
        self, tool, tool_context, setup_project, mock_generate_image_result
    ):
        """测试阶段3：生成失败后更新为 status='failed'"""
        with patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, 'execute', new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen:

            # 阶段1：创建占位符
            mock_batch_create.return_value = ToolResult(
                success=True,
                message="2 placeholders created",
                content="Created",
                extra_info={
                    "created_elements": [
                        {
                            "id": f"placeholder_{i}",
                            "name": f"测试_{i+1}",
                            "type": "image",
                            "x": 100.0 + i * 2248.0,
                            "y": 100.0,
                            "status": "processing"
                        }
                        for i in range(2)
                    ],
                    "failed_elements": []
                }
            )

            # 阶段2：生成失败
            mock_gen.return_value = mock_generate_image_result(success=False)

            # 阶段3：更新为 failed
            mock_batch_update.return_value = ToolResult(
                success=True,
                message="2 elements updated to failed",
                content="Updated"
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试",
                image_count=2
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["succeeded_count"] == 0
        assert result.extra_info["failed_count"] == 2

        # 验证阶段3：batch_update 被调用，全部更新为 failed
        mock_batch_update.assert_called_once()
        batch_update_call = mock_batch_update.call_args
        batch_update_params = batch_update_call[0][1]

        assert len(batch_update_params.updates) == 2
        for update in batch_update_params.updates:
            assert update.properties.get('status') == 'failed'

    @pytest.mark.asyncio
    async def test_partial_generation_success(
        self, tool, tool_context, setup_project
    ):
        """测试部分图片生成成功的场景"""
        project_path = setup_project

        with patch.object(tool._batch_create_tool, 'execute', new_callable=AsyncMock) as mock_batch_create, \
             patch.object(tool._batch_update_tool, 'execute', new_callable=AsyncMock) as mock_batch_update, \
             patch.object(tool._generate_tool, 'execute', new_callable=AsyncMock) as mock_gen:

            # 阶段1：创建4个占位符
            mock_batch_create.return_value = ToolResult(
                success=True,
                message="4 placeholders created",
                content="Created",
                extra_info={
                    "created_elements": [
                        {
                            "id": f"placeholder_{i}",
                            "name": f"测试_{i+1}",
                            "type": "image",
                            "x": 100.0,
                            "y": 100.0 + i * 2248.0,
                            "status": "processing"
                        }
                        for i in range(4)
                    ],
                    "failed_elements": []
                }
            )

            # 阶段2：只成功生成2张图片
            mock_gen.return_value = ToolResult(
                success=True,
                message="Generated 2 images (partial success)",
                content="Partial success",
                extra_info={
                    "saved_images": [
                        str(project_path / "images" / "test_image_0.png"),
                        str(project_path / "images" / "test_image_1.png"),
                    ]
                }
            )

            # 阶段3：更新状态
            mock_batch_update.return_value = ToolResult(
                success=True,
                message="4 elements updated",
                content="Updated"
            )

            params = GenerateImagesToCanvasParams(
                project_path="test-project",
                prompt="测试",
                size="2048x2048",
                name="测试",
                image_count=4
            )

            result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert result.extra_info["succeeded_count"] == 2
        assert result.extra_info["failed_count"] == 2

        # 验证阶段3：前2个更新为 completed，后2个更新为 failed
        mock_batch_update.assert_called_once()
        batch_update_call = mock_batch_update.call_args
        batch_update_params = batch_update_call[0][1]

        assert len(batch_update_params.updates) == 4

        # 前2个应该是 completed
        assert batch_update_params.updates[0].properties.get('status') == 'completed'
        assert batch_update_params.updates[1].properties.get('status') == 'completed'
        assert 'src' in batch_update_params.updates[0].properties
        assert 'src' in batch_update_params.updates[1].properties

        # 后2个应该是 failed
        assert batch_update_params.updates[2].properties.get('status') == 'failed'
        assert batch_update_params.updates[3].properties.get('status') == 'failed'

    @pytest.mark.asyncio
    async def test_size_parsing(self, tool):
        """测试尺寸解析功能"""
        # 测试固定尺寸
        assert tool._parse_size_to_dimensions("2048x2048") == (2048, 2048)
        assert tool._parse_size_to_dimensions("1920x1080") == (1920, 1080)

        # 测试宽高比
        assert tool._parse_size_to_dimensions("1:1") == (2048, 2048)
        assert tool._parse_size_to_dimensions("16:9") == (2560, 1440)
        assert tool._parse_size_to_dimensions("4:3") == (2304, 1728)
        assert tool._parse_size_to_dimensions("3:4") == (1728, 2304)

        # 测试未知格式（应返回默认值）
        assert tool._parse_size_to_dimensions("invalid") == (2048, 2048)


class TestBatchCreateWithStatusField:
    """测试 batch_create 对 status 字段的支持"""

    @pytest.fixture
    def batch_create_tool(self, tmp_path):
        """创建 BatchCreateCanvasElements 工具实例"""
        tool_instance = BatchCreateCanvasElements()
        tool_instance.base_dir = tmp_path
        return tool_instance

    @pytest.mark.asyncio
    async def test_create_placeholder_without_src(
        self, batch_create_tool, tool_context, setup_project
    ):
        """测试创建带 status='processing' 但没有 src 的占位符"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="image",
                    name="占位图",
                    x=100,
                    y=100,
                    width=2048,
                    height=2048,
                    properties={
                        "status": "processing"
                        # 注意：没有 src
                    }
                )
            ]
        )

        result = await batch_create_tool.execute(tool_context, params)

        # 验证：应该成功创建
        assert result.ok
        assert result.extra_info["succeeded_count"] == 1

        # 验证创建的元素包含 status 字段
        created_elements = result.extra_info["created_elements"]
        assert len(created_elements) == 1
        assert created_elements[0]["type"] == "image"
        # status 应该被保存（在 magic.project.js 中）

    @pytest.mark.asyncio
    async def test_create_with_pending_status(
        self, batch_create_tool, tool_context, setup_project
    ):
        """测试创建带 status='pending' 的占位符"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="image",
                    name="待生成图片",
                    x=100,
                    y=100,
                    width=1024,
                    height=1024,
                    properties={
                        "status": "pending"
                    }
                )
            ]
        )

        result = await batch_create_tool.execute(tool_context, params)

        # 验证：pending 状态也应该允许没有 src
        assert result.ok
        assert result.extra_info["succeeded_count"] == 1

    @pytest.mark.asyncio
    async def test_create_without_status_requires_src(
        self, batch_create_tool, tool_context, setup_project
    ):
        """测试创建没有 status 的图片元素必须有 src"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="image",
                    name="普通图片",
                    x=100,
                    y=100,
                    width=1024,
                    height=1024,
                    properties={
                        # 没有 status，也没有 src
                    }
                )
            ]
        )

        result = await batch_create_tool.execute(tool_context, params)

        # 验证：应该失败
        assert result.ok  # batch_create 总是返回 ok=True
        assert result.extra_info["failed_count"] == 1
        assert result.extra_info["succeeded_count"] == 0

        # 验证错误信息
        failed_elements = result.extra_info["failed_elements"]
        assert len(failed_elements) == 1
        assert "requires 'src' property" in failed_elements[0]["error"]


class TestBatchUpdateStatusField:
    """测试 batch_update 对 status 字段的支持"""

    @pytest.fixture
    def batch_update_tool(self, tmp_path):
        """创建 BatchUpdateCanvasElements 工具实例"""
        tool_instance = BatchUpdateCanvasElements()
        tool_instance.base_dir = tmp_path
        return tool_instance

    @pytest.mark.asyncio
    async def test_update_status_to_completed(
        self, batch_update_tool, tool_context, setup_project
    ):
        """测试更新 status 为 completed"""
        # 先创建一个带 processing 状态的元素
        project_path = setup_project
        config_file = project_path / "magic.project.js"

        config_with_placeholder = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "elem_1",
        "type": "image",
        "name": "占位图",
        "x": 100.0,
        "y": 100.0,
        "width": 2048.0,
        "height": 2048.0,
        "status": "processing"
      }
    ]
  }
};"""
        config_file.write_text(config_with_placeholder, encoding='utf-8')

        # 更新为 completed
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(
                    element_id="elem_1",
                    properties={
                        "status": "completed",
                        "src": "test-project/images/generated.png"
                    }
                )
            ]
        )

        result = await batch_update_tool.execute(tool_context, params)

        # 验证更新成功
        assert result.ok

        # 验证 magic.project.js 被更新
        config_content = config_file.read_text(encoding='utf-8')
        assert '"status": "completed"' in config_content
        assert '"src": "test-project/images/generated.png"' in config_content

    @pytest.mark.asyncio
    async def test_update_status_to_failed(
        self, batch_update_tool, tool_context, setup_project
    ):
        """测试更新 status 为 failed"""
        project_path = setup_project
        config_file = project_path / "magic.project.js"

        config_with_placeholder = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "elem_1",
        "type": "image",
        "name": "占位图",
        "x": 100.0,
        "y": 100.0,
        "width": 2048.0,
        "height": 2048.0,
        "status": "processing"
      }
    ]
  }
};"""
        config_file.write_text(config_with_placeholder, encoding='utf-8')

        # 更新为 failed
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(
                    element_id="elem_1",
                    properties={
                        "status": "failed"
                    }
                )
            ]
        )

        result = await batch_update_tool.execute(tool_context, params)

        # 验证更新成功
        assert result.ok

        # 验证 magic.project.js 被更新
        config_content = config_file.read_text(encoding='utf-8')
        assert '"status": "failed"' in config_content
