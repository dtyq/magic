"""
坐标系统测试

测试元素的相对坐标和绝对坐标转换功能，确保：
1. 顶层元素的绝对坐标 = 相对坐标
2. 容器内子元素的绝对坐标 = 父容器绝对坐标 + 子元素相对坐标
3. 嵌套容器的坐标累加正确
4. 元素展平功能正确
"""

import pytest
from app.tools.design.utils.magic_project_design_parser import (
    MagicProjectConfig,
    CanvasConfig,
    ImageElement,
    FrameElement,
    GroupElement,
    flatten_all_elements,
    _compute_element_hierarchy_and_absolute_coords
)


class TestCoordinateSystem:
    """坐标系统测试类"""

    def test_top_level_element_absolute_coords(self):
        """测试顶层元素的绝对坐标等于相对坐标"""
        # 创建顶层元素
        elem = ImageElement(
            id="elem1",
            type="image",
            name="测试图片",
            x=100.0,
            y=200.0,
            width=300.0,
            height=400.0
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[elem])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证顶层元素
        assert elem.parent_id is None
        assert elem.absolute_x == 100.0
        assert elem.absolute_y == 200.0

    def test_child_element_absolute_coords(self):
        """测试容器内子元素的绝对坐标计算"""
        # 创建子元素（相对于父容器的坐标）
        child = ImageElement(
            id="child1",
            type="image",
            name="子图片",
            x=50.0,  # 相对于 Frame 的坐标
            y=30.0,
            width=100.0,
            height=100.0
        )

        # 创建 Frame（父容器）
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

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证父容器
        assert frame.parent_id is None
        assert frame.absolute_x == 100.0
        assert frame.absolute_y == 100.0

        # 验证子元素的绝对坐标 = 父坐标 + 子相对坐标
        assert child.parent_id == "frame1"
        assert child.absolute_x == 150.0  # 100 + 50
        assert child.absolute_y == 130.0  # 100 + 30

    def test_nested_containers_absolute_coords(self):
        """测试嵌套容器的坐标累加"""
        # 创建最内层元素
        inner_elem = ImageElement(
            id="inner1",
            type="image",
            name="内层图片",
            x=10.0,  # 相对于 group 的坐标
            y=20.0,
            width=50.0,
            height=50.0
        )

        # 创建中间层 Group
        group = GroupElement(
            id="group1",
            type="group",
            name="组",
            x=30.0,  # 相对于 frame 的坐标
            y=40.0,
            width=200.0,
            height=150.0,
            children=[inner_elem]
        )

        # 创建外层 Frame
        frame_outer = FrameElement(
            id="frame1",
            type="frame",
            name="画框",
            x=100.0,  # 画布绝对坐标
            y=200.0,
            width=400.0,
            height=300.0,
            children=[group]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame_outer])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证三层坐标
        assert frame_outer.absolute_x == 100.0
        assert frame_outer.absolute_y == 200.0

        assert group.parent_id == "frame1"
        assert group.absolute_x == 130.0  # 100 + 30
        assert group.absolute_y == 240.0  # 200 + 40

        assert inner_elem.parent_id == "group1"
        assert inner_elem.absolute_x == 140.0  # 100 + 30 + 10
        assert inner_elem.absolute_y == 260.0  # 200 + 40 + 20

    def test_flatten_all_elements(self):
        """测试元素展平功能"""
        # 创建复杂的嵌套结构
        child1 = ImageElement(id="child1", type="image", name="子1", x=10.0, y=10.0, width=50.0, height=50.0)
        child2 = ImageElement(id="child2", type="image", name="子2", x=70.0, y=10.0, width=50.0, height=50.0)

        group = GroupElement(
            id="group1",
            type="group",
            name="组",
            x=50.0,
            y=50.0,
            width=200.0,
            height=100.0,
            children=[child1, child2]
        )

        top_elem = ImageElement(id="top1", type="image", name="顶层", x=0.0, y=0.0, width=100.0, height=100.0)

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[top_elem, group])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 展平所有元素
        all_elements = flatten_all_elements(config)

        # 验证展平结果
        assert len(all_elements) == 4  # top1, group, child1, child2

        # 验证所有元素都在列表中
        element_ids = {e.id for e in all_elements}
        assert element_ids == {"top1", "group1", "child1", "child2"}

        # 验证绝对坐标已计算
        for elem in all_elements:
            assert elem.absolute_x is not None
            assert elem.absolute_y is not None

    def test_missing_coords_default_to_zero(self):
        """测试缺失坐标默认为 0"""
        # 创建没有坐标的元素
        child = ImageElement(
            id="child1",
            type="image",
            name="无坐标子元素",
            # x 和 y 缺失
            width=100.0,
            height=100.0
        )

        frame = FrameElement(
            id="frame1",
            type="frame",
            name="画框",
            x=100.0,
            y=200.0,
            width=300.0,
            height=300.0,
            children=[child]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证缺失坐标被视为 0
        assert child.absolute_x == 100.0  # 100 + 0
        assert child.absolute_y == 200.0  # 200 + 0

    def test_multiple_top_level_containers(self):
        """测试多个顶层容器"""
        # 创建两个独立的 Frame
        child1 = ImageElement(id="child1", type="image", name="子1", x=10.0, y=10.0, width=50.0, height=50.0)
        frame1 = FrameElement(
            id="frame1",
            type="frame",
            name="画框1",
            x=0.0,
            y=0.0,
            width=200.0,
            height=200.0,
            children=[child1]
        )

        child2 = ImageElement(id="child2", type="image", name="子2", x=20.0, y=20.0, width=60.0, height=60.0)
        frame2 = FrameElement(
            id="frame2",
            type="frame",
            name="画框2",
            x=300.0,
            y=0.0,
            width=200.0,
            height=200.0,
            children=[child2]
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame1, frame2])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证两个独立的容器
        assert child1.absolute_x == 10.0  # 0 + 10
        assert child1.absolute_y == 10.0  # 0 + 10

        assert child2.absolute_x == 320.0  # 300 + 20
        assert child2.absolute_y == 20.0   # 0 + 20

    def test_empty_canvas(self):
        """测试空画布"""
        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="空项目",
            canvas=CanvasConfig(elements=[])
        )

        # 计算坐标（不应该报错）
        _compute_element_hierarchy_and_absolute_coords(config)

        # 展平元素
        all_elements = flatten_all_elements(config)
        assert len(all_elements) == 0

    def test_container_without_children(self):
        """测试没有子元素的容器"""
        frame = FrameElement(
            id="frame1",
            type="frame",
            name="空画框",
            x=100.0,
            y=100.0,
            width=300.0,
            height=300.0,
            children=[]  # 空的子元素列表
        )

        config = MagicProjectConfig(
            version="1.0.0",
            type="design",
            name="测试项目",
            canvas=CanvasConfig(elements=[frame])
        )

        # 计算坐标
        _compute_element_hierarchy_and_absolute_coords(config)

        # 验证容器本身
        assert frame.absolute_x == 100.0
        assert frame.absolute_y == 100.0

        # 展平元素
        all_elements = flatten_all_elements(config)
        assert len(all_elements) == 1  # 只有 frame 本身
        assert all_elements[0].id == "frame1"
