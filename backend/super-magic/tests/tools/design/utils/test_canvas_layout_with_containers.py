"""
画布布局计算测试（包含容器）

测试自动位置计算是否正确考虑容器内的子元素
"""

import pytest
from app.tools.design.utils.magic_project_design_parser import (
    MagicProjectConfig,
    CanvasConfig,
    ImageElement,
    RectangleElement,
    FrameElement,
    GroupElement,
    _compute_element_hierarchy_and_absolute_coords
)
from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position


class TestCanvasLayoutWithContainers:
    """测试包含容器的画布布局计算"""

    def test_empty_canvas_position(self):
        """测试空画布的起始位置"""
        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="空项目",
            canvas=CanvasConfig(elements=[])
        )

        x, y = calculate_next_element_position(
            config=config,
            element_width=100.0,
            element_height=100.0
        )

        assert x == 0.0
        assert y == 0.0

    def test_position_after_top_level_elements(self):
        """测试顶层元素后的位置计算"""
        elem1 = ImageElement(
            id="elem1",
            type="image",
            name="图片1",
            x=0.0,
            y=0.0,
            width=200.0,
            height=150.0
        )

        elem2 = ImageElement(
            id="elem2",
            type="image",
            name="图片2",
            x=220.0,  # 0 + 200 + 20(spacing)
            y=0.0,
            width=200.0,
            height=150.0
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[elem1, elem2])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算下一个位置
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=150.0,
            spacing=20.0
        )

        # 应该在第一行的右侧
        assert x == 440.0  # 220 + 200 + 20
        assert y == 0.0

    def test_position_avoids_child_elements_in_frame(self):
        """测试位置计算避开 Frame 内的子元素"""
        # Frame 内有一个子元素
        child = ImageElement(
            id="child1",
            type="image",
            name="Frame内的图片",
            x=50.0,  # 相对于 Frame
            y=30.0,
            width=100.0,
            height=100.0
        )

        frame = FrameElement(
            id="frame1",
            type="frame",
            name="画框",
            x=100.0,  # Frame 在画布上的位置
            y=100.0,
            width=300.0,
            height=200.0,
            children=[child]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证子元素的绝对坐标
        assert child.absolute_x == 150.0  # 100 + 50
        assert child.absolute_y == 130.0  # 100 + 30

        # 计算下一个位置（应该考虑 Frame 和子元素）
        x, y = calculate_next_element_position(
            config=config,
            element_width=100.0,
            element_height=100.0,
            spacing=20.0
        )

        # 新算法会检测重叠并自动调整位置
        # Frame 绝对位置: (100, 100), 宽度 300 → 右边界 400
        # 新元素应该在 Frame 右侧以避免重叠
        assert x == 420.0  # 100 + 300 + 20
        assert y == 100.0  # 与 Frame 顶部对齐（因为 Frame 和 child 在同一行）

    def test_position_with_nested_containers(self):
        """测试嵌套容器的位置计算"""
        # 创建嵌套结构
        inner_elem = RectangleElement(
            id="inner1",
            type="rectangle",
            name="内层矩形",
            x=10.0,
            y=10.0,
            width=50.0,
            height=50.0
        )

        group = GroupElement(
            id="group1",
            type="group",
            name="组",
            x=50.0,
            y=50.0,
            width=200.0,
            height=150.0,
            children=[inner_elem]
        )

        frame = FrameElement(
            id="frame1",
            type="frame",
            name="画框",
            x=0.0,
            y=0.0,
            width=400.0,
            height=300.0,
            children=[group]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证嵌套元素的绝对坐标
        assert inner_elem.absolute_x == 60.0  # 0 + 50 + 10
        assert inner_elem.absolute_y == 60.0  # 0 + 50 + 10

        # 计算下一个位置
        x, y = calculate_next_element_position(
            config=config,
            element_width=100.0,
            element_height=100.0,
            spacing=20.0
        )

        # 新算法检测到与 frame 重叠，会换行
        # frame 绝对位置: (0, 0), 高度 300 → 底边界 300
        assert x == 0.0  # 新行开始
        assert y == 320.0  # 0 + 300 + 20

    def test_position_with_mixed_elements(self):
        """测试混合顶层元素和容器的位置计算"""
        # 顶层元素
        top_elem = ImageElement(
            id="top1",
            type="image",
            name="顶层图片",
            x=0.0,
            y=0.0,
            width=200.0,
            height=150.0
        )

        # Frame 内的子元素
        child = ImageElement(
            id="child1",
            type="image",
            name="子图片",
            x=20.0,
            y=20.0,
            width=100.0,
            height=100.0
        )

        frame = FrameElement(
            id="frame1",
            type="frame",
            name="画框",
            x=220.0,  # 紧挨着顶层元素
            y=0.0,
            width=200.0,
            height=150.0,
            children=[child]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[top_elem, frame])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算下一个位置
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=150.0,
            spacing=20.0
        )

        # 新算法检测重叠并自动调整
        # frame 绝对位置: (220, 0), 宽度 200 → 右边界 420
        assert x == 440.0  # 220 + 200 + 20
        assert y == 0.0

    def test_position_with_multiple_rows(self):
        """测试多行布局时的位置计算"""
        # 创建第一行的 4 个元素（达到最大值）
        row1_elements = []
        for i in range(4):
            elem = ImageElement(
                id=f"elem{i+1}",
                type="image",
                name=f"图片{i+1}",
                x=i * 220.0,  # 200 + 20 spacing
                y=0.0,
                width=200.0,
                height=150.0
            )
            row1_elements.append(elem)

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=row1_elements)
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算下一个位置（第一行已满，应该开始新行）
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=150.0,
            max_elements_per_row=4,
            spacing=20.0
        )

        # 应该在新行的开始
        assert x == 0.0
        assert y == 170.0  # 150 + 20

    def test_position_considers_child_in_row_detection(self):
        """测试行检测时考虑容器内的子元素"""
        # Frame 内有子元素，子元素在画布上的绝对位置会影响行检测
        child1 = ImageElement(
            id="child1",
            type="image",
            name="子1",
            x=10.0,
            y=10.0,
            width=180.0,
            height=130.0
        )

        frame1 = FrameElement(
            id="frame1",
            type="frame",
            name="画框1",
            x=0.0,
            y=0.0,
            width=200.0,
            height=150.0,
            children=[child1]
        )

        # 另一个 Frame
        child2 = ImageElement(
            id="child2",
            type="image",
            name="子2",
            x=10.0,
            y=10.0,
            width=180.0,
            height=130.0
        )

        frame2 = FrameElement(
            id="frame2",
            type="frame",
            name="画框2",
            x=220.0,
            y=0.0,
            width=200.0,
            height=150.0,
            children=[child2]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame1, frame2])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算下一个位置
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=150.0,
            max_elements_per_row=2,  # 设置每行最多2个元素
            spacing=20.0
        )

        # 第一行已有 frame1 和 frame2（共2个顶层元素），应该开始新行
        # 但算法会计算所有元素（包括子元素），所以实际有4个元素
        # 默认 max_elements_per_row=4，所以会开始新行
        assert x == 0.0  # 新行开始
        assert y == 170.0  # frame1 高度 150 + spacing 20

    def test_hidden_elements_excluded_from_layout(self):
        """测试隐藏元素不参与布局计算"""
        # 可见元素
        visible_elem = ImageElement(
            id="visible1",
            type="image",
            name="可见图片",
            x=0.0,
            y=0.0,
            width=200.0,
            height=150.0,
            visible=True
        )

        # 隐藏元素
        hidden_elem = ImageElement(
            id="hidden1",
            type="image",
            name="隐藏图片",
            x=220.0,
            y=0.0,
            width=200.0,
            height=150.0,
            visible=False
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[visible_elem, hidden_elem])
        )

        _compute_element_hierarchy_and_absolute_coords(config)

        # 计算下一个位置（应该忽略隐藏元素）
        x, y = calculate_next_element_position(
            config=config,
            element_width=200.0,
            element_height=150.0,
            spacing=20.0
        )

        # 应该紧挨着可见元素，忽略隐藏元素
        assert x == 220.0  # 0 + 200 + 20
        assert y == 0.0
