"""测试 QueryCanvasElement 工具"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.query_canvas_element import (
    QueryCanvasElement,
    QueryCanvasElementParams,
)


# 设置文件级别的 pytest 标记
pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool(tmp_path):
    """创建 QueryCanvasElement 工具实例"""
    tool_instance = QueryCanvasElement()
    # 设置 base_dir 以便工具能够正确解析相对路径
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    """创建工具上下文"""
    # 创建真实的 ToolContext 实例，通过 metadata 传递 workspace_dir
    context = ToolContext(metadata={"workspace_dir": str(tmp_path)})

    # Mock agent_context with async dispatch_event
    agent_context = MagicMock()
    agent_context.dispatch_event = AsyncMock()

    # 注册 mock 的 agent_context 作为扩展
    context.register_extension("agent_context", agent_context)

    return context


@pytest.fixture
def setup_project_with_image(tmp_path):
    """创建一个包含图片元素的测试项目"""
    project_path = tmp_path / "image-project"
    project_path.mkdir()

    # 创建 images 文件夹和测试图片
    images_dir = project_path / "images"
    images_dir.mkdir()
    test_image = images_dir / "test.jpg"
    test_image.write_bytes(b"fake image data" * 1000)  # 约 15KB

    # 创建 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "image-project",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": [
      {
        "id": "image-1",
        "name": "测试图片",
        "type": "image",
        "x": 100,
        "y": 200,
        "width": 800,
        "height": 600,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "src": "images/test.jpg"
      },
      {
        "id": "text-1",
        "name": "周围文本",
        "type": "text",
        "x": 1000,
        "y": 300,
        "width": 400,
        "height": 80,
        "zIndex": 2,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "content": [],
        "defaultStyle": {}
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


@pytest.fixture
def setup_project_with_text(tmp_path):
    """创建一个包含文本元素的测试项目"""
    project_path = tmp_path / "text-project"
    project_path.mkdir()

    # 创建 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "text-project",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": [
      {
        "id": "text-1",
        "name": "标题文本",
        "type": "text",
        "x": 100,
        "y": 100,
        "width": 500,
        "height": 80,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "content": [
          {
            "children": [
              {"text": "Hello World"}
            ]
          }
        ],
        "defaultStyle": {
          "fontSize": "48px",
          "fontFamily": "Arial",
          "color": "#000000",
          "bold": true
        }
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


@pytest.fixture
def setup_project_with_shapes(tmp_path):
    """创建一个包含形状元素的测试项目"""
    project_path = tmp_path / "shape-project"
    project_path.mkdir()

    # 创建 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "shape-project",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": [
      {
        "id": "rect-1",
        "name": "矩形",
        "type": "rectangle",
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 100,
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
        "id": "circle-1",
        "name": "圆形",
        "type": "ellipse",
        "x": 400,
        "y": 150,
        "width": 150,
        "height": 150,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 0.8,
        "fill": "#00FF00"
      },
      {
        "id": "star-1",
        "name": "星形",
        "type": "star",
        "x": 600,
        "y": 100,
        "width": 100,
        "height": 100,
        "zIndex": 2,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#FFFF00",
        "sides": 5,
        "innerRadiusRatio": 0.5
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


@pytest.fixture
def setup_project_with_container(tmp_path):
    """创建一个包含容器元素的测试项目"""
    project_path = tmp_path / "container-project"
    project_path.mkdir()

    # 创建 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "container-project",
  "canvas": {
    "viewport": {
      "scale": 1.0,
      "x": 0,
      "y": 0
    },
    "elements": [
      {
        "id": "frame-1",
        "name": "画框",
        "type": "frame",
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "children": [
          {
            "id": "child-1",
            "name": "子元素1",
            "type": "rectangle",
            "x": 100,
            "y": 100,
            "width": 100,
            "height": 100,
            "zIndex": 0,
            "visible": true,
            "locked": false,
            "opacity": 1.0,
            "fill": "#FF0000"
          }
        ]
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


class TestQueryCanvasElement:
    """测试 QueryCanvasElement 工具类"""

    async def test_query_image_element(self, tool, tool_context, setup_project_with_image):
        """测试查询图片元素"""
        project_path = setup_project_with_image

        params = QueryCanvasElementParams(
            project_path="image-project",
            element_id="image-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Element Information:" in result.content
        assert "测试图片" in result.content
        assert "Type: image" in result.content
        assert "Image Properties" in result.content
        assert "images/test.jpg" in result.content
        # 文件应该存在
        assert "File Size:" in result.content or "File Status:" in result.content

    async def test_query_text_element(self, tool, tool_context, setup_project_with_text):
        """测试查询文本元素"""
        project_path = setup_project_with_text

        params = QueryCanvasElementParams(
            project_path="text-project",
            element_id="text-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "标题文本" in result.content
        assert "Text Properties" in result.content
        assert "Hello World" in result.content
        assert "Arial" in result.content
        assert "48px" in result.content

    async def test_query_shape_element_rectangle(self, tool, tool_context, setup_project_with_shapes):
        """测试查询矩形元素"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="rect-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "矩形" in result.content
        assert "Shape Properties" in result.content
        assert "#FF0000" in result.content
        assert "Corner Radius: 10" in result.content

    async def test_query_shape_element_star(self, tool, tool_context, setup_project_with_shapes):
        """测试查询星形元素"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="star-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "星形" in result.content
        assert "Shape Properties" in result.content
        assert "Sides: 5" in result.content
        assert "Inner Radius Ratio: 0.5" in result.content

    async def test_query_container_element(self, tool, tool_context, setup_project_with_container):
        """测试查询容器元素"""
        project_path = setup_project_with_container

        params = QueryCanvasElementParams(
            project_path="container-project",
            element_id="frame-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "画框" in result.content
        assert "Container Properties" in result.content
        assert "Children Count: 1" in result.content
        assert "child-1" in result.content

    async def test_include_surrounding_elements(self, tool, tool_context, setup_project_with_image):
        """测试包含周围元素分析"""
        project_path = setup_project_with_image

        params = QueryCanvasElementParams(
            project_path="image-project",
            element_id="image-1",
            include_surrounding=True
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Surrounding Elements" in result.content
        assert "周围文本" in result.content
        # 应该包含距离和方向信息
        assert "px" in result.content

    async def test_exclude_surrounding_elements(self, tool, tool_context, setup_project_with_image):
        """测试不包含周围元素分析"""
        project_path = setup_project_with_image

        params = QueryCanvasElementParams(
            project_path="image-project",
            element_id="image-1",
            include_surrounding=False
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 不应该包含周围元素信息
        assert "Surrounding Elements" not in result.content

    async def test_include_layer_context(self, tool, tool_context, setup_project_with_shapes):
        """测试包含图层关系分析"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="circle-1",  # z-index = 1
            include_layer_context=True
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 应该显示上下图层
        assert "Layers Below" in result.content or "Layers Above" in result.content

    async def test_exclude_layer_context(self, tool, tool_context, setup_project_with_shapes):
        """测试不包含图层关系分析"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="circle-1",
            include_layer_context=False
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 不应该包含图层信息
        assert "Layers Below" not in result.content
        assert "Layers Above" not in result.content

    async def test_query_nonexistent_element(self, tool, tool_context, setup_project_with_image):
        """测试查询不存在的元素"""
        project_path = setup_project_with_image

        params = QueryCanvasElementParams(
            project_path="image-project",
            element_id="nonexistent-element"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not found" in result.content.lower()

    async def test_query_from_nonexistent_project(self, tool, tool_context, tmp_path):
        """测试从不存在的项目查询"""
        params = QueryCanvasElementParams(
            project_path="nonexistent-project",
            element_id="any-element"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "does not exist" in result.content or "不存在" in result.content

    async def test_element_status_display(self, tool, tool_context, setup_project_with_shapes):
        """测试元素状态显示"""
        project_path = setup_project_with_shapes

        # 查询有特殊状态的元素（opacity < 1.0）
        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="circle-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Opacity: 0.80" in result.content or "opacity: 0.8" in result.content.lower()

    async def test_file_info_for_missing_image(self, tool, tool_context, setup_project_with_image):
        """测试缺失图片文件的信息显示"""
        project_path = setup_project_with_image

        # 修改配置文件，使图片路径指向不存在的文件
        config_file = project_path / "magic.project.js"
        content = config_file.read_text(encoding='utf-8')
        content = content.replace('images/test.jpg', 'images/missing.jpg')
        config_file.write_text(content, encoding='utf-8')

        params = QueryCanvasElementParams(
            project_path="image-project",
            element_id="image-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "File Status: Not found" in result.content

    async def test_position_and_size_display(self, tool, tool_context, setup_project_with_text):
        """测试位置和尺寸显示"""
        project_path = setup_project_with_text

        params = QueryCanvasElementParams(
            project_path="text-project",
            element_id="text-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Position: (100, 100)" in result.content
        assert "Size: 500 × 80" in result.content
        assert "Layer (z-index): 1" in result.content

    async def test_complete_flow_with_all_options(self, tool, tool_context, setup_project_with_shapes):
        """测试完整流程（包含所有选项）"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="circle-1",
            include_surrounding=True,
            include_layer_context=True
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 应该包含所有信息
        assert "圆形" in result.content
        assert "Shape Properties" in result.content
        assert "Surrounding Elements" in result.content
        assert "Layers Below" in result.content or "Layers Above" in result.content

    async def test_minimal_flow_without_options(self, tool, tool_context, setup_project_with_shapes):
        """测试最小流程（不包含任何可选项）"""
        project_path = setup_project_with_shapes

        params = QueryCanvasElementParams(
            project_path="shape-project",
            element_id="rect-1",
            include_surrounding=False,
            include_layer_context=False
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 应该只包含基本信息
        assert "矩形" in result.content
        assert "Shape Properties" in result.content
        # 不应该包含周围元素和图层信息
        assert "Surrounding Elements" not in result.content
        assert "Layers Below" not in result.content
        assert "Layers Above" not in result.content
