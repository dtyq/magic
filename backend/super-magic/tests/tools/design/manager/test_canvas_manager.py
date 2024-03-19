"""
Canvas Manager 单元测试
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.tools.design.manager import (
    CanvasManager,
    ElementQuery,
    CanvasStatistics
)
from app.tools.design.utils.magic_project_design_parser import (
    MagicProjectConfig,
    CanvasConfig,
    ViewportState,
    ImageElement,
    TextElement,
    RectangleElement,
    VisualUnderstanding
)

# 标记所有测试为异步
pytestmark = pytest.mark.asyncio


class TestCanvasManager:
    """CanvasManager 测试类"""

    @pytest.fixture
    def sample_config(self):
        """创建示例配置"""
        return MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试画布",
            canvas=CanvasConfig(
                viewport=ViewportState(scale=1.0, x=0, y=0),
                elements=[
                    ImageElement(
                        id="img-001",
                        name="测试图片",
                        type="image",
                        x=100,
                        y=200,
                        width=500,
                        height=400,
                        zIndex=1,
                        visible=True,
                        locked=False,
                        src="/images/test.png",
                        visualUnderstanding=VisualUnderstanding(summary="这是一个测试图片")
                    ),
                    TextElement(
                        id="text-001",
                        name="标题文本",
                        type="text",
                        x=200,
                        y=100,
                        width=300,
                        height=50,
                        zIndex=2,
                        visible=True,
                        locked=False,
                        content=[{  # type: ignore[arg-type]
                            "children": [{"type": "text", "text": "Hello World"}],
                            "style": {"textAlign": "left", "lineHeight": 1.5}
                        }]
                    ),
                    RectangleElement(
                        id="rect-001",
                        name="背景矩形",
                        type="rectangle",
                        x=0,
                        y=0,
                        width=1920,
                        height=1080,
                        zIndex=0,
                        visible=True,
                        locked=True,
                        fill="#FFFFFF"
                    )
                ]
            )
        )

    @pytest.fixture
    def empty_config(self):
        """创建空画布配置"""
        return MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="空画布",
            canvas=None
        )

    # ==================== 基本加载和保存测试 ====================

    async def test_load_and_save(self, sample_config):
        """测试加载和保存配置"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            with patch("app.tools.design.manager.canvas_manager.write_magic_project_js", new=AsyncMock()) as mock_write:
                manager = CanvasManager("test-project")
                await manager.load()

                assert manager._config_cache is not None
                assert manager._config_cache.name == "测试画布"

                await manager.save()
                mock_write.assert_called_once()

    async def test_context_manager(self, sample_config):
        """测试上下文管理器"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            with patch("app.tools.design.manager.canvas_manager.write_magic_project_js", new=AsyncMock()) as mock_write:
                async with CanvasManager("test-project") as manager:
                    assert manager._config_cache is not None

                # 退出时应该自动保存
                mock_write.assert_called_once()

    async def test_reload(self, sample_config):
        """测试重新加载"""
        call_count = 0

        async def mock_read(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return sample_config

        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=mock_read):
            manager = CanvasManager("test-project")
            await manager.load()
            assert call_count == 1

            await manager.reload()
            assert call_count == 2

    async def test_ensure_loaded_error(self):
        """测试未加载时的错误"""
        manager = CanvasManager("test-project")

        with pytest.raises(ValueError, match="Config not loaded"):
            manager._ensure_loaded()

    # ==================== 元素查询测试 ====================

    async def test_query_by_id(self, sample_config):
        """测试按 ID 查询"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            element = await manager.get_element_by_id("img-001")
            assert element is not None
            assert element.name == "测试图片"
            assert element.type == "image"

            not_found = await manager.get_element_by_id("not-exist")
            assert not_found is None

    async def test_query_by_type(self, sample_config):
        """测试按类型查询"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            images = await manager.get_elements_by_type("image")
            assert len(images) == 1
            assert images[0].id == "img-001"

            texts = await manager.get_elements_by_type("text")
            assert len(texts) == 1
            assert texts[0].id == "text-001"

    async def test_search_by_name(self, sample_config):
        """测试按名称搜索"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            results = await manager.search_elements_by_name("测试")
            assert len(results) == 1
            assert results[0].id == "img-001"

            results = await manager.search_elements_by_name("文本")
            assert len(results) == 1
            assert results[0].id == "text-001"

    async def test_query_with_filters(self, sample_config):
        """测试组合查询条件"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            # 查询可见且未锁定的元素
            query = ElementQuery(visible_only=True, unlocked_only=True)
            results = await manager.query_elements(query)
            assert len(results) == 2  # 图片和文本，矩形被锁定了

            # 查询图层范围
            query = ElementQuery(min_z_index=1, max_z_index=2)
            results = await manager.query_elements(query)
            assert len(results) == 2  # 图片(zIndex=1)和文本(zIndex=2)

    async def test_query_in_region(self, sample_config):
        """测试区域查询"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            # 查询左上角区域 (0, 0, 500, 500)
            query = ElementQuery(in_region=(0, 0, 500, 500))
            results = await manager.query_elements(query)

            # 应该包含文本 (200, 100) 和图片 (100, 200)
            assert len(results) >= 2

    async def test_query_empty_canvas(self, empty_config):
        """测试空画布查询"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=empty_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            query = ElementQuery(element_type="image")
            results = await manager.query_elements(query)
            assert len(results) == 0

    # ==================== 格式转换测试 ====================

    async def test_canvas_overview_brief(self, sample_config):
        """测试简要画布概览"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            overview = await manager.get_canvas_overview(detail_level="brief")

            assert "测试画布" in overview
            assert "Total Elements: 3" in overview
            assert "image: 1" in overview
            assert "text: 1" in overview
            assert "rectangle: 1" in overview

    async def test_canvas_overview_detailed(self, sample_config):
        """测试详细画布概览"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            overview = await manager.get_canvas_overview(detail_level="detailed")

            assert "Canvas Bounds" in overview
            assert "X Range" in overview
            assert "Y Range" in overview

    async def test_describe_element(self, sample_config):
        """测试元素描述"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            element = await manager.get_element_by_id("img-001")
            description = await manager.describe_element(element, detail_level="detailed")

            assert "测试图片" in description
            assert "img-001" in description
            assert "Position" in description
            assert "Size" in description
            assert "Image Description" in description

    async def test_describe_elements_with_sort(self, sample_config):
        """测试多元素描述和排序"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            elements = sample_config.canvas.elements

            # 按 z-index 排序
            description = await manager.describe_elements(elements, sort_by="z_index")
            assert "Found 3 element(s)" in description

            # 按位置排序
            description = await manager.describe_elements(elements, sort_by="position")
            assert "Found 3 element(s)" in description

    # ==================== 统计信息测试 ====================

    async def test_get_statistics(self, sample_config):
        """测试获取统计信息"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            stats = await manager.get_statistics()

            assert stats.total_elements == 3
            assert stats.visible_elements == 3
            assert stats.locked_elements == 1
            assert stats.elements_by_type["image"] == 1
            assert stats.elements_by_type["text"] == 1
            assert stats.elements_by_type["rectangle"] == 1
            assert stats.z_index_range == (0, 2)
            assert stats.canvas_bounds is not None

    async def test_is_empty(self, sample_config, empty_config):
        """测试空画布检测"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()
            assert await manager.is_empty() is False

        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=empty_config)):
            manager = CanvasManager("empty-project")
            await manager.load()
            assert await manager.is_empty() is True

    # ==================== 元素操作测试 ====================

    async def test_add_element(self, sample_config):
        """测试添加元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            new_element = ImageElement(
                id="",  # 空 ID，应该自动生成
                name="新图片",
                type="image",
                x=0,
                y=0,
                width=100,
                height=100
            )

            element_id = await manager.add_element(new_element)

            assert element_id.startswith("element-")
            assert len(manager._config_cache.canvas.elements) == 4

    async def test_add_element_to_empty_canvas(self, empty_config):
        """测试向空画布添加元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=empty_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            new_element = RectangleElement(
                id="rect-new",
                name="新矩形",
                type="rectangle",
                x=0,
                y=0,
                width=100,
                height=100
            )

            element_id = await manager.add_element(new_element)

            assert element_id == "rect-new"
            assert manager._config_cache.canvas is not None
            assert len(manager._config_cache.canvas.elements) == 1

    async def test_update_element(self, sample_config):
        """测试更新元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.update_element("img-001", {
                "x": 300,
                "y": 400,
                "width": 600
            })

            assert success is True

            element = await manager.get_element_by_id("img-001")
            assert element.x == 300
            assert element.y == 400
            assert element.width == 600

    async def test_update_nonexistent_element(self, sample_config):
        """测试更新不存在的元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.update_element("not-exist", {"x": 100})
            assert success is False

    async def test_delete_element(self, sample_config):
        """测试删除元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.delete_element("img-001")

            assert success is True
            assert len(manager._config_cache.canvas.elements) == 2

            element = await manager.get_element_by_id("img-001")
            assert element is None

    async def test_delete_elements_batch(self, sample_config):
        """测试批量删除"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            deleted_count = await manager.delete_elements(["img-001", "text-001"])

            assert deleted_count == 2
            assert len(manager._config_cache.canvas.elements) == 1

    async def test_move_element(self, sample_config):
        """测试移动元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            original_element = await manager.get_element_by_id("img-001")
            original_x = original_element.x
            original_y = original_element.y

            success = await manager.move_element("img-001", delta_x=50, delta_y=-30)

            assert success is True

            moved_element = await manager.get_element_by_id("img-001")
            assert moved_element.x == original_x + 50
            assert moved_element.y == original_y - 30

    async def test_resize_element(self, sample_config):
        """测试调整元素尺寸"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.resize_element("img-001", new_width=800, new_height=600)

            assert success is True

            element = await manager.get_element_by_id("img-001")
            assert element.width == 800
            assert element.height == 600

    async def test_change_z_index(self, sample_config):
        """测试修改图层层级"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.change_z_index("img-001", 10)

            assert success is True

            element = await manager.get_element_by_id("img-001")
            assert element.zIndex == 10

    async def test_set_visibility(self, sample_config):
        """测试设置可见性"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.set_visibility("img-001", False)

            assert success is True

            element = await manager.get_element_by_id("img-001")
            assert element.visible is False

    async def test_set_lock(self, sample_config):
        """测试设置锁定状态"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            success = await manager.set_lock("img-001", True)

            assert success is True

            element = await manager.get_element_by_id("img-001")
            assert element.locked is True

    # ==================== 辅助功能测试 ====================

    async def test_generate_element_id(self):
        """测试生成元素 ID"""
        manager = CanvasManager("test-project")

        id1 = manager.generate_element_id()
        id2 = manager.generate_element_id()

        assert id1.startswith("element-")
        assert id2.startswith("element-")
        assert id1 != id2  # 应该是唯一的

    async def test_element_exists(self, sample_config):
        """测试检查元素是否存在"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            assert await manager.element_exists("img-001") is True
            assert await manager.element_exists("not-exist") is False

    async def test_check_name_conflict(self, sample_config):
        """测试名称冲突检查"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            conflicts = await manager.check_name_conflict("测试图片")
            assert len(conflicts) == 1
            assert conflicts[0].id == "img-001"

            no_conflicts = await manager.check_name_conflict("不存在的名称")
            assert len(no_conflicts) == 0

    async def test_find_overlapping_elements(self, sample_config):
        """测试查找重叠元素"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            # 背景矩形 (0, 0, 1920, 1080) 应该与所有元素重叠
            rect_element = await manager.get_element_by_id("rect-001")
            overlapping = await manager.find_overlapping_elements(rect_element)

            assert len(overlapping) == 2  # 图片和文本

    async def test_get_next_z_index(self, sample_config):
        """测试获取下一个可用 z-index"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=sample_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            next_z = await manager.get_next_z_index()

            # 当前最大 z-index 是 2，所以下一个应该是 3
            assert next_z == 3

    async def test_get_next_z_index_empty_canvas(self, empty_config):
        """测试空画布的下一个 z-index"""
        with patch("app.tools.design.manager.canvas_manager.read_magic_project_js", new=AsyncMock(return_value=empty_config)):
            manager = CanvasManager("test-project")
            await manager.load()

            next_z = await manager.get_next_z_index()
            assert next_z == 0


