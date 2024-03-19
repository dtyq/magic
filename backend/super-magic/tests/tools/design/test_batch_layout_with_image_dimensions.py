"""
测试批量创建时的布局计算是否正确读取图片尺寸

验证修复：批量创建图片元素时，如果元素规格中没有提供 width/height，
布局计算应该从图片文件读取真实尺寸，而不是使用默认的 100x100。
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
from app.tools.design.tools.batch_create_canvas_elements import (
    BatchCreateCanvasElements,
    BatchCreateCanvasElementsParams,
    ElementCreationSpec
)


class TestBatchLayoutWithImageDimensions:
    """测试批量创建时正确使用图片尺寸进行布局计算"""

    def test_layout_reads_image_dimensions_for_grid(self):
        """测试网格布局时从图片文件读取尺寸"""
        # 模拟 2048x2048 的图片
        mock_image = MagicMock()
        mock_image.size = (2048, 2048)
        mock_image.__enter__ = Mock(return_value=mock_image)
        mock_image.__exit__ = Mock(return_value=False)

        # 模拟 Path.exists() 返回 True
        mock_path = MagicMock()
        mock_path.exists.return_value = True

        # 模拟 PathManager.get_workspace_dir() 返回一个 Mock Path
        mock_workspace = MagicMock()
        mock_workspace.__truediv__ = Mock(return_value=mock_path)  # workspace / src

        with patch('PIL.Image.open', return_value=mock_image), \
             patch('app.tools.design.tools.batch_create_canvas_elements.PathManager.get_workspace_dir', return_value=mock_workspace):
            tool = BatchCreateCanvasElements()

            # 创建 4 个图片元素规格（没有设置 width/height）
            elements = [
                ElementCreationSpec(
                    element_type="image",
                    name=f"图片_{i+1}",
                    properties={"src": f"project/images/img{i+1}.jpg"}
                )
                for i in range(4)
            ]

            params = BatchCreateCanvasElementsParams(
                project_path="test_project",
                elements=elements,
                layout_mode="grid",
                grid_columns=2,
                spacing=20.0,
                start_x=100.0,
                start_y=100.0
            )

            # 模拟 canvas manager
            mock_manager = Mock()

            # 执行布局计算
            import asyncio
            positions = asyncio.run(tool._calculate_layout(params, mock_manager))

            # 验证布局计算使用了正确的尺寸（2048 而不是 100）
            assert len(positions) == 4

            # 第一个元素 (0,0): x=100, y=100
            assert positions[0] == {"x": 100.0, "y": 100.0}

            # 第二个元素 (0,1): x=100 + 1*(2048+20) = 2168
            assert positions[1] == {"x": 2168.0, "y": 100.0}

            # 第三个元素 (1,0): x=100, y=100 + 1*(2048+20) = 2168
            assert positions[2] == {"x": 100.0, "y": 2168.0}

            # 第四个元素 (1,1): x=2168, y=2168
            assert positions[3] == {"x": 2168.0, "y": 2168.0}

    def test_layout_reads_image_dimensions_for_horizontal(self):
        """测试水平布局时从图片文件读取尺寸"""
        # 模拟 800x600 的图片
        mock_image = MagicMock()
        mock_image.size = (800, 600)
        mock_image.__enter__ = Mock(return_value=mock_image)
        mock_image.__exit__ = Mock(return_value=False)

        # 模拟 Path.exists() 返回 True
        mock_path = MagicMock()
        mock_path.exists.return_value = True

        # 模拟 PathManager.get_workspace_dir()
        mock_workspace = MagicMock()
        mock_workspace.__truediv__ = Mock(return_value=mock_path)

        with patch('PIL.Image.open', return_value=mock_image), \
             patch('app.tools.design.tools.batch_create_canvas_elements.PathManager.get_workspace_dir', return_value=mock_workspace):
            tool = BatchCreateCanvasElements()

            elements = [
                ElementCreationSpec(
                    element_type="image",
                    name=f"图片_{i+1}",
                    properties={"src": f"project/images/img{i+1}.jpg"}
                )
                for i in range(3)
            ]

            params = BatchCreateCanvasElementsParams(
                project_path="test_project",
                elements=elements,
                layout_mode="horizontal",
                spacing=20.0,
                start_x=100.0,
                start_y=100.0
            )

            mock_manager = Mock()

            import asyncio
            positions = asyncio.run(tool._calculate_layout(params, mock_manager))

            # 验证水平布局使用了正确的宽度（800 而不是 100）
            assert len(positions) == 3
            assert positions[0] == {"x": 100.0, "y": 100.0}
            assert positions[1] == {"x": 920.0, "y": 100.0}  # 100 + 800 + 20
            assert positions[2] == {"x": 1740.0, "y": 100.0}  # 920 + 800 + 20

    def test_layout_uses_provided_dimensions_when_available(self):
        """测试当元素规格已提供尺寸时，优先使用提供的尺寸"""
        tool = BatchCreateCanvasElements()

        # 元素规格中已经提供了尺寸
        elements = [
            ElementCreationSpec(
                element_type="image",
                name="图片_1",
                width=500.0,
                height=400.0,
                properties={"src": "project/images/img1.jpg"}
            ),
            ElementCreationSpec(
                element_type="image",
                name="图片_2",
                width=500.0,
                height=400.0,
                properties={"src": "project/images/img2.jpg"}
            )
        ]

        params = BatchCreateCanvasElementsParams(
            project_path="test_project",
            elements=elements,
            layout_mode="horizontal",
            spacing=20.0,
            start_x=100.0,
            start_y=100.0
        )

        mock_manager = Mock()

        import asyncio
        positions = asyncio.run(tool._calculate_layout(params, mock_manager))

        # 验证使用了提供的尺寸（500 而不是从文件读取）
        assert len(positions) == 2
        assert positions[0] == {"x": 100.0, "y": 100.0}
        assert positions[1] == {"x": 620.0, "y": 100.0}  # 100 + 500 + 20

    def test_layout_fallback_to_default_when_image_not_found(self):
        """测试当图片文件不存在时，回退到默认尺寸"""
        tool = BatchCreateCanvasElements()

        elements = [
            ElementCreationSpec(
                element_type="image",
                name="图片_1",
                properties={"src": "project/images/nonexistent.jpg"}
            ),
            ElementCreationSpec(
                element_type="image",
                name="图片_2",
                properties={"src": "project/images/nonexistent2.jpg"}
            )
        ]

        params = BatchCreateCanvasElementsParams(
            project_path="test_project",
            elements=elements,
            layout_mode="horizontal",
            spacing=20.0,
            start_x=100.0,
            start_y=100.0
        )

        mock_manager = Mock()

        import asyncio
        positions = asyncio.run(tool._calculate_layout(params, mock_manager))

        # 当图片不存在时，应该回退到默认尺寸 1024x1024
        assert len(positions) == 2
        assert positions[0] == {"x": 100.0, "y": 100.0}
        assert positions[1] == {"x": 1144.0, "y": 100.0}  # 100 + 1024 + 20

    def test_layout_uses_correct_default_for_all_element_types(self):
        """测试所有元素类型统一使用 1024x1024 默认尺寸"""
        tool = BatchCreateCanvasElements()

        # 测试普通元素（矩形）使用 1024x1024 默认尺寸
        elements_rect = [
            ElementCreationSpec(
                element_type="rectangle",
                name="矩形_1",
                properties={"fill": "#FF0000"}
            ),
            ElementCreationSpec(
                element_type="rectangle",
                name="矩形_2",
                properties={"fill": "#00FF00"}
            )
        ]

        params_rect = BatchCreateCanvasElementsParams(
            project_path="test_project",
            elements=elements_rect,
            layout_mode="horizontal",
            spacing=20.0,
            start_x=100.0,
            start_y=100.0
        )

        mock_manager = Mock()

        import asyncio
        positions_rect = asyncio.run(tool._calculate_layout(params_rect, mock_manager))

        # 矩形元素使用默认 1024x1024，第二个元素应该在 100 + 1024 + 20 = 1144
        assert len(positions_rect) == 2
        assert positions_rect[0] == {"x": 100.0, "y": 100.0}
        assert positions_rect[1] == {"x": 1144.0, "y": 100.0}

        # 测试文本元素也使用 1024x1024 默认尺寸
        elements_text = [
            ElementCreationSpec(
                element_type="text",
                name="文本_1",
                properties={"content": []}
            ),
            ElementCreationSpec(
                element_type="text",
                name="文本_2",
                properties={"content": []}
            )
        ]

        params_text = BatchCreateCanvasElementsParams(
            project_path="test_project",
            elements=elements_text,
            layout_mode="horizontal",
            spacing=20.0,
            start_x=100.0,
            start_y=100.0
        )

        positions_text = asyncio.run(tool._calculate_layout(params_text, mock_manager))

        # 文本元素使用默认 1024x1024，第二个元素应该在 100 + 1024 + 20 = 1144
        assert len(positions_text) == 2
        assert positions_text[0] == {"x": 100.0, "y": 100.0}
        assert positions_text[1] == {"x": 1144.0, "y": 100.0}
