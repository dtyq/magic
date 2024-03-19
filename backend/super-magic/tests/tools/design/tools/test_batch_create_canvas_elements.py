"""测试 BatchCreateCanvasElements 工具"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.batch_create_canvas_elements import (
    BatchCreateCanvasElements,
    BatchCreateCanvasElementsParams,
    ElementCreationSpec,
)


@pytest.fixture
def tool(tmp_path):
    """创建 BatchCreateCanvasElements 工具实例"""
    tool_instance = BatchCreateCanvasElements()
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

    return project_path


class TestBatchCreateCanvasElements:
    """测试 BatchCreateCanvasElements 工具类"""

    @pytest.mark.asyncio
    async def test_batch_create_basic_rectangles(self, tool, tool_context, setup_project):
        """测试基础批量创建矩形"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name=f"矩形-{i}",
                    x=100 + i * 120,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733", "stroke": "#000000", "strokeWidth": 2}
                )
                for i in range(5)
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Batch Creation Summary:" in result.content
        assert "Total: 5 elements" in result.content
        assert "Succeeded: 5 elements" in result.content
        assert "Failed: 0 elements" in result.content

        # 验证 extra_info
        assert result.extra_info["total_count"] == 5
        assert result.extra_info["succeeded_count"] == 5
        assert result.extra_info["failed_count"] == 0
        assert len(result.extra_info["created_element_ids"]) == 5

        # 验证文件内容
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "矩形-0" in config_content
        assert "矩形-4" in config_content
        assert "rectangle" in config_content

    @pytest.mark.asyncio
    async def test_grid_layout(self, tool, tool_context, setup_project):
        """测试网格布局"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="ellipse",
                    name=f"圆形-{i}",
                    width=50,
                    height=50,
                    properties={"fill": "#3498db", "stroke": "#2c3e50", "strokeWidth": 1}
                )
                for i in range(9)
            ],
            layout_mode="grid",
            grid_columns=3,
            spacing=20,
            start_x=100,
            start_y=100
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 9 elements" in result.content
        assert "Layout: grid (3 columns, spacing: 20.0px)" in result.content

        # 验证文件内容
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        # 解析 JSON 验证位置
        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        assert match
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        assert len(elements) == 9

        # 验证第一行元素位置
        assert elements[0]["x"] == 100  # 第1个: (100, 100)
        assert elements[0]["y"] == 100
        assert elements[1]["x"] == 170  # 第2个: (170, 100)
        assert elements[1]["y"] == 100
        assert elements[2]["x"] == 240  # 第3个: (240, 100)
        assert elements[2]["y"] == 100

        # 验证第二行元素位置
        assert elements[3]["x"] == 100  # 第4个: (100, 170)
        assert elements[3]["y"] == 170

    @pytest.mark.asyncio
    async def test_horizontal_layout(self, tool, tool_context, setup_project):
        """测试水平布局"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name=f"按钮-{i}",
                    width=80,
                    height=40,
                    properties={"fill": "#2ecc71", "cornerRadius": 5}
                )
                for i in range(5)
            ],
            layout_mode="horizontal",
            spacing=15,
            start_x=50,
            start_y=200
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 5 elements" in result.content
        assert "Layout: horizontal (spacing: 15.0px)" in result.content

        # 验证位置
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 所有元素应该在同一 y 坐标
        for element in elements:
            assert element["y"] == 200

        # x 坐标应该递增
        assert elements[0]["x"] == 50
        assert elements[1]["x"] == 50 + 80 + 15  # 145
        assert elements[2]["x"] == 50 + 2 * (80 + 15)  # 240

    @pytest.mark.asyncio
    async def test_vertical_layout(self, tool, tool_context, setup_project):
        """测试垂直布局"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="text",
                    name=f"标签-{i}",
                    width=200,
                    height=30,
                    properties={"content": [], "defaultStyle": {"fontSize": 16}}
                )
                for i in range(4)
            ],
            layout_mode="vertical",
            spacing=10,
            start_x=100,
            start_y=50
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 4 elements" in result.content
        assert "Layout: vertical (spacing: 10.0px)" in result.content

        # 验证位置
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 所有元素应该在同一 x 坐标
        for element in elements:
            assert element["x"] == 100

        # y 坐标应该递增
        assert elements[0]["y"] == 50
        assert elements[1]["y"] == 50 + 30 + 10  # 90
        assert elements[2]["y"] == 50 + 2 * (30 + 10)  # 130

    @pytest.mark.asyncio
    async def test_partial_failure(self, tool, tool_context, setup_project):
        """测试部分失败场景"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="正常矩形",
                    x=100,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733"}
                ),
                ElementCreationSpec(
                    element_type="image",
                    name="缺少src",
                    x=200,
                    y=100,
                    width=100,
                    height=100,
                    properties={}  # 缺少必需的 src
                ),
                ElementCreationSpec(
                    element_type="rectangle",
                    name="正常矩形2",
                    x=300,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#3498db"}
                ),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果（部分成功也返回 ok=True）
        assert result.ok
        assert "Total: 3 elements" in result.content
        assert "Succeeded: 2 elements" in result.content
        assert "Failed: 1 elements" in result.content
        assert "Failed Creations:" in result.content

        # 验证 extra_info
        assert result.extra_info["succeeded_count"] == 2
        assert result.extra_info["failed_count"] == 1
        assert len(result.extra_info["errors"]) == 1

    @pytest.mark.asyncio
    async def test_max_elements_limit(self, tool, tool_context, setup_project):
        """测试最大元素数量限制"""
        with pytest.raises(Exception):  # Pydantic 验证错误
            params = BatchCreateCanvasElementsParams(
                project_path="test-project",
                elements=[
                    ElementCreationSpec(
                        element_type="rectangle",
                        name=f"矩形-{i}",
                        x=100,
                        y=100,
                        width=50,
                        height=50,
                        properties={"fill": "#000000"}
                    )
                    for i in range(21)  # 超过 20 个限制
                ]
            )

    @pytest.mark.asyncio
    async def test_invalid_element_type(self, tool, tool_context, setup_project):
        """测试无效元素类型"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="invalid_type",
                    name="无效元素",
                    x=100,
                    y=100,
                    width=100,
                    height=100,
                    properties={}
                )
            ]
        )

        result = await tool.execute(tool_context, params)

        # 应该返回成功，但元素创建失败
        assert result.ok
        assert "Failed: 1 elements" in result.content
        assert "Invalid element_type" in result.content

    @pytest.mark.asyncio
    async def test_missing_required_dimensions(self, tool, tool_context, setup_project):
        """测试缺少必需尺寸"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="缺少尺寸",
                    x=100,
                    y=100,
                    # 缺少 width 和 height
                    properties={"fill": "#FF5733"}
                )
            ]
        )

        result = await tool.execute(tool_context, params)

        # 应该返回成功，但元素创建失败
        assert result.ok
        assert "Failed: 1 elements" in result.content
        assert "requires both width and height" in result.content

    @pytest.mark.asyncio
    async def test_missing_position_without_layout(self, tool, tool_context, setup_project):
        """测试没有布局模式时缺少位置"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="缺少位置",
                    # 缺少 x 和 y，且没有 layout_mode
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733"}
                )
            ],
            layout_mode=None  # 或者不指定
        )

        result = await tool.execute(tool_context, params)

        # 应该返回成功，但元素创建失败
        assert result.ok
        assert "Failed: 1 elements" in result.content
        assert "missing position" in result.content

    @pytest.mark.asyncio
    async def test_auto_zindex(self, tool, tool_context, setup_project):
        """测试自动 z-index（批量创建的元素使用相同的 z-index）"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name=f"矩形-{i}",
                    x=100,
                    y=100,
                    width=50,
                    height=50,
                    properties={"fill": "#000000"}
                )
                for i in range(3)
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 3 elements" in result.content

        # 验证 z-index（批量创建的元素应该使用相同的 z-index）
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 所有元素应该使用相同的 z-index（因为是平铺的，不需要叠放）
        assert elements[0]["zIndex"] == 1
        assert elements[1]["zIndex"] == 1
        assert elements[2]["zIndex"] == 1

    @pytest.mark.asyncio
    async def test_mixed_element_types(self, tool, tool_context, setup_project):
        """测试混合元素类型"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="矩形",
                    x=100,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733"}
                ),
                ElementCreationSpec(
                    element_type="ellipse",
                    name="圆形",
                    x=220,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#3498db"}
                ),
                ElementCreationSpec(
                    element_type="text",
                    name="文本",
                    x=340,
                    y=100,
                    width=200,
                    height=50,
                    properties={"content": [], "defaultStyle": {"fontSize": 20}}
                ),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 3 elements" in result.content

        # 验证不同类型都被创建
        config_file = setup_project / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')
        assert "rectangle" in config_content
        assert "ellipse" in config_content
        assert "text" in config_content

    @pytest.mark.asyncio
    async def test_invalid_layout_mode(self, tool, tool_context, setup_project):
        """测试无效布局模式"""
        params = BatchCreateCanvasElementsParams(
            project_path="test-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="矩形",
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733"}
                )
            ],
            layout_mode="invalid_mode"
        )

        result = await tool.execute(tool_context, params)

        # 应该返回错误
        assert not result.ok
        assert "Invalid layout_mode" in result.content

    @pytest.mark.asyncio
    async def test_project_not_exists(self, tool, tool_context, tmp_path):
        """测试项目不存在"""
        params = BatchCreateCanvasElementsParams(
            project_path="non-existent-project",
            elements=[
                ElementCreationSpec(
                    element_type="rectangle",
                    name="矩形",
                    x=100,
                    y=100,
                    width=100,
                    height=100,
                    properties={"fill": "#FF5733"}
                )
            ]
        )

        result = await tool.execute(tool_context, params)

        # 应该返回错误
        assert not result.ok
        assert "does not exist" in result.content
