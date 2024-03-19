"""Completely real functionality tests for PowerPointDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.powerpoint_driver import PowerPointDriver


class TestPowerPointDriver:
    """Test PowerPointDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = PowerPointDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_pptx(self):
        sample_file = self.sample_files_dir / 'demo_with_images.pptx'

        output_file_path = self.sample_files_dir / 'output/powerpoint/demo_with_images.pptx.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_ppt(self):
        sample_file = self.sample_files_dir / 'demo_with_images.ppt'

        output_file_path = self.sample_files_dir / 'output/powerpoint/demo_with_images.ppt.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
