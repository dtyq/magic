"""测试 BatchUpdateCanvasElements 工具"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.batch_update_canvas_elements import (
    BatchUpdateCanvasElements,
    BatchUpdateCanvasElementsParams,
    ElementUpdate,
)


@pytest.fixture
def tool(tmp_path):
    """创建 BatchUpdateCanvasElements 工具实例"""
    tool_instance = BatchUpdateCanvasElements()
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
def setup_project_with_elements(tmp_path):
    """创建一个测试项目，包含一些元素"""
    project_path = tmp_path / "test-project"
    project_path.mkdir()

    # 创建 magic.project.js，包含一些测试元素
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
    "elements": [
      {
        "id": "element-001",
        "type": "rectangle",
        "name": "矩形-1",
        "x": 100,
        "y": 100,
        "width": 100,
        "height": 100,
        "zIndex": 1,
        "visible": true,
        "opacity": 1.0,
        "rotation": 0,
        "locked": false,
        "draggable": true,
        "fill": "#FF5733"
      },
      {
        "id": "element-002",
        "type": "ellipse",
        "name": "圆形-1",
        "x": 250,
        "y": 100,
        "width": 80,
        "height": 80,
        "zIndex": 2,
        "visible": true,
        "opacity": 1.0,
        "rotation": 0,
        "locked": false,
        "draggable": true,
        "fill": "#3498db"
      },
      {
        "id": "element-003",
        "type": "text",
        "name": "文本-1",
        "x": 400,
        "y": 100,
        "width": 200,
        "height": 50,
        "zIndex": 3,
        "visible": true,
        "opacity": 1.0,
        "rotation": 0,
        "locked": false,
        "draggable": true,
        "content": [],
        "defaultStyle": {
          "fontSize": 16
        }
      }
    ]
  }
};"""
    config_file = project_path / "magic.project.js"
    config_file.write_text(config_content, encoding='utf-8')

    return project_path


