"""重叠检测算法测试

测试新增的重叠检测功能是否正确工作
"""

import pytest
from app.tools.design.utils.canvas_layout_utils import (
    check_overlap,
    check_overlap_with_any_element,
    calculate_next_element_position,
    _should_start_new_row_for_height_difference,
    _find_non_overlapping_position
)
from app.tools.design.utils.magic_project_design_parser import (
    MagicProjectConfig,
    CanvasConfig,
    ImageElement,
    RectangleElement,
    _compute_element_hierarchy_and_absolute_coords
)


class TestOverlapDetection:
    """测试重叠检测功能"""

    def test_check_overlap_basic(self):
        """测试基本的矩形重叠检测"""
        # 完全重叠
        assert check_overlap(0, 0, 100, 100, 0, 0, 100, 100) is True

        # 部分重叠
        assert check_overlap(0, 0, 100, 100, 50, 50, 100, 100) is True

        # 不重叠 - 矩形1在矩形2左边
        assert check_overlap(0, 0, 100, 100, 120, 0, 100, 100) is False

        # 不重叠 - 矩形1在矩形2右边
        assert check_overlap(120, 0, 100, 100, 0, 0, 100, 100) is False

        # 不重叠 - 矩形1在矩形2上边
        assert check_overlap(0, 0, 100, 100, 0, 120, 100, 100) is False

        # 不重叠 - 矩形1在矩形2下边
        assert check_overlap(0, 120, 100, 100, 0, 0, 100, 100) is False

        # 边缘相接（不算重叠）
        assert check_overlap(0, 0, 100, 100, 100, 0, 100, 100) is False

    def test_check_overlap_edge_cases(self):
        """测试边界情况"""
        # 一个矩形包含另一个
        assert check_overlap(0, 0, 200, 200, 50, 50, 100, 100) is True

        # 零宽度/高度
        assert check_overlap(0, 0, 0, 0, 0, 0, 100, 100) is False

        # 单点接触
        assert check_overlap(0, 0, 100, 100, 100, 100, 100, 100) is False

    def test_check_overlap_with_any_element_no_overlap(self):
        """测试与元素列表的重叠检测 - 无重叠情况"""
        elem1 = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=100.0,
            height=100.0,
            _absolute_x=0.0,
            _absolute_y=0.0
        )

        elem2 = ImageElement(
            id="elem2",
            type="image",
            name="图片2",
            x=120.0,
            y=0.0,
            width=100.0,
            height=100.0,
            _absolute_x=120.0,
            _absolute_y=0.0
        )

        elements = [elem1, elem2]

        # 测试不重叠的位置
        assert check_overlap_with_any_element(
            240.0, 0.0, 100.0, 100.0, elements
        ) is False

    def test_check_overlap_with_any_element_has_overlap(self):
        """测试与元素列表的重叠检测 - 有重叠情况"""
        elem1 = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=100.0,
            height=100.0,
            _absolute_x=0.0,
            _absolute_y=0.0
        )

        elem2 = ImageElement(
            id="elem2",
            type="image",
            name="图片2",
            x=120.0,
            y=0.0,
            width=100.0,
            height=100.0,
            _absolute_x=120.0,
            _absolute_y=0.0
        )

        elements = [elem1, elem2]

        # 测试与 elem1 重叠
        assert check_overlap_with_any_element(
            50.0, 50.0, 100.0, 100.0, elements
        ) is True

        # 测试与 elem2 重叠
        assert check_overlap_with_any_element(
            150.0, 50.0, 100.0, 100.0, elements
        ) is True

    def test_should_start_new_row_for_height_difference(self):
        """测试高度差异判断"""
        # 创建元素列表
        row = [
            ImageElement(
                id=f"elem{i}",
                type="image",
                name=f"图片{i}",
                x=i * 120.0,
                y=0.0,
                width=100.0,
                height=150.0  # 平均高度 150
            )
            for i in range(3)
        ]

        # 高度相近，不需要换行
        assert _should_start_new_row_for_height_difference(
            row, 160.0, threshold=100.0
        ) is False

        # 高度差异大，需要换行
        assert _should_start_new_row_for_height_difference(
            row, 300.0, threshold=100.0  # 差异 150
        ) is True

        # 高度差异大（比平均值小很多），需要换行
        assert _should_start_new_row_for_height_difference(
            row, 30.0, threshold=100.0  # 差异 120
        ) is True

    def test_find_non_overlapping_position_no_conflict(self):
        """测试查找不重叠位置 - 无冲突"""
        elem = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=100.0,
            height=100.0,
            _absolute_x=0.0,
            _absolute_y=0.0
        )

        elements = [elem]

        # 在右侧查找位置，应该直接返回起始位置
        x, y = _find_non_overlapping_position(
            elements,
            element_width=100.0,
            element_height=100.0,
            start_x=120.0,  # 与 elem 不重叠
            start_y=0.0,
            spacing=20.0
        )

        assert x == 120.0
        assert y == 0.0

    def test_find_non_overlapping_position_with_conflict(self):
        """测试查找不重叠位置 - 有冲突"""
        # 创建一个会导致重叠的布局
        elem1 = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=200.0,
            height=150.0,
            _absolute_x=0.0,
            _absolute_y=0.0
        )

        elem2 = ImageElement(
            id="elem2",
            type="image",
            name="图片2",
            x=220.0,
            y=50.0,  # 偏下50px
            width=200.0,
            height=200.0,
            _absolute_x=220.0,
            _absolute_y=50.0
        )

        elements = [elem1, elem2]

        # 尝试在行顶部放置新元素（会与 elem2 重叠）
        x, y = _find_non_overlapping_position(
            elements,
            element_width=200.0,
            element_height=150.0,
            start_x=220.0,  # 初始位置会与 elem2 重叠
            start_y=0.0,
            spacing=20.0
        )

        # 应该自动调整到 elem2 右侧
        assert x == 440.0  # 220 + 200 + 20
        assert y == 0.0

    def test_calculate_position_avoids_overlap_different_heights(self):
        """测试自动定位避免重叠 - 不同高度元素"""
        # 创建一个特殊布局：第二个元素更高且偏下
        elem1 = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=200.0,
            height=100.0
        )

        elem2 = ImageElement(
            id="elem2",
            type="image",
            name="图片2",
            x=220.0,
            y=50.0,  # 偏下
            width=200.0,
            height=300.0  # 很高
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[elem1, elem2])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算新元素位置（高度与 elem1 相似）
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=100.0,
            spacing=20.0
        )

        # 新元素应该在 elem2 右侧（避免重叠）
        assert x == 440.0  # 220 + 200 + 20
        assert y == 0.0  # 与行顶部对齐

    def test_calculate_position_forces_new_row_on_height_difference(self):
        """测试高度差异大时强制换行"""
        # 创建一行相似高度的元素
        row_elements = [
            ImageElement(
                id=f"elem{i}",
                type="image",
                name=f"图片{i}",
                x=i * 220.0,
                y=0.0,
                width=200.0,
                height=150.0
            )
            for i in range(2)
        ]

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=row_elements)
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 尝试添加一个高度差异很大的元素
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=400.0,  # 高度差异 250px
            spacing=20.0,
            height_diff_threshold=100.0
        )

        # 应该开始新行
        assert x == 0.0
        assert y == 170.0  # 150 + 20

    def test_calculate_position_handles_complex_overlapping_scenario(self):
        """测试复杂重叠场景"""
        # 创建一个复杂布局
        elem1 = RectangleElement(
            id="elem1",
            type="rectangle",
            name="矩形1",
            x=0.0,
            y=0.0,
            width=300.0,
            height=100.0
        )

        elem2 = RectangleElement(
            id="elem2",
            type="rectangle",
            name="矩形2",
            x=320.0,
            y=0.0,
            width=100.0,
            height=150.0
        )

        # 第三个元素在下方但会影响布局
        elem3 = RectangleElement(
            id="elem3",
            type="rectangle",
            name="矩形3",
            x=0.0,
            y=120.0,
            width=200.0,
            height=100.0
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[elem1, elem2, elem3])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算新元素位置
        x, y = calculate_next_element_position(
            config=config,
            element_width=150.0,
            element_height=120.0,
            spacing=20.0
        )

        # 应该正确处理复杂布局，不会重叠
        # 验证不与任何元素重叠
        for elem in [elem1, elem2, elem3]:
            assert not check_overlap(
                x, y, 150.0, 120.0,
                elem.x, elem.y, elem.width, elem.height
            )

    def test_calculate_position_with_max_row_limit(self):
        """测试达到行元素数量限制时换行"""
        # 创建4个元素（达到默认最大值）
        row_elements = [
            ImageElement(
                id=f"elem{i}",
                type="image",
                name=f"图片{i}",
                x=i * 120.0,
                y=0.0,
                width=100.0,
                height=100.0
            )
            for i in range(4)
        ]

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=row_elements)
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 尝试添加第5个元素
        x, y = calculate_next_element_position(
            config=config,
            element_width=100.0,
            element_height=100.0,
            max_elements_per_row=4,
            spacing=20.0
        )

        # 应该开始新行
        assert x == 0.0
        assert y == 120.0  # 100 + 20

    def test_no_overlap_guaranteed(self):
        """验证算法保证不会返回重叠位置"""
        # 创建一个密集布局
        elements = []
        for row in range(3):
            for col in range(4):
                elem = ImageElement(
                    id=f"elem_{row}_{col}",
                    type="image",
                    name=f"图片{row}_{col}",
                    x=col * 220.0,
                    y=row * 170.0,
                    width=200.0,
                    height=150.0
                )
                elements.append(elem)

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=elements)
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 连续添加多个新元素
        for i in range(5):
            x, y = calculate_next_element_position(
                config=config,
                element_width=200.0,
                element_height=150.0,
                spacing=20.0
            )

            # 验证不与任何现有元素重叠
            for elem in config.canvas.elements:
                assert not check_overlap(
                    x, y, 200.0, 150.0,
                    elem.x, elem.y, elem.width, elem.height
                ), f"新元素({x}, {y})与元素{elem.id}({elem.x}, {elem.y})重叠"

            # 模拟添加新元素到配置中（供下次迭代使用）
            new_elem = ImageElement(
                id=f"new_elem_{i}",
                type="image",
                name=f"新图片{i}",
                x=x,
                y=y,
                width=200.0,
                height=150.0
            )
            config.canvas.elements.append(new_elem)
            _compute_element_hierarchy_and_absolute_coords(config)
