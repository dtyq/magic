"""Completely real functionality tests for ImageVisualDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.image_visual_driver import ImageVisualDriver


class TestImageVisualDriver:
    """Test ImageVisualDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = ImageVisualDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_jpg(self):
        sample_file = self.sample_files_dir / 'demo.jpg'

        output_file_path = self.sample_files_dir / 'output/image/demo.jpg.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
