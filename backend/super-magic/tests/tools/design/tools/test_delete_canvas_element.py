"""测试删除画布元素工具"""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock
import pytest

from agentlang.context.tool_context import ToolContext
from app.tools.design.tools.delete_canvas_element import (
    DeleteCanvasElement,
    DeleteCanvasElementParams,
)

# Mark all tests in this module as async
pytestmark = pytest.mark.asyncio


@pytest.fixture
def tool(tmp_path):
    """创建 DeleteCanvasElement 工具实例"""
    tool_instance = DeleteCanvasElement()
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
    """创建一个包含多个元素的测试项目"""
    project_path = tmp_path / "test-project"
    project_path.mkdir(parents=True)

    # 创建包含多个元素的配置文件
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
        "id": "element-1",
        "name": "Red Rectangle",
        "type": "rectangle",
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 150,
        "zIndex": 0,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#FF0000"
      },
      {
        "id": "element-2",
        "name": "Blue Circle",
        "type": "ellipse",
        "x": 50,
        "y": 50,
        "width": 200,
        "height": 200,
        "zIndex": 1,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#0000FF"
      },
      {
        "id": "element-3",
        "name": "Locked Text",
        "type": "text",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 50,
        "zIndex": 2,
        "visible": true,
        "locked": true,
        "opacity": 1.0,
        "content": []
      },
      {
        "id": "element-4",
        "name": "Green Star",
        "type": "star",
        "x": 300,
        "y": 300,
        "width": 100,
        "height": 100,
        "zIndex": 3,
        "visible": true,
        "locked": false,
        "opacity": 1.0,
        "fill": "#00FF00"
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


class TestDeleteCanvasElement:
    """测试 DeleteCanvasElement 工具"""

    async def test_delete_single_element(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除单个元素"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids="element-1"
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Successfully Deleted: 1" in result.content
        assert "element-1" in result.content
        assert "Red Rectangle" in result.content

        # 验证元素已被删除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element = await manager.get_element_by_id("element-1")
        assert element is None

        # 验证其他元素未受影响
        element2 = await manager.get_element_by_id("element-2")
        assert element2 is not None
        assert element2.name == "Blue Circle"

    async def test_delete_multiple_elements(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试批量删除多个元素"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "element-2", "element-3"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Successfully Deleted: 3" in result.content
        assert "element-1" in result.content
        assert "element-2" in result.content
        assert "element-3" in result.content

        # 验证元素已被删除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        assert await manager.get_element_by_id("element-1") is None
        assert await manager.get_element_by_id("element-2") is None
        assert await manager.get_element_by_id("element-3") is None

        # 验证 element-4 未受影响
        element4 = await manager.get_element_by_id("element-4")
        assert element4 is not None
        assert element4.name == "Green Star"

    async def test_delete_nonexistent_element(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除不存在的元素"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids="nonexistent-element"
        )

        result = await tool.execute(tool_context, params)

        # 应该成功但删除数量为0
        assert result.ok
        assert "Successfully Deleted: 0" in result.content
        assert "Not Found: 1" in result.content
        assert "nonexistent-element" in result.content

    async def test_delete_mixed_existing_and_nonexistent(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试混合删除存在和不存在的元素"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "nonexistent-1", "element-2", "nonexistent-2"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Successfully Deleted: 2" in result.content
        assert "Not Found: 2" in result.content
        assert "element-1" in result.content
        assert "element-2" in result.content
        assert "nonexistent-1" in result.content
        assert "nonexistent-2" in result.content

        # 验证存在的元素已被删除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        assert await manager.get_element_by_id("element-1") is None
        assert await manager.get_element_by_id("element-2") is None

    async def test_delete_locked_element(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试可以删除锁定的元素（工具层不阻止）"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids="element-3"
        )

        result = await tool.execute(tool_context, params)

        # 应该成功删除
        assert result.ok
        assert "Successfully Deleted: 1" in result.content
        assert "element-3" in result.content

        # 验证已被删除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        assert await manager.get_element_by_id("element-3") is None

    async def test_delete_all_elements(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除所有元素"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "element-2", "element-3", "element-4"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        assert "Successfully Deleted: 4" in result.content

        # 验证画布为空
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        stats = await manager.get_statistics()
        assert stats.total_elements == 0

    async def test_delete_with_duplicate_ids(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除重复 ID（自动去重）"""
        project_path = setup_project_with_elements

        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "element-1", "element-2", "element-1"]
        )

        result = await tool.execute(tool_context, params)

        # 应该只删除一次
        assert result.ok
        assert "Successfully Deleted: 2" in result.content
        assert "Total Requested: 2" in result.content  # 去重后

        # 验证元素已被删除
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        assert await manager.get_element_by_id("element-1") is None
        assert await manager.get_element_by_id("element-2") is None

    async def test_delete_from_nonexistent_project(self, tool, tool_context, tmp_path):
        """测试从不存在的项目删除元素"""
        params = DeleteCanvasElementParams(
            project_path="nonexistent-project",
            element_ids="element-1"
        )

        result = await tool.execute(tool_context, params)

        assert not result.ok
        assert "not exist" in result.content.lower() or "not found" in result.content.lower()

    async def test_delete_preserves_other_elements_order(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除元素不影响其他元素的顺序和属性"""
        project_path = setup_project_with_elements

        # 记录删除前的状态
        from app.tools.design.manager.canvas_manager import CanvasManager
        manager = CanvasManager(str(project_path))
        await manager.load()

        element2_before = await manager.get_element_by_id("element-2")
        element4_before = await manager.get_element_by_id("element-4")

        # 删除 element-1 和 element-3
        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "element-3"]
        )

        result = await tool.execute(tool_context, params)
        assert result.ok

        # 重新加载并验证
        manager = CanvasManager(str(project_path))
        await manager.load()

        element2_after = await manager.get_element_by_id("element-2")
        element4_after = await manager.get_element_by_id("element-4")

        # 验证其他元素的属性未改变
        assert element2_after.x == element2_before.x
        assert element2_after.y == element2_before.y
        assert element2_after.zIndex == element2_before.zIndex
        assert element2_after.fill == element2_before.fill

        assert element4_after.x == element4_before.x
        assert element4_after.y == element4_before.y
        assert element4_after.zIndex == element4_before.zIndex
        assert element4_after.fill == element4_before.fill

    async def test_validate_empty_element_id(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试空元素 ID 验证"""
        # 测试空字符串
        with pytest.raises(ValueError, match="Element ID cannot be empty"):
            DeleteCanvasElementParams(
                project_path="test-project",
                element_ids=""
            )

        # 测试空列表
        with pytest.raises(ValueError, match="Element IDs list cannot be empty"):
            DeleteCanvasElementParams(
                project_path="test-project",
                element_ids=[]
            )

        # 测试包含空字符串的列表
        with pytest.raises(ValueError, match="All element IDs must be non-empty strings"):
            DeleteCanvasElementParams(
                project_path="test-project",
                element_ids=["element-1", "", "element-2"]
            )

    async def test_friendly_action_and_remark_success(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试成功时的友好动作和备注"""
        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids="element-1"
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "delete_canvas_element",
            tool_context,
            result,
            0.1,
            {"element_ids": "element-1"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        assert "删除" in action_remark["remark"] or "delete" in action_remark["remark"].lower()

    async def test_friendly_action_and_remark_failure(self, tool, tool_context, tmp_path):
        """测试失败时的友好动作和备注"""
        params = DeleteCanvasElementParams(
            project_path="nonexistent-project",
            element_ids="element-1"
        )

        result = await tool.execute(tool_context, params)

        action_remark = await tool.get_after_tool_call_friendly_action_and_remark(
            "delete_canvas_element",
            tool_context,
            result,
            0.1,
            {"element_ids": "element-1"}
        )

        assert "action" in action_remark
        assert "remark" in action_remark
        # 失败时应该显示异常信息
        assert "异常" in action_remark["remark"] or "exception" in action_remark["remark"].lower()

    async def test_idempotent_deletion(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除操作的幂等性"""
        project_path = setup_project_with_elements

        # 第一次删除
        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids="element-1"
        )

        result1 = await tool.execute(tool_context, params)
        assert result1.ok
        assert "Successfully Deleted: 1" in result1.content

        # 第二次删除相同元素（应该不报错）
        result2 = await tool.execute(tool_context, params)
        assert result2.ok
        assert "Successfully Deleted: 0" in result2.content
        assert "Not Found: 1" in result2.content

    async def test_delete_shows_element_details(self, tool, tool_context, setup_project_with_elements, tmp_path):
        """测试删除结果显示元素详情"""
        params = DeleteCanvasElementParams(
            project_path="test-project",
            element_ids=["element-1", "element-2"]
        )

        result = await tool.execute(tool_context, params)

        assert result.ok
        # 应该显示元素类型和名称
        assert "rectangle" in result.content
        assert "Red Rectangle" in result.content
        assert "ellipse" in result.content
        assert "Blue Circle" in result.content
