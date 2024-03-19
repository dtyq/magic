"""测试 QueryCanvasOverview 工具"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.query_canvas_overview import (
    QueryCanvasOverview,
    QueryCanvasOverviewParams,
)


# 设置文件级别的 pytest 标记
pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool(tmp_path):
    """创建 QueryCanvasOverview 工具实例"""
    tool_instance = QueryCanvasOverview()
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
def setup_empty_project(tmp_path):
    """创建一个空的测试项目"""
    project_path = tmp_path / "empty-project"
    project_path.mkdir()

    # 创建空画布的 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "empty-project",
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


@pytest.fixture
def setup_project_with_elements(tmp_path):
    """创建一个包含多个元素的测试项目"""
    project_path = tmp_path / "test-project"
    project_path.mkdir()

    # 创建包含多个元素的 magic.project.js
    config_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "test-project",
  "canvas": {
    "viewport": {
      "scale": 1.5,
      "x": 100,
      "y": 200
    },
    "elements": [
      {
        "id": "element-1",
        "name": "背景图",
        "type": "image",
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "src": "images/bg.jpg"
      },
      {
        "id": "element-2",
        "name": "标题文字",
        "type": "text",
        "x": 100,
        "y": 100,
        "width": 400,
        "height": 80,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "content": [],
        "defaultStyle": {}
      },
      {
        "id": "element-3",
        "name": "装饰矩形",
        "type": "rectangle",
        "x": 500,
        "y": 300,
        "width": 200,
        "height": 100,
        "zIndex": 2,
        "visible": true,
        "locked": true,
        "opacity": 0.8,
        "fill": "#FF0000",
        "stroke": "#000000",
        "strokeWidth": 2,
        "cornerRadius": 10
      },
      {
        "id": "element-4",
        "name": "隐藏圆形",
        "type": "ellipse",
        "x": 800,
        "y": 400,
        "width": 150,
        "height": 150,
        "zIndex": 3,
        "visible": false,
        "locked": false,
        "opacity": 1.0,
        "fill": "#00FF00"
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


@pytest.fixture
def setup_large_project(tmp_path):
    """创建一个包含大量元素的测试项目（用于测试分页）"""
    project_path = tmp_path / "large-project"
    project_path.mkdir()

    # 生成 60 个元素（超过单页限制 50）
    elements = []
    for i in range(60):
        element_type = ["image", "text", "rectangle", "ellipse"][i % 4]
        elements.append(f"""      {{
        "id": "element-{i+1}",
        "name": "元素{i+1}",
        "type": "{element_type}",
        "x": {i * 100},
        "y": {i * 50},
        "width": 100,
        "height": 100,
        "zIndex": {i},
        "visible": true,
        "locked": false,
        "opacity": 1.0
      }}""")

    elements_str = ",\n".join(elements)

    config_content = f"""window.magicProjectConfig = {{
  "version": "1.0.0",
  "type": "design",
  "name": "large-project",
  "canvas": {{
    "viewport": {{
      "scale": 1.0,
      "x": 0,
      "y": 0
    }},
    "elements": [
{elements_str}
    ]
  }}
}};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


