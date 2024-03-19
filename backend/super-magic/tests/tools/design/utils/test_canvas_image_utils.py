"""
Canvas Image Utils 单元测试
"""

import pytest
from pathlib import Path
from PIL import Image as PILImage

from app.tools.design.utils.canvas_image_utils import (
    get_image_dimensions,
    validate_image_file,
    get_image_info
)


class TestGetImageDimensions:
    """get_image_dimensions 函数测试"""

    def test_read_valid_image(self, tmp_path):
        """测试从有效图片文件读取尺寸"""
        # 创建测试图片
        image_path = tmp_path / "test_image.png"
        img = PILImage.new('RGB', (800, 600), color='red')
        img.save(image_path)

        # 读取尺寸
        width, height = get_image_dimensions(image_path)

        assert width == 800
        assert height == 600

    def test_file_not_found(self, tmp_path):
        """测试图片文件不存在时的错误"""
        image_path = tmp_path / "nonexistent.png"

        with pytest.raises(FileNotFoundError) as exc_info:
            get_image_dimensions(image_path)

        assert "Image file not found" in str(exc_info.value)

    def test_invalid_image_file(self, tmp_path):
        """测试文件不是有效图片时的错误"""
        # 创建文本文件
        image_path = tmp_path / "not_an_image.txt"
        image_path.write_text("This is not an image")

        with pytest.raises(ValueError) as exc_info:
            get_image_dimensions(image_path)

        assert "无法读取图片尺寸" in str(exc_info.value)

    def test_different_image_formats(self, tmp_path):
        """测试读取不同图片格式的尺寸"""
        formats = [
            ("test.png", "PNG", (640, 480)),
            ("test.jpg", "JPEG", (1920, 1080)),
            ("test.webp", "WEBP", (512, 512))
        ]

        for filename, format_name, size in formats:
            image_path = tmp_path / filename
            img = PILImage.new('RGB', size, color='blue')
            img.save(image_path, format=format_name)

            width, height = get_image_dimensions(image_path)
            assert (width, height) == size


class TestValidateImageFile:
    """validate_image_file 函数测试"""

    def test_valid_image_file(self, tmp_path):
        """测试验证有效的图片文件"""
        workspace = tmp_path
        image_path = workspace / "images" / "photo.jpg"
        image_path.parent.mkdir(parents=True)

        # 创建测试图片
        img = PILImage.new('RGB', (100, 100), color='green')
        img.save(image_path)

        # 不应该抛出任何异常
        validate_image_file(image_path, workspace)

    def test_file_not_found(self, tmp_path):
        """测试文件不存在时的错误"""
        workspace = tmp_path
        image_path = workspace / "images" / "nonexistent.jpg"

        with pytest.raises(ValueError) as exc_info:
            validate_image_file(image_path, workspace)

        assert "Image file not found" in str(exc_info.value)

    def test_path_is_directory(self, tmp_path):
        """测试路径是目录时的错误"""
        workspace = tmp_path
        dir_path = workspace / "images"
        dir_path.mkdir(parents=True)

        with pytest.raises(ValueError) as exc_info:
            validate_image_file(dir_path, workspace)

        assert "Path is not a file" in str(exc_info.value)

    def test_file_outside_workspace(self, tmp_path):
        """测试文件在工作区外时的错误"""
        workspace = tmp_path / "workspace"
        workspace.mkdir()

        outside_image = tmp_path / "outside" / "photo.jpg"
        outside_image.parent.mkdir(parents=True)

        # 创建图片
        img = PILImage.new('RGB', (100, 100), color='blue')
        img.save(outside_image)

        with pytest.raises(ValueError) as exc_info:
            validate_image_file(outside_image, workspace)

        assert "outside the workspace" in str(exc_info.value)


class TestGetImageInfo:
    """get_image_info 函数测试"""

    def test_get_info_from_relative_path(self, tmp_path):
        """测试从相对路径获取图片信息"""
        workspace = tmp_path

        # 创建图片目录和文件
        image_dir = workspace / "Demo" / "images"
        image_dir.mkdir(parents=True)
        image_path = image_dir / "photo.jpg"

        img = PILImage.new('RGB', (1024, 768), color='yellow')
        img.save(image_path)

        # 使用相对路径获取图片信息
        width, height = get_image_info("Demo/images/photo.jpg", workspace)

        assert width == 1024
        assert height == 768

    def test_invalid_relative_path(self, tmp_path):
        """测试无效相对路径的错误"""
        workspace = tmp_path

        with pytest.raises(ValueError) as exc_info:
            get_image_info("nonexistent/image.jpg", workspace)

        assert "Image file not found" in str(exc_info.value)

    def test_path_with_spaces(self, tmp_path):
        """测试处理包含空格的路径"""
        workspace = tmp_path

        # 创建路径中包含空格的图片
        image_dir = workspace / "My Images" / "Vacation Photos"
        image_dir.mkdir(parents=True)
        image_path = image_dir / "beach photo.png"

        img = PILImage.new('RGB', (640, 480), color='cyan')
        img.save(image_path)

        width, height = get_image_info("My Images/Vacation Photos/beach photo.png", workspace)

        assert width == 640
        assert height == 480