class TestElementQuery:
    """ElementQuery 测试类"""

    def test_create_query_with_defaults(self):
        """测试创建默认查询"""
        query = ElementQuery()

        assert query.element_id is None
        assert query.element_type is None
        assert query.visible_only is False
        assert query.unlocked_only is False

    def test_create_query_with_params(self):
        """测试创建带参数的查询"""
        query = ElementQuery(
            element_id="test-id",
            element_type="image",
            name_pattern="test",
            visible_only=True,
            unlocked_only=True,
            min_z_index=1,
            max_z_index=5,
            in_region=(0, 0, 100, 100)
        )

        assert query.element_id == "test-id"
        assert query.element_type == "image"
        assert query.name_pattern == "test"
        assert query.visible_only is True
        assert query.unlocked_only is True
        assert query.min_z_index == 1
        assert query.max_z_index == 5
        assert query.in_region == (0, 0, 100, 100)


class TestCanvasStatistics:
    """CanvasStatistics 测试类"""

    def test_create_statistics(self):
        """测试创建统计对象"""
        stats = CanvasStatistics()

        assert stats.total_elements == 0
        assert stats.elements_by_type == {}
        assert stats.visible_elements == 0
        assert stats.locked_elements == 0
        assert stats.z_index_range == (0, 0)
        assert stats.canvas_bounds is None