class TestQueryCanvasOverview:
    """测试 QueryCanvasOverview 工具类"""

    async def test_query_empty_canvas(self, tool, tool_context, setup_empty_project):
        """测试查询空画布"""
        project_path = setup_empty_project

        params = QueryCanvasOverviewParams(
            project_path="empty-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Total Elements: 0" in result.content
        assert "No elements found matching the query criteria" in result.content
        assert "Pagination:" in result.content
        assert "Showing: 0 of 0" in result.content

    async def test_query_canvas_with_elements(self, tool, tool_context, setup_project_with_elements):
        """测试查询包含元素的画布"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Total Elements: 4" in result.content
        assert "Visible Elements: 3" in result.content
        assert "Locked Elements: 1" in result.content
        # 检查元素类型分布
        assert "image: 1" in result.content
        assert "text: 1" in result.content
        assert "rectangle: 1" in result.content
        assert "ellipse: 1" in result.content
        # 检查分页信息（默认参数）
        assert "Pagination:" in result.content
        assert "Showing: 4 of 4" in result.content

    async def test_sort_by_layer(self, tool, tool_context, setup_project_with_elements):
        """测试按图层排序"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            sort_by="layer"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # Query Settings 已移除，不再检查
        # 检查排序（应该按 zIndex 升序）
        content = result.content
        bg_pos = content.find("背景图")
        title_pos = content.find("标题文字")
        rect_pos = content.find("装饰矩形")
        circle_pos = content.find("隐藏圆形")

        # 确保元素按 zIndex 排序：背景图(0) < 标题文字(1) < 装饰矩形(2) < 隐藏圆形(3)
        assert bg_pos < title_pos < rect_pos < circle_pos

    async def test_sort_by_position(self, tool, tool_context, setup_project_with_elements):
        """测试按位置排序"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            sort_by="position"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # Query Settings 已移除，不再检查
        # 元素应该按 (y, x) 排序：背景图(0,0) < 标题文字(100,100) < 装饰矩形(300,500) < 隐藏圆形(400,800)

    async def test_sort_by_type(self, tool, tool_context, setup_project_with_elements):
        """测试按类型排序"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            sort_by="type"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # Query Settings 已移除，不再检查
        # 元素应该按类型排序：ellipse < image < rectangle < text

    async def test_filter_visible_only(self, tool, tool_context, setup_project_with_elements):
        """测试只显示可见元素"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            visible_only=True
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # Query Settings 已移除，不再检查
        # 检查分页信息中的结果数量
        assert "Showing: 3 of 3" in result.content
        # 不应该包含隐藏的圆形
        assert "隐藏圆形" not in result.content

    async def test_filter_by_element_types(self, tool, tool_context, setup_project_with_elements):
        """测试按元素类型过滤"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            element_types=["image", "text"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # Query Settings 已移除，不再检查
        # 检查分页信息中的结果数量
        assert "Showing: 2 of 2" in result.content
        assert "背景图" in result.content
        assert "标题文字" in result.content
        # 不应该包含矩形和圆形
        assert "装饰矩形" not in result.content
        assert "隐藏圆形" not in result.content

    async def test_combined_filters(self, tool, tool_context, setup_project_with_elements):
        """测试组合过滤条件"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            visible_only=True,
            element_types=["image", "text", "rectangle"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查分页信息中的结果数量
        assert "Showing: 3 of 3" in result.content
        # 只应包含可见的 image, text, rectangle
        assert "背景图" in result.content
        assert "标题文字" in result.content
        assert "装饰矩形" in result.content
        # 不应该包含隐藏的圆形
        assert "隐藏圆形" not in result.content

    async def test_spatial_distribution(self, tool, tool_context, setup_project_with_elements):
        """测试空间分布信息"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查空间分布信息
        assert "Spatial Distribution:" in result.content
        assert "Bounds:" in result.content
        assert "Canvas Size:" in result.content
        assert "Center Point:" in result.content

    async def test_viewport_info(self, tool, tool_context, setup_project_with_elements):
        """测试视窗信息"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查视窗信息
        assert "Viewport State:" in result.content
        assert "Scale: 1.50" in result.content
        assert "Offset: (100.0, 200.0)" in result.content

    async def test_element_status_display(self, tool, tool_context, setup_project_with_elements):
        """测试元素状态显示"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查元素状态标记
        assert "locked" in result.content  # 装饰矩形是锁定的
        assert "opacity:0.80" in result.content  # 装饰矩形透明度为 0.8

    async def test_invalid_sort_by(self, tool, tool_context, setup_project_with_elements):
        """测试无效的排序方式"""
        project_path = setup_project_with_elements

        with pytest.raises(ValueError, match="Invalid sort_by"):
            params = QueryCanvasOverviewParams(
                project_path="test-project",
                sort_by="invalid_sort"
            )

    async def test_nonexistent_project(self, tool, tool_context, tmp_path):
        """测试不存在的项目"""
        params = QueryCanvasOverviewParams(
            project_path="nonexistent-project"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "does not exist" in result.content or "不存在" in result.content

    async def test_project_without_magic_project_js(self, tool, tool_context, tmp_path):
        """测试没有 magic.project.js 的项目"""
        # 创建一个空文件夹
        project_path = tmp_path / "no-config-project"
        project_path.mkdir()

        params = QueryCanvasOverviewParams(
            project_path="no-config-project"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "does not exist" in result.content or "不存在" in result.content

    async def test_empty_element_types_filter(self, tool, tool_context, setup_project_with_elements):
        """测试空的元素类型过滤列表"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project",
            element_types=[]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 空列表应该不过滤任何元素（等同于 None）
        assert "Showing: 4 of 4" in result.content

    async def test_element_count_display(self, tool, tool_context, setup_project_with_elements):
        """测试元素数量显示"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查元素列表标题
        assert "Elements:" in result.content
        assert "Pagination:" in result.content

    async def test_z_index_range(self, tool, tool_context, setup_project_with_elements):
        """测试 z-index 范围显示"""
        project_path = setup_project_with_elements

        params = QueryCanvasOverviewParams(
            project_path="test-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查 z-index 范围（0 到 3）
        assert "Z-index Range: 0 ~ 3" in result.content


class TestPagination:
    """测试分页功能"""

    async def test_default_pagination(self, tool, tool_context, setup_large_project):
        """测试默认分页参数（offset=0, limit=50）"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查分页信息
        assert "Pagination:" in result.content
        assert "Showing: 50 of 60" in result.content
        assert "Remaining: 10 elements not shown" in result.content
        # 检查剩余元素概览
        assert "Remaining Elements Overview (10 not shown):" in result.content
        # 检查提示下一页的 offset
        assert "offset=50" in result.content

    async def test_custom_pagination(self, tool, tool_context, setup_large_project):
        """测试自定义分页参数"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=10,
            limit=20
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查分页信息
        assert "Showing: 20 of 60" in result.content
        assert "offset: 10" in result.content
        assert "Remaining: 30 elements not shown" in result.content
        # 检查提示下一页
        assert "offset=30" in result.content

    async def test_last_page(self, tool, tool_context, setup_large_project):
        """测试最后一页（不完整的页）"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=50,
            limit=50
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查分页信息
        assert "Showing: 10 of 60" in result.content
        assert "offset: 50" in result.content
        # 不应该有剩余元素提示
        assert "Remaining:" not in result.content
        assert "offset=" not in result.content

    async def test_offset_beyond_total(self, tool, tool_context, setup_large_project):
        """测试 offset 超过总数"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=100,
            limit=50
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 应该显示 0 个元素
        assert "Showing: 0 of 60" in result.content
        assert "offset: 100" in result.content
        assert "No elements found" in result.content

    async def test_small_limit(self, tool, tool_context, setup_large_project):
        """测试小的 limit 值"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=0,
            limit=5
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查分页信息
        assert "Showing: 5 of 60" in result.content
        assert "Remaining: 55 elements not shown" in result.content

    async def test_limit_validation(self, tool, tool_context, setup_large_project):
        """测试 limit 超过最大值会被限制"""
        project_path = setup_large_project

        # 尝试设置 limit > 50，应该被 Pydantic 验证拒绝
        with pytest.raises(ValueError):
            params = QueryCanvasOverviewParams(
                project_path="large-project",
                offset=0,
                limit=100  # 超过最大值 50
            )

    async def test_offset_validation(self, tool, tool_context, setup_large_project):
        """测试 offset 负数验证"""
        project_path = setup_large_project

        # 尝试设置负数 offset，应该被 Pydantic 验证拒绝
        with pytest.raises(ValueError):
            params = QueryCanvasOverviewParams(
                project_path="large-project",
                offset=-1,
                limit=10
            )

    async def test_remaining_stats_by_type(self, tool, tool_context, setup_large_project):
        """测试剩余元素按类型统计"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=0,
            limit=50
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 检查剩余元素类型统计（10个元素 = 50-59，应该有 image:3, text:3, rectangle:2, ellipse:2）
        assert "Remaining Elements Overview" in result.content
        # 由于元素按模式分配，剩余10个元素（50-59）应该包含所有4种类型
        content = result.content
        remaining_section = content[content.find("Remaining Elements Overview"):]
        assert "ellipse:" in remaining_section
        assert "image:" in remaining_section
        assert "rectangle:" in remaining_section
        assert "text:" in remaining_section

    async def test_pagination_with_filters(self, tool, tool_context, setup_large_project):
        """测试分页与过滤结合使用"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            element_types=["image"],
            offset=0,
            limit=10
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 60个元素中，每4个一个 image，共15个 image
        # 显示前10个 image
        assert "Showing: 10 of 15" in result.content
        assert "Remaining: 5 elements not shown" in result.content

    async def test_pagination_element_numbering(self, tool, tool_context, setup_large_project):
        """测试分页后元素编号正确"""
        project_path = setup_large_project

        params = QueryCanvasOverviewParams(
            project_path="large-project",
            offset=5,
            limit=3
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 元素编号应该从 6 开始（offset 5 + 1）
        assert "6. [" in result.content
        assert "7. [" in result.content
        assert "8. [" in result.content
