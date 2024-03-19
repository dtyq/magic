"""测试调整画布元素图层顺序工具"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock
import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.reorder_canvas_elements import (
    ReorderCanvasElements,
    ReorderCanvasElementsParams,
)

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool(tmp_path):
    """创建 ReorderCanvasElements 工具实例"""
    tool_instance = ReorderCanvasElements()
    # 设置 base_dir 以便工具能够正确解析相对路径
    tool_instance.base_dir = tmp_path
    return tool_instance


@pytest.fixture
def tool_context(tmp_path):
    """创建 mock 的工具上下文"""
    context = MagicMock(spec=ToolContext)

    # Mock agent_context with AsyncMock dispatch_event
    mock_agent_context = MagicMock()
    mock_agent_context.dispatch_event = AsyncMock()
    context.get_extension_typed = Mock(return_value=mock_agent_context)

    return context


@pytest.fixture
def setup_project_with_elements(tmp_path):
    """创建一个包含多个不同图层的元素的测试项目"""
    project_path = tmp_path / "test-project"
    project_path.mkdir(parents=True)

    # 创建包含不同 zIndex 的元素
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
        "id": "element-bottom",
        "name": "Bottom Layer",
        "type": "rectangle",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 100,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#FF0000"
      },
      {
        "id": "element-middle",
        "name": "Middle Layer",
        "type": "ellipse",
        "x": 50,
        "y": 50,
        "width": 100,
        "height": 100,
        "zIndex": 5,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#00FF00"
      },
      {
        "id": "element-top",
        "name": "Top Layer",
        "type": "star",
        "x": 100,
        "y": 100,
        "width": 100,
        "height": 100,
        "zIndex": 10,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#0000FF"
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


class TestReorderCanvasElements:
    """测试 ReorderCanvasElements 工具"""

    async def test_bring_to_front(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试置于顶层操作"""
        project_path = setup_project_with_elements

        # 将 middle 元素置于顶层
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Brought to front" in result.content
        assert "Old z-index: 5" in result.content
        assert "New z-index: 11" in result.content  # max(10) + 1

        # 验证 z-index 已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-middle")
        assert element.zIndex == 11

    async def test_bring_forward(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试上移一层操作"""
        project_path = setup_project_with_elements

        # 将 middle 元素上移一层
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_forward"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Brought forward one layer" in result.content
        assert "Old z-index: 5" in result.content
        assert "New z-index: 6" in result.content

        # 验证 z-index 已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-middle")
        assert element.zIndex == 6

    async def test_send_backward(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试下移一层操作"""
        project_path = setup_project_with_elements

        # 将 middle 元素下移一层
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="send_backward"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Sent backward one layer" in result.content
        assert "Old z-index: 5" in result.content
        assert "New z-index: 4" in result.content

        # 验证 z-index 已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-middle")
        assert element.zIndex == 4

    async def test_send_backward_at_minimum(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试下移一层但已经在底层（z-index 不能小于 0）"""
        project_path = setup_project_with_elements

        # 将 bottom 元素下移一层（已经是 0）
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-bottom",
            action="send_backward"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Old z-index: 0" in result.content
        assert "New z-index: 0" in result.content
        assert "unchanged" in result.content.lower()

        # 验证 z-index 仍为 0
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-bottom")
        assert element.zIndex == 0

    async def test_send_to_back(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试置于底层操作"""
        project_path = setup_project_with_elements

        # 将 top 元素置于底层
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-top",
            action="send_to_back"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Sent to back" in result.content
        assert "Old z-index: 10" in result.content
        assert "New z-index: 0" in result.content

        # 验证 z-index 已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-top")
        assert element.zIndex == 0

    async def test_set_zindex(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试设置指定 z-index"""
        project_path = setup_project_with_elements

        # 将 middle 元素设置为 z-index 20
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="set_zindex",
            z_index=20
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Set z-index to 20" in result.content
        assert "Old z-index: 5" in result.content
        assert "New z-index: 20" in result.content

        # 验证 z-index 已更新
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-middle")
        assert element.zIndex == 20

    async def test_set_zindex_requires_parameter(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试 set_zindex 操作需要 z_index 参数"""
        # 不提供 z_index 参数
        with pytest.raises(ValueError, match="z_index is required when action is 'set_zindex'"):
            ReorderCanvasElementsParams(
                project_path="test-project",
                element_id="element-middle",
                action="set_zindex"
            )

    async def test_reorder_nonexistent_element(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试调整不存在的元素"""
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="nonexistent-element",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not found" in result.content.lower()

    async def test_reorder_from_nonexistent_project(self, tool, tool_context, tmp_path):
        """测试从不存在的项目调整元素"""
        params = ReorderCanvasElementsParams(
            project_path="nonexistent-project",
            element_id="element-middle",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not exist" in result.content.lower() or "not found" in result.content.lower()

    async def test_validate_invalid_action(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试无效的操作类型"""
        with pytest.raises(ValueError, match="Invalid action"):
            ReorderCanvasElementsParams(
                project_path="test-project",
                element_id="element-middle",
                action="invalid_action"
            )

    async def test_validate_empty_element_id(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试空元素 ID"""
        with pytest.raises(ValueError, match="Element ID cannot be empty"):
            ReorderCanvasElementsParams(
                project_path="test-project",
                element_id="",
                action="bring_to_front"
            )

    async def test_validate_negative_z_index(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试负数 z-index"""
        with pytest.raises(ValueError, match="z_index must be non-negative"):
            ReorderCanvasElementsParams(
                project_path="test-project",
                element_id="element-middle",
                action="set_zindex",
                z_index=-1
            )

    async def test_multiple_reorder_operations(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试连续多次调整操作"""
        project_path = setup_project_with_elements

        # 第一次：上移一层
        params1 = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_forward"
        )
        result1 = await tool.execute(tool_context, params1)
        assert result1.ok

        # 第二次：再上移一层
        params2 = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_forward"
        )
        result2 = await tool.execute(tool_context, params2)
        assert result2.ok

        # 验证最终 z-index
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-middle")
        assert element.zIndex == 7  # 5 + 1 + 1

    async def test_reorder_preserves_other_elements(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试调整一个元素不影响其他元素"""
        project_path = setup_project_with_elements

        # 记录其他元素的初始状态
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        bottom_before = await manager.get_element_by_id("element-bottom")
        top_before = await manager.get_element_by_id("element-top")

        # 调整 middle 元素
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 重新加载并验证其他元素未改变
        manager = CanvasManager(str(project_path))
        await manager.load()

        bottom_after = await manager.get_element_by_id("element-bottom")
        top_after = await manager.get_element_by_id("element-top")

        # 其他元素的 z-index 应该保持不变
        assert bottom_after.zIndex == bottom_before.zIndex
        assert top_after.zIndex == top_before.zIndex

    async def test_friendly_action_and_remark_success(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试成功时的友好动作和备注"""
        params = ReorderCanvasElementsParams(
            project_path="test-project",
            element_id="element-middle",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "reorder_canvas_elements",
            tool_context,
            result,
            0.1,
            {"element_id": "element-middle", "action": "bring_to_front"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        assert "element-middle" in action_remark["remark"]

    async def test_friendly_action_and_remark_failure(self, tool, tool_context, tmp_path):
        """测试失败时的友好动作和备注"""
        params = ReorderCanvasElementsParams(
            project_path="nonexistent-project",
            element_id="element-middle",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "reorder_canvas_elements",
            tool_context,
            result,
            0.1,
            {"element_id": "element-middle", "action": "bring_to_front"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        # 失败时应该显示异常信息
        assert "异常" in action_remark["remark"] or "exception" in action_remark["remark"].lower()

    async def test_bring_to_front_single_element(self, tool, tool_context, tmp_path):
        """测试只有一个元素时的置于顶层操作"""
        # 创建只有一个元素的项目
        project_path = tmp_path / "single-element-project"
        project_path.mkdir(parents=True)

        config_content = """window.magicProjectConfig = {
  "name": "Single Element Project",
  "version": "1.0.0",
  "type": "design",
  "canvas": {
    "viewport": {"scale": 1.0, "x": 0, "y": 0},
    "elements": [
      {
        "id": "only-element",
        "name": "Only Element",
        "type": "rectangle",
        "x": 0, "y": 0, "width": 100, "height": 100,
        "zIndex": 0,
        "visible": true, "locked": false, "opacity": 1.0
      }
    ]
  }
};"""

        config_file = project_path / "magic.project.js"
        config_file.write_text(config_content, encoding='utf-8')

        (project_path / "images").mkdir()

        params = ReorderCanvasElementsParams(
            project_path="single-element-project",
            element_id="only-element",
            action="bring_to_front"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "New z-index: 1" in result.content
