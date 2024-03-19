"""
Unit tests for magic_project_design_parser module.
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import patch
import pytest

# 设置项目根目录
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from app.paths import PathManager
PathManager.set_project_root(project_root)

from app.tools.design.utils import (
    # Data classes
    MagicProjectConfig,
    CanvasConfig,
    ImageElement,
    TextElement,
    RichTextParagraph,
    RichTextNode,
    # Functions
    read_magic_project_js,
    write_magic_project_js,
    validate_project_config,
    get_project_file_path,
)

# Mark all async tests
pytestmark = pytest.mark.asyncio


def create_valid_config() -> MagicProjectConfig:
    """Create a valid test configuration."""
    image_elem = ImageElement(
        id="element-1",
        name="Test Image",
        type="image",
        x=100,
        y=200,
        width=500,
        height=300,
        zIndex=0,
        visible=True,
        opacity=1.0,
        locked=False,
    )

    text_elem = TextElement(
        id="element-2",
        name="Test Text",
        type="text",
        x=50,
        y=50,
        width=200,
        height=100,
        zIndex=1,
        content=[
            RichTextParagraph(
                children=[
                    RichTextNode(type="text", text="Hello")
                ]
            )
        ]
    )

    canvas = CanvasConfig(elements=[image_elem, text_elem])

    return MagicProjectConfig(
        version="1.0.0",
        type="design",
        name="Test Project",
        canvas=canvas
    )


# Sample valid configuration as dict (for validation tests)
VALID_CONFIG_DICT = {
    "version": "1.0.0",
    "type": "design",
    "name": "Test Project",
    "canvas": {
        "elements": [
            {
                "id": "element-1",
                "name": "Test Image",
                "type": "image",
                "x": 100,
                "y": 200,
                "width": 500,
                "height": 300,
                "zIndex": 0,
                "visible": True,
                "opacity": 1.0,
                "locked": False,
            },
            {
                "id": "element-2",
                "name": "Test Text",
                "type": "text",
                "x": 50,
                "y": 50,
                "width": 200,
                "height": 100,
                "zIndex": 1,
                "content": [{"children": [{"type": "text", "text": "Hello"}]}],
            }
        ]
    }
}


class TestValidateProjectConfig:
    """Tests for validate_project_config function."""

    def test_valid_config(self):
        """Test validation of valid configuration."""
        result = validate_project_config(VALID_CONFIG_DICT)
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_missing_required_fields(self):
        """Test validation fails for missing required fields."""
        invalid_config = {"version": "1.0.0"}
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert len(result.errors) > 0
        assert any("Missing required fields" in err for err in result.errors)

    def test_invalid_type(self):
        """Test validation fails for invalid project type."""
        invalid_config = VALID_CONFIG_DICT.copy()
        invalid_config["type"] = "invalid"
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert any("Invalid type" in err for err in result.errors)

    def test_missing_canvas_elements(self):
        """Test validation fails when canvas.elements is missing."""
        invalid_config = VALID_CONFIG_DICT.copy()
        invalid_config["canvas"] = {}
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert any("canvas.elements" in err for err in result.errors)

    def test_invalid_element_type(self):
        """Test validation fails for invalid element type."""
        invalid_config = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test",
            "canvas": {
                "elements": [
                    {
                        "id": "elem-1",
                        "name": "Test",
                        "type": "invalid_type",
                    }
                ]
            }
        }
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert any("Invalid type" in err for err in result.errors)

    def test_invalid_numeric_field(self):
        """Test validation fails for non-numeric fields."""
        invalid_config = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test",
            "canvas": {
                "elements": [
                    {
                        "id": "elem-1",
                        "name": "Test",
                        "type": "image",
                        "x": "not_a_number",  # Should be numeric
                    }
                ]
            }
        }
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert any("must be numeric" in err for err in result.errors)

    def test_invalid_opacity_range(self):
        """Test validation fails for opacity out of range."""
        invalid_config = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test",
            "canvas": {
                "elements": [
                    {
                        "id": "elem-1",
                        "name": "Test",
                        "type": "image",
                        "opacity": 1.5,  # Should be 0-1
                    }
                ]
            }
        }
        result = validate_project_config(invalid_config)
        assert result.is_valid is False
        assert any("opacity must be between 0 and 1" in err for err in result.errors)


class TestReadWriteMagicProjectJS:
    """Tests for read/write operations."""

    @pytest.fixture
    def temp_project_dir(self, tmp_path):
        """Create a temporary project directory."""
        project_dir = tmp_path / "test_project"
        project_dir.mkdir()
        return "test_project"

    async def test_write_and_read_config(self, temp_project_dir, tmp_path):
        """Test writing and reading configuration."""
        config = create_valid_config()

        # Mock PathManager using patch
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            # Write config
            success = await write_magic_project_js(temp_project_dir, config)
            assert success is True

            # Read config back
            read_config = await read_magic_project_js(temp_project_dir)

        # Verify content matches
        assert isinstance(read_config, MagicProjectConfig)
        assert read_config.version == config.version
        assert read_config.type == config.type
        assert read_config.name == config.name
        assert len(read_config.canvas.elements) == len(config.canvas.elements)

        # Verify first element
        first_elem = read_config.canvas.elements[0]
        assert isinstance(first_elem, ImageElement)
        assert first_elem.id == "element-1"
        assert first_elem.name == "Test Image"
        assert first_elem.x == 100
        assert first_elem.y == 200

    async def test_read_nonexistent_file(self, tmp_path):
        """Test reading non-existent file raises error."""
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            with pytest.raises(FileNotFoundError):
                await read_magic_project_js("nonexistent_project")

    async def test_write_invalid_config(self, temp_project_dir, tmp_path):
        """Test writing config with invalid data raises error."""
        # Create config with invalid type
        invalid_config = MagicProjectConfig(
            version="1.0.0",
            type="invalid_type",  # Should be "design"
            name="Test",
            canvas=CanvasConfig(elements=[])
        )

        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            with pytest.raises(ValueError):
                await write_magic_project_js(temp_project_dir, invalid_config)

    async def test_read_invalid_jsonp_format(self, temp_project_dir, tmp_path):
        """Test reading file with invalid JSONP format."""
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            # Create file with invalid format
            project_path = tmp_path / temp_project_dir
            file_path = project_path / "magic.project.js"
            file_path.write_text("invalid content", encoding="utf-8")

            with pytest.raises(ValueError) as excinfo:
                await read_magic_project_js(temp_project_dir)
            assert "Invalid JSONP format" in str(excinfo.value)


class TestUtilityFunctions:
    """Tests for utility functions."""

    def test_get_project_file_path(self, tmp_path):
        """Test getting project file path."""
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            path = get_project_file_path("my_project")
            assert "my_project" in path
            assert "magic.project.js" in path


class TestDataClasses:
    """Tests for data class structures."""

    def test_create_image_element(self):
        """Test creating ImageElement."""
        elem = ImageElement(
            id="img-1",
            name="My Image",
            type="image",
            x=100,
            y=200,
            src="images/test.jpg"
        )
        assert elem.id == "img-1"
        assert elem.type == "image"
        assert elem.src == "images/test.jpg"

    def test_create_text_element(self):
        """Test creating TextElement."""
        elem = TextElement(
            id="text-1",
            name="My Text",
            type="text",
            x=50,
            y=50,
            content=[
                RichTextParagraph(
                    children=[
                        RichTextNode(type="text", text="Hello World")
                    ]
                )
            ]
        )
        assert elem.id == "text-1"
        assert elem.type == "text"
        assert len(elem.content) == 1
        assert elem.content[0].children[0].text == "Hello World"

    def test_create_full_config(self):
        """Test creating full MagicProjectConfig."""
        config = create_valid_config()
        assert isinstance(config, MagicProjectConfig)
        assert config.version == "1.0.0"
        assert config.type == "design"
        assert len(config.canvas.elements) == 2


class TestNameFieldOptional:
    """测试 name 字段可选和容错功能"""

    def test_element_without_name_field_skip_validation(self):
        """测试缺少 name 字段的元素能通过验证（不验证元素级）"""
        config = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test Project",
            "canvas": {
                "elements": [
                    {
                        "id": "elem-1",
                        # 缺少 name 字段
                        "type": "rectangle",
                        "x": 100,
                        "y": 200,
                        "width": 300,
                        "height": 150,
                    }
                ]
            }
        }

        # 不验证元素级时应该通过
        result = validate_project_config(config, validate_elements=False)
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_element_without_name_with_validation(self):
        """测试当 validate_elements=True 时，缺少 name 的元素也能通过（已从必需字段移除）"""
        config = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test Project",
            "canvas": {
                "elements": [
                    {
                        "id": "elem-1",
                        # 缺少 name 字段
                        "type": "rectangle",
                        "x": 100,
                        "y": 200,
                    }
                ]
            }
        }

        # 即使验证元素，name 字段现在是可选的，所以应该通过
        result = validate_project_config(config, validate_elements=True)
        assert result.is_valid is True
        assert len(result.errors) == 0

    def test_online_error_case(self):
        """测试线上报错的真实场景：矩形元素缺少 name 字段"""
        config = {
            "version": "1.0.0",
            "type": "design",
            "name": "新建画布",
            "canvas": {
                "elements": [
                    {
                        "id": "element-1",
                        "name": "图片元素",
                        "type": "image",
                        "x": 100,
                        "y": 200,
                    },
                    {
                        # 线上真实场景：矩形元素缺少 name 字段
                        "id": "element-17668065858290100000",
                        "type": "rectangle",
                        "x": -6590.706153124771,
                        "y": -1975.9056141925212,
                        "width": 620.6089985868957,
                        "height": 690.4297538537953,
                        "zIndex": 5,
                        "fill": "#969696",
                        "cornerRadius": 0
                    }
                ]
            }
        }

        # 使用 validate_elements=False（读取时的行为）
        result = validate_project_config(config, validate_elements=False)
        assert result.is_valid is True
        assert len(result.errors) == 0

    async def test_parse_element_without_name_auto_generates(self, tmp_path):
        """测试解析缺少 name 字段的元素时自动生成默认名称"""
        from app.tools.design.utils.magic_project_design_parser import _parse_config_dict

        config_dict = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test Project",
            "canvas": {
                "elements": [
                    {
                        "id": "element-123456",
                        "type": "rectangle",
                        # 缺少 name 字段
                        "x": 100,
                        "y": 200,
                        "width": 300,
                        "height": 150,
                    }
                ]
            }
        }

        # 解析配置
        parsed_config = _parse_config_dict(config_dict)

        # 验证元素被成功解析
        assert len(parsed_config.canvas.elements) == 1
        element = parsed_config.canvas.elements[0]

        # 验证自动生成了名称
        assert element.name is not None
        assert "矩形" in element.name  # 应包含类型名称
        assert "123456" in element.name  # 应包含 ID 后缀

    async def test_skip_invalid_elements(self, tmp_path):
        """测试跳过格式错误的元素而不是整体报错"""
        from app.tools.design.utils.magic_project_design_parser import _parse_config_dict

        config_dict = {
            "version": "1.0.0",
            "type": "design",
            "name": "Test Project",
            "canvas": {
                "elements": [
                    # 第一个元素：正常
                    {
                        "id": "elem-1",
                        "name": "Valid Element",
                        "type": "image",
                        "x": 100,
                        "y": 200,
                    },
                    # 第二个元素：缺少必需的 id 字段（应被跳过）
                    {
                        "name": "Invalid - No ID",
                        "type": "rectangle",
                        "x": 200,
                        "y": 300,
                    },
                    # 第三个元素：缺少必需的 type 字段（应被跳过）
                    {
                        "id": "elem-3",
                        "name": "Invalid - No Type",
                        "x": 300,
                        "y": 400,
                    },
                    # 第四个元素：正常
                    {
                        "id": "elem-4",
                        "name": "Another Valid Element",
                        "type": "text",
                        "x": 400,
                        "y": 500,
                    },
                ]
            }
        }

        # 解析配置（不应抛出异常）
        parsed_config = _parse_config_dict(config_dict)

        # 验证只解析了有效的元素（2个）
        assert len(parsed_config.canvas.elements) == 2
        assert parsed_config.canvas.elements[0].id == "elem-1"
        assert parsed_config.canvas.elements[1].id == "elem-4"

    async def test_read_file_with_invalid_elements(self, tmp_path):
        """测试从文件读取时能跳过无效元素"""
        # 创建项目目录
        project_dir = tmp_path / "test_project"
        project_dir.mkdir()

        # 创建包含无效元素的 magic.project.js 文件
        file_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "Test Project",
  "canvas": {
    "elements": [
      {
        "id": "valid-1",
        "name": "Valid Image",
        "type": "image",
        "x": 100,
        "y": 200
      },
      {
        "id": "invalid-no-type",
        "name": "Invalid Element"
      },
      {
        "id": "valid-2",
        "type": "rectangle",
        "x": 300,
        "y": 400
      }
    ]
  }
};
"""
        file_path = project_dir / "magic.project.js"
        file_path.write_text(file_content, encoding="utf-8")

        # Mock PathManager and read config
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            config = await read_magic_project_js("test_project")

        # 验证读取成功，且只包含有效元素
        assert config.version == "1.0.0"
        assert config.name == "Test Project"
        assert len(config.canvas.elements) == 2  # 只有2个有效元素
        assert config.canvas.elements[0].id == "valid-1"
        assert config.canvas.elements[1].id == "valid-2"
        # 验证第二个元素自动生成了名称
        assert config.canvas.elements[1].name is not None


