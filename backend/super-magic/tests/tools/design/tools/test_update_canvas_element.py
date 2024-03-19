"""测试更新画布元素工具"""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock
import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.update_canvas_element import (
    UpdateCanvasElement,
    UpdateCanvasElementParams,
)

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool(tmp_path):
    """创建 UpdateCanvasElement 工具实例"""
    tool_instance = UpdateCanvasElement()
    # 设置 base_dir 以便工具能够正确解析相对路径
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    """创建 mock 的工具上下文"""
    from unittest.mock import Mock
    context = MagicMock(spec=ToolContext)

    # Mock agent_context with AsyncMock dispatch_event
    mock_agent_context = MagicMock()
    mock_agent_context.dispatch_event = AsyncMock()
    context.get_extension_typed = Mock(return_value=mock_agent_context)

    # Set base_dir for image reading (standard ToolContext property)
    context.base_dir = str(tmp_path)

    return context


@pytest.fixture
def setup_project_with_elements(tmp_path):
    """创建一个包含元素的测试项目"""
    project_path = tmp_path / "test-project"
    project_path.mkdir(parents=True)

    # 创建包含初始元素的配置文件
    config_content = """window.magicProjectConfig = {
  "name": "Test Project",
  "version": "1.0.0",
  "type": "design",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": [
      {
        "id": "test-element-1",
        "name": "Test Rectangle",
        "type": "rectangle",
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 150,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#FF0000",
        "stroke": "#000000",
        "strokeWidth": 2,
        "cornerRadius": 10
      },
      {
        "id": "test-element-2",
        "name": "Test Image",
        "type": "image",
        "x": 50,
        "y": 50,
        "width": 200,
        "height": 200,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 0.8,
        "src": "/images/test.png",
        "visualUnderstanding": {
          "summary": "Original summary",
          "analyzedAt": "2025-12-22T10:00:00Z"
        }
      },
      {
        "id": "test-element-3",
        "name": "Locked Element",
        "type": "text",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 50,
        "zIndex": 2,
        "visible": true,
        "locked": true,
        "opacity": 1.0,
        "content": [],
        "defaultStyle": {
          "fontSize": 16,
          "fontFamily": "Arial"
        }
      }
    ]
  }
};"""

    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    # 创建 images 文件夹
    images_path = project_path / "images"
    images_path.mkdir()

    return project_path


