"""
Canvas Layout Utils 单元测试
"""

import pytest

from app.tools.design.utils.canvas_layout_utils import calculate_next_element_position
from app.tools.design.utils.magic_project_design_parser import ImageElement


class TestCalculateNextElementPosition:
    """calculate_next_element_position 函数测试"""

    def test_empty_canvas(self):
        """测试空画布上的位置计算"""
        x, y = calculate_next_element_position(
            existing_elements=[],
            element_width=200,
            element_height=150
        )

        assert x == 0.0
        assert y == 0.0

    def test_single_element_in_row(self):
        """测试向第一行添加第二个元素"""
        # 创建一个现有元素
        existing = [
            ImageElement(
                id="img1",
                name="Image 1",
                type="image",
                x=0.0,
                y=0.0,
                width=200.0,
                height=150.0,
                visible=True
            )
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150,
            spacing=20
        )

        # 应该放置在右侧，保持间距
        assert x == 220.0  # 0 + 200 + 20
        assert y == 0.0    # 同一行

    def test_row_full_start_new_row(self):
        """测试当前行已满时开始新行"""
        # 在第一行创建 4 个元素（max_elements_per_row=4）
        existing = []
        for i in range(4):
            existing.append(
                ImageElement(
                    id=f"img{i+1}",
                    name=f"Image {i+1}",
                    type="image",
                    x=float(i * 220),
                    y=0.0,
                    width=200.0,
                    height=150.0,
                    visible=True
                )
            )

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150,
            spacing=20
        )

        # 应该开始新行
        assert x == 0.0
        assert y == 170.0  # 0 + 150 + 20

    def test_multiple_rows(self):
        """测试多行的情况"""
        # 第 1 行: 2 个元素
        # 第 2 行: 3 个元素
        existing = [
            # 第 1 行
            ImageElement(id="r1_1", name="R1-1", type="image", x=0.0, y=0.0, width=200.0, height=150.0, visible=True),
            ImageElement(id="r1_2", name="R1-2", type="image", x=220.0, y=0.0, width=200.0, height=150.0, visible=True),
            # 第 2 行
            ImageElement(id="r2_1", name="R2-1", type="image", x=0.0, y=170.0, width=200.0, height=150.0, visible=True),
            ImageElement(id="r2_2", name="R2-2", type="image", x=220.0, y=170.0, width=200.0, height=150.0, visible=True),
            ImageElement(id="r2_3", name="R2-3", type="image", x=440.0, y=170.0, width=200.0, height=150.0, visible=True),
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150,
            max_elements_per_row=4,
            spacing=20
        )

        # 应该添加到最后一行（第 2 行有 3 个元素，最大是 4）
        assert x == 660.0  # 440 + 200 + 20
        assert y == 170.0  # 与第 2 行相同

    def test_ignore_hidden_elements(self):
        """测试忽略隐藏元素"""
        existing = [
            ImageElement(
                id="img1",
                name="Image 1",
                type="image",
                x=0.0,
                y=0.0,
                width=200.0,
                height=150.0,
                visible=False  # 隐藏
            )
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150
        )

        # 应该视为空画布
        assert x == 0.0
        assert y == 0.0

    def test_ignore_elements_without_position(self):
        """测试忽略没有位置/尺寸的元素"""
        existing = [
            ImageElement(
                id="img1",
                name="Image 1",
                type="image",
                x=None,  # 无位置
                y=None,
                width=None,
                height=None
            )
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150
        )

        # 应该视为空画布
        assert x == 0.0
        assert y == 0.0

    def test_custom_spacing(self):
        """测试自定义间距"""
        existing = [
            ImageElement(
                id="img1",
                name="Image 1",
                type="image",
                x=0.0,
                y=0.0,
                width=200.0,
                height=150.0,
                visible=True
            )
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150,
            spacing=50  # 自定义间距
        )

        assert x == 250.0  # 0 + 200 + 50
        assert y == 0.0

    def test_custom_max_elements_per_row(self):
        """测试自定义每行最大元素数"""
        # 创建 2 个元素
        existing = [
            ImageElement(
                id=f"img{i+1}",
                name=f"Image {i+1}",
                type="image",
                x=float(i * 220),
                y=0.0,
                width=200.0,
                height=150.0,
                visible=True
            )
            for i in range(2)
        ]

        x, y = calculate_next_element_position(
            existing_elements=existing,
            element_width=200,
            element_height=150,
            max_elements_per_row=2,  # 自定义最大值
            spacing=20
        )

        # 应该开始新行（当前行已满，有 2 个元素）
        assert x == 0.0
        assert y == 170.0