class TestElementParsingFallback:
    """测试元素解析的容错机制（位置和尺寸字段填充）"""

    def test_parse_image_element_missing_position(self):
        """测试缺少位置信息的图片元素能被解析"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-image-1",
            "type": "image",
            "name": "Test Image",
            "width": 300,
            "height": 200,
            # 缺少 x 和 y
        }

        element = _dict_to_element(data)

        assert element is not None
        assert isinstance(element, ImageElement)
        assert element.id == "test-image-1"
        assert element.x == 0.0  # 默认值
        assert element.y == 0.0  # 默认值
        assert element.width == 300
        assert element.height == 200

    def test_parse_image_element_missing_dimensions(self):
        """测试缺少尺寸信息的图片元素能被解析"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-image-2",
            "type": "image",
            "name": "Test Image",
            "x": 100,
            "y": 50,
            # 缺少 width 和 height
        }

        element = _dict_to_element(data)

        assert element is not None
        assert isinstance(element, ImageElement)
        assert element.x == 100
        assert element.y == 50
        assert element.width == 200.0  # 图片默认宽度
        assert element.height == 200.0  # 图片默认高度

    def test_parse_image_element_all_fields_missing(self):
        """测试所有位置和尺寸字段都缺失的图片元素"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-image-3",
            "type": "image",
            "name": "Test Image",
            # 缺少 x, y, width, height
        }

        element = _dict_to_element(data)

        assert element is not None
        assert isinstance(element, ImageElement)
        assert element.x == 0.0
        assert element.y == 0.0
        assert element.width == 200.0
        assert element.height == 200.0

    def test_parse_rectangle_element_missing_fields(self):
        """测试缺少字段的矩形元素"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element
        from app.tools.design.utils.magic_project_design_parser import RectangleElement

        data = {
            "id": "test-rect-1",
            "type": "rectangle",
            # name 也缺失，会自动生成
            # 缺少 x, y, width, height
        }

        element = _dict_to_element(data)

        assert element is not None
        assert isinstance(element, RectangleElement)
        assert element.x == 0.0
        assert element.y == 0.0
        assert element.width == 100.0  # 非图片元素默认宽度
        assert element.height == 100.0  # 非图片元素默认高度
        assert element.name.startswith("矩形")  # 自动生成的名称

    def test_parse_unsupported_element_type(self):
        """测试不支持的元素类型返回 None"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-frame-1",
            "type": "frame",  # 不支持的类型
            "name": "Test Frame",
            "x": 0,
            "y": 0,
            "width": 100,
            "height": 100,
        }

        element = _dict_to_element(data)

        assert element is None

    def test_parse_element_with_none_values(self):
        """测试字段值为 None 的元素"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-image-4",
            "type": "image",
            "name": "Test Image",
            "x": None,  # 显式 None
            "y": None,
            "width": None,
            "height": None,
        }

        element = _dict_to_element(data)

        assert element is not None
        assert element.x == 0.0
        assert element.y == 0.0
        assert element.width == 200.0
        assert element.height == 200.0

    def test_parse_element_preserves_valid_values(self):
        """测试有效值不会被覆盖"""
        from app.tools.design.utils.magic_project_design_parser import _dict_to_element

        data = {
            "id": "test-image-5",
            "type": "image",
            "name": "Test Image",
            "x": 150,
            "y": 200,
            "width": 400,
            "height": 300,
        }

        element = _dict_to_element(data)

        assert element is not None
        # 确保有效值被保留
        assert element.x == 150
        assert element.y == 200
        assert element.width == 400
        assert element.height == 300

    async def test_parse_mixed_valid_invalid_elements_in_file(self, tmp_path):
        """测试文件中混合有效和无效元素时的解析行为"""
        # 创建项目目录
        project_dir = tmp_path / "test_fallback_project"
        project_dir.mkdir()

        # 创建包含各种不完整元素的文件
        file_content = """window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "design",
  "name": "Fallback Test Project",
  "canvas": {
    "elements": [
      {
        "id": "elem-1",
        "name": "Complete Image",
        "type": "image",
        "x": 100,
        "y": 200,
        "width": 300,
        "height": 200
      },
      {
        "id": "elem-2",
        "type": "rectangle",
        "x": 50,
        "y": 50
      },
      {
        "id": "elem-3",
        "name": "Image Missing Position",
        "type": "image",
        "width": 500,
        "height": 400
      },
      {
        "id": "elem-4",
        "type": "frame"
      }
    ]
  }
}
"""
        file_path = project_dir / "magic.project.js"
        file_path.write_text(file_content, encoding="utf-8")

        # Mock PathManager and read config
        with patch('app.tools.design.utils.magic_project_design_parser.PathManager.get_workspace_dir', return_value=tmp_path):
            config = await read_magic_project_js("test_fallback_project")

        # 验证解析结果
        assert config.version == "1.0.0"
        assert config.name == "Fallback Test Project"

        # 应该有 3 个有效元素（frame 类型不支持会被跳过）
        assert len(config.canvas.elements) == 3

        # 验证第一个元素（完整）
        elem1 = config.canvas.elements[0]
        assert elem1.id == "elem-1"
        assert elem1.x == 100
        assert elem1.y == 200

        # 验证第二个元素（缺少 width/height，自动填充）
        elem2 = config.canvas.elements[1]
        assert elem2.id == "elem-2"
        assert elem2.x == 50
        assert elem2.y == 50
        assert elem2.width == 100.0  # 矩形默认
        assert elem2.height == 100.0
        assert "矩形" in elem2.name  # 自动生成的名称

        # 验证第三个元素（缺少 x/y，自动填充）
        elem3 = config.canvas.elements[2]
        assert elem3.id == "elem-3"
        assert elem3.x == 0.0  # 默认位置
        assert elem3.y == 0.0
        assert elem3.width == 500
        assert elem3.height == 400


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])