class TestUpdateCanvasElement:
    """测试 UpdateCanvasElement 工具"""

    async def test_update_element_position(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新元素位置"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            x=500.0,
            y=600.0
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "test-element-1" in result.content
        assert "500" in result.content
        assert "600" in result.content

        # 验证配置文件被更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.x == 500.0
        assert element.y == 600.0

    async def test_update_element_size(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新元素尺寸"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            width=400.0,
            height=250.0
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "400" in result.content
        assert "250" in result.content

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.width == 400.0
        assert element.height == 250.0

    async def test_update_element_name(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新元素名称"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            name="Updated Rectangle Name"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Updated Rectangle Name" in result.content

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.name == "Updated Rectangle Name"

    async def test_update_element_z_index(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新图层层级"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            z_index=10
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "10" in result.content

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.zIndex == 10

    async def test_update_element_visibility(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新可见性"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            visible=False
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "visible" in result.content.lower()

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.visible is False

    async def test_update_element_locked_status(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新锁定状态"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            locked=True
        )

        result = await tool.execute(tool_context, params)

        assert result.ok

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.locked is True

    async def test_update_locked_element(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试可以更新锁定的元素（工具层不阻止）"""
        project_path = setup_project_with_elements

        # 更新一个已经锁定的元素
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-3",
            x=100.0,
            y=100.0
        )

        result = await tool.execute(tool_context, params)

        # 应该成功（工具层不阻止更新锁定元素）
        assert result.ok

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-3")
        assert element.x == 100.0
        assert element.y == 100.0
        assert element.locked is True  # 锁定状态仍然保持

    async def test_update_element_opacity(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新透明度"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            opacity=0.5
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "0.5" in result.content

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.opacity == 0.5

    async def test_update_element_properties(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新元素特定属性"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            properties={
                "fill": "#00FF00",
                "stroke": "#FFFFFF",
                "strokeWidth": 5
            }
        )

        result = await tool.execute(tool_context, params)

        assert result.ok

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.fill == "#00FF00"
        assert element.stroke == "#FFFFFF"
        assert element.strokeWidth == 5
        # 未更新的属性应该保持不变
        assert element.cornerRadius == 10

    async def test_deep_merge_nested_properties(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试深度合并嵌套属性"""
        project_path = setup_project_with_elements

        # 更新 visualUnderstanding 的部分字段
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-2",
            properties={
                "visualUnderstanding": {
                    "summary": "Updated summary"
                }
            }
        )

        result = await tool.execute(tool_context, params)

        assert result.ok

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-2")
        # summary 应该被更新
        assert element.visualUnderstanding["summary"] == "Updated summary"
        # analyzedAt 应该保留
        assert element.visualUnderstanding["analyzedAt"] == "2025-12-22T10:00:00Z"

    async def test_update_multiple_fields(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试同时更新多个字段"""
        project_path = setup_project_with_elements

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            name="Multi-Updated Rectangle",
            x=300.0,
            y=400.0,
            width=500.0,
            height=250.0,
            z_index=5,
            visible=False,
            opacity=0.7,
            properties={
                "fill": "#0000FF"
            }
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Multi-Updated Rectangle" in result.content

        # 验证所有更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.name == "Multi-Updated Rectangle"
        assert element.x == 300.0
        assert element.y == 400.0
        assert element.width == 500.0
        assert element.height == 250.0
        assert element.zIndex == 5
        assert element.visible is False
        assert element.opacity == 0.7
        assert element.fill == "#0000FF"

    async def test_update_element_not_found(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新不存在的元素"""
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="non-existent-element",
            x=100.0
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not found" in result.content.lower()

    async def test_update_project_not_found(self, tool, tool_context, tmp_path):
        """测试项目不存在的情况"""
        params = UpdateCanvasElementParams(
            project_path="non-existent-project",
            element_id="test-element-1",
            x=100.0
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not exist" in result.content.lower() or "not found" in result.content.lower()

    async def test_update_no_fields_provided(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试不提供任何更新字段"""
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1"
        )

        result = await tool.execute(tool_context, params)

        # 应该成功但提示没有变化
        assert result.ok
        assert "no changes" in result.content.lower() or "remains unchanged" in result.content.lower()

    async def test_validate_opacity_range(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试透明度范围验证"""
        # 测试透明度 < 0
        with pytest.raises(ValueError, match="Opacity must be between 0 and 1"):
            UpdateCanvasElementParams(
                project_path="test-project",
                element_id="test-element-1",
                opacity=-0.1
            )

        # 测试透明度 > 1
        with pytest.raises(ValueError, match="Opacity must be between 0 and 1"):
            UpdateCanvasElementParams(
                project_path="test-project",
                element_id="test-element-1",
                opacity=1.5
            )

    async def test_validate_positive_size(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试尺寸必须为正数"""
        # 测试负数宽度
        with pytest.raises(ValueError, match="Width and height must be positive"):
            UpdateCanvasElementParams(
                project_path="test-project",
                element_id="test-element-1",
                width=-100.0
            )

        # 测试负数高度
        with pytest.raises(ValueError, match="Width and height must be positive"):
            UpdateCanvasElementParams(
                project_path="test-project",
                element_id="test-element-1",
                height=-50.0
            )

        # 测试零宽度
        with pytest.raises(ValueError, match="Width and height must be positive"):
            UpdateCanvasElementParams(
                project_path="test-project",
                element_id="test-element-1",
                width=0.0
            )

    async def test_parse_properties_from_json_string(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试从 JSON 字符串解析 properties"""
        import json

        project_path = setup_project_with_elements

        properties_dict = {"fill": "#FFFF00", "strokeWidth": 3}
        properties_json = json.dumps(properties_dict)

        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            properties=properties_json
        )

        result = await tool.execute(tool_context, params)

        assert result.ok

        # 验证配置文件
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("test-element-1")
        assert element.fill == "#FFFF00"
        assert element.strokeWidth == 3

    async def test_friendly_action_and_remark_success(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试成功时的友好动作和备注"""
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            x=100.0
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "update_canvas_element",
            tool_context,
            result,
            0.1,
            {"element_id": "test-element-1"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        assert "test-element-1" in action_remark["remark"]

    async def test_friendly_action_and_remark_failure(self, tool, tool_context, tmp_path):
        """测试失败时的友好动作和备注"""
        params = UpdateCanvasElementParams(
            project_path="non-existent-project",
            element_id="test-element-1",
            x=100.0
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "update_canvas_element",
            tool_context,
            result,
            0.1,
            {"element_id": "test-element-1"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        # 失败时应该显示异常信息
        assert "异常" in action_remark["remark"] or "exception" in action_remark["remark"].lower()

    async def test_update_preserves_other_elements(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更新一个元素不影响其他元素"""
        project_path = setup_project_with_elements

        # 记录其他元素的初始状态
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element2_before = await manager.get_element_by_id("test-element-2")
        element3_before = await manager.get_element_by_id("test-element-3")

        # 更新元素1
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-1",
            x=999.0
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 重新加载并检查其他元素未变化
        manager = CanvasManager(str(project_path))
        await manager.load()

        element2_after = await manager.get_element_by_id("test-element-2")
        element3_after = await manager.get_element_by_id("test-element-3")

        # 元素2和元素3应该完全不变
        assert element2_after.x == element2_before.x
        assert element2_after.y == element2_before.y
        assert element2_after.src == element2_before.src

        assert element3_after.x == element3_before.x
        assert element3_after.y == element3_before.y
        assert element3_after.locked == element3_before.locked

    async def test_update_image_src_auto_read_dimensions(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更换图片 src 时自动读取新图片尺寸"""
        from PIL import Image as PILImage

        project_path = setup_project_with_elements

        # 创建新的测试图片（不同尺寸）
        new_image_dir = tmp_path / "test-project" / "images"
        new_image_dir.mkdir(parents=True, exist_ok=True)
        new_image_path = new_image_dir / "new_photo.jpg"
        img = PILImage.new('RGB', (1024, 768), color='green')
        img.save(new_image_path)

        # 更新图片 src（不提供 width/height）
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-2",
            properties={"src": "test-project/images/new_photo.jpg"}
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "1024" in result.content  # 新的宽度
        assert "768" in result.content   # 新的高度

        # 验证文件中的尺寸已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()
        element = await manager.get_element_by_id("test-element-2")

        assert element.width == 1024
        assert element.height == 768
        assert element.src == "test-project/images/new_photo.jpg"

    async def test_update_image_src_clears_generate_image_request(self, tool, tool_context, tmp_path):
        """测试更换图片 src 时自动清除 generateImageRequest"""
        from PIL import Image as PILImage

        # 创建带 generateImageRequest 的项目
        project_path = tmp_path / "test-project"
        project_path.mkdir(parents=True)

        config_content = """window.magicProjectConfig = {
  "name": "Test Project",
  "version": "1.0.0",
  "type": "design",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "ai-image-1",
        "name": "AI Generated Image",
        "type": "image",
        "x": 0,
        "y": 0,
        "width": 512,
        "height": 512,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "src": "test-project/ai_sunset.png",
        "generateImageRequest": {
          "model_id": "doubao-seedream-4-0-250828",
          "prompt": "A beautiful sunset",
          "size": "512x512",
          "resolution": "512x512",
          "image_id": "ai_sunset.png"
        }
      }
    ]
  }
};"""

        config_file = project_path / "magic.project.js"
        config_file.write_text(config_content, encoding='utf-8')

        # 创建新图片
        image_dir = project_path / "images"
        image_dir.mkdir(parents=True)
        new_image_path = image_dir / "photo.jpg"
        img = PILImage.new('RGB', (1024, 768), color='blue')
        img.save(new_image_path)

        # 更新 src
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="ai-image-1",
            properties={"src": "test-project/images/photo.jpg"}
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 验证 generateImageRequest 已被清除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()
        element = await manager.get_element_by_id("ai-image-1")

        assert element.src == "test-project/images/photo.jpg"
        assert element.generateImageRequest is None

    async def test_update_image_src_clears_visual_understanding(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更换图片 src 时自动清除 visualUnderstanding"""
        from PIL import Image as PILImage

        project_path = setup_project_with_elements

        # 创建新图片
        new_image_dir = tmp_path / "test-project" / "images"
        new_image_dir.mkdir(parents=True, exist_ok=True)
        new_image_path = new_image_dir / "another_photo.jpg"
        img = PILImage.new('RGB', (800, 600), color='red')
        img.save(new_image_path)

        # 更新 src（test-element-2 已有 visualUnderstanding）
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-2",
            properties={"src": "test-project/images/another_photo.jpg"}
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 验证 visualUnderstanding 已被清除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()
        element = await manager.get_element_by_id("test-element-2")

        assert element.src == "test-project/images/another_photo.jpg"
        assert element.visualUnderstanding is None

    async def test_update_image_without_src_change_preserves_metadata(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试不更换 src 时保持 visualUnderstanding 不变"""
        project_path = setup_project_with_elements

        # 只更新位置，不更换 src
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-2",
            x=100.0,
            y=150.0
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 验证 visualUnderstanding 保持不变
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()
        element = await manager.get_element_by_id("test-element-2")

        assert element.x == 100.0
        assert element.y == 150.0
        # visualUnderstanding 应该保持不变
        assert element.visualUnderstanding is not None
        assert element.visualUnderstanding.get('summary') == "Original summary"
        assert element.visualUnderstanding.get('analyzedAt') == "2025-12-22T10:00:00Z"

    async def test_update_image_src_with_manual_dimensions(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试更换图片 src 时手动提供尺寸（不自动读取）"""
        from PIL import Image as PILImage

        project_path = setup_project_with_elements

        # 创建新图片
        new_image_dir = tmp_path / "test-project" / "images"
        new_image_dir.mkdir(parents=True, exist_ok=True)
        new_image_path = new_image_dir / "manual_size.jpg"
        img = PILImage.new('RGB', (1920, 1080), color='yellow')
        img.save(new_image_path)

        # 更新 src 并手动指定尺寸（与实际尺寸不同）
        params = UpdateCanvasElementParams(
            project_path="test-project",
            element_id="test-element-2",
            width=500.0,
            height=300.0,
            properties={"src": "test-project/images/manual_size.jpg"}
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 验证使用了手动提供的尺寸，而不是图片实际尺寸
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()
        element = await manager.get_element_by_id("test-element-2")

        assert element.width == 500.0   # 使用手动提供的值
        assert element.height == 300.0  # 使用手动提供的值
        assert element.src == "test-project/images/manual_size.jpg"