class TestBatchUpdateCanvasElements:
    """测试 BatchUpdateCanvasElements 工具类"""

    @pytest.mark.asyncio
    async def test_batch_update_positions(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新元素位置"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", x=200, y=200),
                ElementUpdate(element_id="element-002", x=350, y=200),
                ElementUpdate(element_id="element-003", x=500, y=200),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 3 elements" in result.content
        assert "Failed: 0 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        assert match
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证位置已更新
        assert elements[0]["x"] == 200
        assert elements[0]["y"] == 200
        assert elements[1]["x"] == 350
        assert elements[1]["y"] == 200
        assert elements[2]["x"] == 500
        assert elements[2]["y"] == 200

    @pytest.mark.asyncio
    async def test_batch_update_sizes(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新元素尺寸"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", width=150, height=150),
                ElementUpdate(element_id="element-002", width=120, height=120),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 2 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证尺寸已更新
        assert elements[0]["width"] == 150
        assert elements[0]["height"] == 150
        assert elements[1]["width"] == 120
        assert elements[1]["height"] == 120

    @pytest.mark.asyncio
    async def test_batch_update_visibility(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新元素可见性"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", visible=False),
                ElementUpdate(element_id="element-002", visible=False),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 2 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证可见性已更新
        assert elements[0]["visible"] is False
        assert elements[1]["visible"] is False
        assert elements[2]["visible"] is True  # 未修改的元素保持原状

    @pytest.mark.asyncio
    async def test_batch_update_opacity(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新元素透明度"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", opacity=0.5),
                ElementUpdate(element_id="element-002", opacity=0.8),
                ElementUpdate(element_id="element-003", opacity=0.3),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 3 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证透明度已更新
        assert elements[0]["opacity"] == 0.5
        assert elements[1]["opacity"] == 0.8
        assert elements[2]["opacity"] == 0.3

    @pytest.mark.asyncio
    async def test_batch_update_zindex(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新元素图层层级"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", zIndex=10),
                ElementUpdate(element_id="element-002", zIndex=20),
                ElementUpdate(element_id="element-003", zIndex=30),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 3 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证 z-index 已更新
        assert elements[0]["zIndex"] == 10
        assert elements[1]["zIndex"] == 20
        assert elements[2]["zIndex"] == 30

    @pytest.mark.asyncio
    async def test_batch_update_mixed_properties(self, tool, tool_context, setup_project_with_elements):
        """测试批量更新混合属性"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(
                    element_id="element-001",
                    x=300,
                    y=300,
                    width=150,
                    height=150,
                    opacity=0.7,
                    zIndex=5
                ),
                ElementUpdate(
                    element_id="element-002",
                    visible=False,
                    locked=True
                ),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 2 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证 element-001 的多个属性
        assert elements[0]["x"] == 300
        assert elements[0]["y"] == 300
        assert elements[0]["width"] == 150
        assert elements[0]["height"] == 150
        assert elements[0]["opacity"] == 0.7
        assert elements[0]["zIndex"] == 5

        # 验证 element-002 的属性
        assert elements[1]["visible"] is False
        assert elements[1]["locked"] is True

    @pytest.mark.asyncio
    async def test_partial_failure(self, tool, tool_context, setup_project_with_elements):
        """测试部分失败场景"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", x=200),
                ElementUpdate(element_id="element-999", x=300),  # 不存在的元素
                ElementUpdate(element_id="element-002", y=200),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果（部分成功策略）
        assert result.ok
        assert "Succeeded: 2 elements" in result.content
        assert "Failed: 1 elements" in result.content
        assert "element-999" in result.content
        assert "Element not found" in result.content

        # 验证 extra_info
        assert result.extra_info["succeeded_count"] == 2
        assert result.extra_info["failed_count"] == 1
        assert len(result.extra_info["errors"]) == 1
        assert result.extra_info["errors"][0]["element_id"] == "element-999"

    @pytest.mark.asyncio
    async def test_element_not_found(self, tool, tool_context, setup_project_with_elements):
        """测试元素不存在的情况"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="non-existent", x=100, y=100),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果（部分成功策略）
        assert result.ok
        assert "Succeeded: 0 elements" in result.content
        assert "Failed: 1 elements" in result.content
        assert "Element not found" in result.content

    @pytest.mark.asyncio
    async def test_max_elements_limit(self, tool, tool_context, setup_project_with_elements):
        """测试最大元素数量限制"""
        with pytest.raises(Exception):  # Pydantic 验证错误
            params = BatchUpdateCanvasElementsParams(
                project_path="test-project",
                updates=[
                    ElementUpdate(element_id=f"element-{i:03d}", x=100)
                    for i in range(21)  # 超过最大限制 20
                ]
            )

    @pytest.mark.asyncio
    async def test_no_updates_provided(self, tool, tool_context, setup_project_with_elements):
        """测试未提供任何更新属性的情况"""
        with pytest.raises(Exception):  # Pydantic 验证错误
            params = BatchUpdateCanvasElementsParams(
                project_path="test-project",
                updates=[
                    ElementUpdate(element_id="element-001")  # 没有提供任何更新属性
                ]
            )

    @pytest.mark.asyncio
    async def test_invalid_opacity_value(self, tool, tool_context, setup_project_with_elements):
        """测试无效的透明度值"""
        with pytest.raises(Exception):  # Pydantic 验证错误
            params = BatchUpdateCanvasElementsParams(
                project_path="test-project",
                updates=[
                    ElementUpdate(element_id="element-001", opacity=1.5)  # 超出范围
                ]
            )

    @pytest.mark.asyncio
    async def test_invalid_width_value(self, tool, tool_context, setup_project_with_elements):
        """测试无效的宽度值"""
        with pytest.raises(Exception):  # Pydantic 验证错误
            params = BatchUpdateCanvasElementsParams(
                project_path="test-project",
                updates=[
                    ElementUpdate(element_id="element-001", width=-10)  # 负数
                ]
            )

    @pytest.mark.asyncio
    async def test_project_not_exists(self, tool, tool_context, tmp_path):
        """测试项目不存在的情况"""
        params = BatchUpdateCanvasElementsParams(
            project_path="non-existent-project",
            updates=[
                ElementUpdate(element_id="element-001", x=100, y=100)
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert not result.ok
        assert "does not exist" in result.content.lower()

    @pytest.mark.asyncio
    async def test_rotation_update(self, tool, tool_context, setup_project_with_elements):
        """测试旋转角度更新"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", rotation=45),
                ElementUpdate(element_id="element-002", rotation=90),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 2 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证旋转角度已更新
        assert elements[0]["rotation"] == 45
        assert elements[1]["rotation"] == 90

    @pytest.mark.asyncio
    async def test_draggable_locked_update(self, tool, tool_context, setup_project_with_elements):
        """测试 draggable 和 locked 属性更新"""
        params = BatchUpdateCanvasElementsParams(
            project_path="test-project",
            updates=[
                ElementUpdate(element_id="element-001", locked=True, draggable=False),
                ElementUpdate(element_id="element-002", locked=False, draggable=True),
            ]
        )

        result = await tool.execute(tool_context, params)

        # 验证结果
        assert result.ok
        assert "Succeeded: 2 elements" in result.content

        # 验证文件内容
        config_file = setup_project_with_elements / "magic.project.js"
        config_content = config_file.read_text(encoding='utf-8')

        import re
        match = re.search(r'window\.magicProjectConfig\s*=\s*({.*});', config_content, re.DOTALL)
        config_data = json.loads(match.group(1))
        elements = config_data["canvas"]["elements"]

        # 验证属性已更新
        assert elements[0]["locked"] is True
        assert elements[0]["draggable"] is False
        assert elements[1]["locked"] is False
        assert elements[1]["draggable"] is True
