"""测试 CreateCanvasElement 工具"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.create_canvas_element import (
    CreateCanvasElement,
    CreateCanvasElementParams,
)


@pytest.fixture
def tool(tmp_path):
    """创建 CreateCanvasElement 工具实例"""
    tool_instance = CreateCanvasElement()
    # 设置 base_dir 以便工具能够正确解析相对路径
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    """创建真实的工具上下文"""
    # 创建真实的 ToolContext 实例，通过 metadata 传递 workspace_dir
    context = ToolContext(metadata={"workspace_dir": str(tmp_path)})

    # Mock agent_context with async dispatch_event
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()

    # 注册 mock 的 agent_context 作为扩展
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

    return project_path


class TestCreateCanvasElement:
    """测试 CreateCanvasElement 工具类"""

    @pytest.mark.asyncio
    async def test_create_image_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建图片元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="image",
            name="测试图片",
            x=100,
            y=200,
            width=800,
            height=600,
            properties={"src": "https://example.com/image.png"}
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Element Details:" in result.content
        assert "Type: image" in result.content
        assert "Name: 测试图片" in result.content
        assert "Element added to: test-project/magic.project.js" in result.content

        # 验证文件内容
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "测试图片" in config_content
        assert "image" in config_content
        assert "https://example.com/image.png" in config_content

    @pytest.mark.asyncio
    async def test_create_text_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建文本元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="text",
            name="标题文本",
            x=50,
            y=50,
            width=400,
            height=100,
            properties={
                "content": [],
                "defaultStyle": {
                    "fontSize": 24,
                    "fontFamily": "Arial",
                    "color": "#000000"
                }
            }
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "text" in result.content
        assert "标题文本" in result.content

    @pytest.mark.asyncio
    async def test_create_rectangle_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建矩形元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="背景矩形",
            x=0,
            y=0,
            width=1920,
            height=1080,
            properties={
                "fill": "#FF5733",
                "stroke": "#000000",
                "strokeWidth": 2,
                "cornerRadius": 10
            }
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "rectangle" in result.content

        # 验证文件内容
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "#FF5733" in config_content
        assert "cornerRadius" in config_content

    @pytest.mark.asyncio
    async def test_create_star_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建星形元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="star",
            name="五角星",
            x=300,
            y=300,
            width=200,
            height=200,
            properties={
                "fill": "#FFD700",
                "sides": 5,
                "innerRadiusRatio": 0.5
            }
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "star" in result.content

    @pytest.mark.asyncio
    async def test_create_element_with_custom_id(self, tool, tool_context, setup_project, tmp_path):
        """测试使用自定义ID创建元素"""
        project_path = setup_project

        custom_id = "custom-element-12345"

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="ellipse",
            name="自定义ID圆形",
            x=100,
            y=100,
            width=150,
            height=150,
            element_id=custom_id,
            properties={"fill": "#00FF00"}
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert custom_id in result.content

        # 验证文件中包含自定义ID
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert custom_id in config_content

    @pytest.mark.asyncio
    async def test_create_element_duplicate_id(self, tool, tool_context, setup_project, tmp_path):
        """测试创建重复ID的元素应失败"""
        project_path = setup_project

        # 首先创建一个元素
        params1 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="第一个元素",
            x=0,
            y=0,
            width=100,
            height=100,
            element_id="duplicate-id-test"
        )

        result1 = await tool.execute(tool_context, params1)
        assert result1.ok

        # 尝试使用相同ID创建第二个元素
        params2 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="ellipse",
            name="第二个元素",
            x=200,
            y=200,
            width=100,
            height=100,
            element_id="duplicate-id-test"
        )

        result2 = await tool.execute(tool_context, params2)

        # 验证应该失败
        assert not result2.ok
        assert result2.content is not None
        assert "already exists" in result2.content

    @pytest.mark.asyncio
    async def test_create_element_with_z_index(self, tool, tool_context, setup_project, tmp_path):
        """测试创建带指定图层的元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="高层元素",
            x=0,
            y=0,
            width=100,
            height=100,
            z_index=10
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Layer: 10" in result.content

    @pytest.mark.asyncio
    async def test_create_element_auto_z_index(self, tool, tool_context, setup_project, tmp_path):
        """测试自动分配图层层级"""
        project_path = setup_project

        # 创建第一个元素（会自动获得 z-index 0）
        params1 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="底层元素",
            x=0,
            y=0,
            width=100,
            height=100
        )

        result1 = await tool.execute(tool_context, params1)
        assert result1.ok

        # 创建第二个元素（应该自动获得 z-index 1）
        params2 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="上层元素",
            x=50,
            y=50,
            width=100,
            height=100
        )

        result2 = await tool.execute(tool_context, params2)
        assert result2.ok

    @pytest.mark.asyncio
    async def test_create_element_project_not_exist(self, tool, tool_context, tmp_path):
        """测试项目不存在时创建元素"""
        params = CreateCanvasElementParams(
            project_path="non-existent-project",
            element_type="image",
            name="测试",
            x=0,
            y=0,
            width=100,
            height=100
        )

        result = await tool.execute(tool_context, params)

        # 验证应该失败
        assert not result.ok
        assert result.content is not None
        assert "does not exist" in result.content

    @pytest.mark.asyncio
    async def test_create_element_no_config_file(self, tool, tool_context, tmp_path):
        """测试项目文件夹存在但没有 magic.project.js 时创建元素"""
        project_path = tmp_path / "no-config-project"
        project_path.mkdir()

        params = CreateCanvasElementParams(
            project_path="no-config-project",
            element_type="image",
            name="测试",
            x=0,
            y=0,
            width=100,
            height=100
        )

        result = await tool.execute(tool_context, params)

        # 验证应该失败
        assert not result.ok
        assert result.content is not None
        assert "does not exist" in result.content

    @pytest.mark.asyncio
    async def test_create_element_invalid_type(self, tool, tool_context, setup_project, tmp_path):
        """测试无效的元素类型"""
        with pytest.raises(ValueError) as exc_info:
            CreateCanvasElementParams(
                project_path="test-project",
                element_type="invalid_type",
                name="测试",
                x=0,
                y=0,
                width=100,
                height=100
            )

        assert "Invalid element_type" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_image_without_size(self, tool, tool_context, setup_project, tmp_path):
        """测试创建图片元素时未提供尺寸"""
        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="image",
            name="无尺寸图片",
            x=0,
            y=0
        )

        result = await tool.execute(tool_context, params)

        # 验证应该失败
        assert not result.ok
        assert result.content is not None
        assert "requires both width and height" in result.content

    @pytest.mark.asyncio
    async def test_create_element_invalid_opacity(self, tool, tool_context, setup_project, tmp_path):
        """测试无效的透明度值"""
        with pytest.raises(ValueError) as exc_info:
            CreateCanvasElementParams(
                project_path="test-project",
                element_type="rectangle",
                name="测试",
                x=0,
                y=0,
                width=100,
                height=100,
                opacity=1.5  # 超出范围
            )

        assert "Opacity must be between 0 and 1" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_create_element_with_visibility_lock(self, tool, tool_context, setup_project, tmp_path):
        """测试创建带可见性和锁定状态的元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="隐藏且锁定的元素",
            x=0,
            y=0,
            width=100,
            height=100,
            visible=False,
            locked=True,
            opacity=0.5
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok

        # 验证文件内容
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert '"visible": false' in config_content
        assert '"locked": true' in config_content
        assert '"opacity": 0.5' in config_content

    @pytest.mark.asyncio
    async def test_create_group_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建组元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="group",
            name="元素组",
            x=0,
            y=0,
            width=500,
            height=500,
            properties={"children": []}
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "group" in result.content

    @pytest.mark.asyncio
    async def test_create_frame_element(self, tool, tool_context, setup_project, tmp_path):
        """测试创建画框元素"""
        project_path = setup_project

        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="frame",
            name="画框1",
            x=0,
            y=0,
            width=1920,
            height=1080,
            properties={"children": []}
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "frame" in result.content

    @pytest.mark.asyncio
    async def test_create_element_negative_size(self, tool, tool_context, setup_project, tmp_path):
        """测试创建负尺寸的元素"""
        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="负尺寸元素",
            x=0,
            y=0,
            width=-100,
            height=100
        )

        result = await tool.execute(tool_context, params)

        # 验证应该失败
        assert not result.ok
        assert result.content is not None
        assert "positive numbers" in result.content

    @pytest.mark.asyncio
    async def test_get_friendly_action_and_remark_success(self, tool, tool_context, setup_project):
        """测试成功时的友好操作和备注"""
        result = MagicMock()
        result.ok = True

        arguments = {
            "element_type": "image",
            "name": "测试图片"
        }

        response = await tool.get_after_tool_call_friendly_action_and_remark(
            "create_canvas_element", tool_context, result, 1.0, arguments
        )

        assert "action" in response
        assert "remark" in response
        assert "创建画布元素" in response["action"] or "Create canvas element" in response["action"]

    @pytest.mark.asyncio
    async def test_get_friendly_action_and_remark_failure(self, tool, tool_context):
        """测试失败时的友好操作和备注"""
        result = MagicMock()
        result.ok = False

        response = await tool.get_after_tool_call_friendly_action_and_remark(
            "create_canvas_element", tool_context, result, 1.0, {}
        )

        assert "action" in response
        assert "remark" in response

    @pytest.mark.asyncio
    async def test_auto_read_image_dimensions(self, tool, tool_context, setup_project, tmp_path):
        """测试自动读取图片尺寸"""
        from PIL import Image as PILImage

        project_path = setup_project

        # 创建测试图片
        image_dir = tmp_path / "test-project" / "images"
        image_dir.mkdir(parents=True)
        image_path = image_dir / "test_photo.jpg"
        img = PILImage.new('RGB', (1024, 768), color='blue')
        img.save(image_path)

        # 创建图片元素，不提供 width 和 height
        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="image",
            name="自动尺寸图片",
            properties={"src": "test-project/images/test_photo.jpg"}
            # 注意：不提供 width, height, x, y
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "1024" in result.content  # 宽度应该是自动读取的
        assert "768" in result.content   # 高度应该是自动读取的

        # 验证文件内容
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "1024" in config_content
        assert "768" in config_content

    @pytest.mark.asyncio
    async def test_auto_calculate_position(self, tool, tool_context, setup_project, tmp_path):
        """测试自动计算位置"""
        project_path = setup_project

        # 创建第一个元素
        params1 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="元素1",
            width=200,
            height=150
            # 不提供 x, y，应该自动计算为 (0, 0)
        )

        result1 = await tool.execute(tool_context, params1)
        assert result1.ok
        assert "(0.0, 0.0)" in result1.content or "(0, 0)" in result1.content

        # 创建第二个元素
        params2 = CreateCanvasElementParams(
            project_path="test-project",
            element_type="rectangle",
            name="元素2",
            width=200,
            height=150
            # 不提供 x, y，应该自动计算为 (220, 0)
        )

        result2 = await tool.execute(tool_context, params2)
        assert result2.ok
        assert "220" in result2.content  # 自动计算的 x 坐标

    @pytest.mark.asyncio
    async def test_auto_position_with_generate_image_request(self, tool, tool_context, setup_project, tmp_path):
        """测试带 generateImageRequest 的图片元素自动定位"""
        from PIL import Image as PILImage

        project_path = setup_project

        # 创建测试图片
        image_dir = tmp_path / "test-project" / "generated"
        image_dir.mkdir(parents=True)
        image_path = image_dir / "ai_sunset.png"
        img = PILImage.new('RGB', (2048, 2048), color='orange')
        img.save(image_path)

        # 创建图片元素，包含 generateImageRequest
        params = CreateCanvasElementParams(
            project_path="test-project",
            element_type="image",
            name="AI 生成的日落",
            properties={
                "src": "test-project/generated/ai_sunset.png",
                "generateImageRequest": {
                    "model_id": "doubao-seedream-4-0-250828",
                    "prompt": "A beautiful sunset over mountains",
                    "size": "2048x2048",
                    "resolution": "2048x2048",
                    "image_id": "ai_sunset.png"
                }
            }
            # 不提供任何位置和尺寸信息
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "2048" in result.content  # 自动读取的尺寸

        # 验证 generateImageRequest 已保存
        config_file = project_path / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "generateImageRequest" in config_content
        assert "doubao-seedream-4-0-250828" in config_content
        assert "A beautiful sunset over mountains" in config_content
