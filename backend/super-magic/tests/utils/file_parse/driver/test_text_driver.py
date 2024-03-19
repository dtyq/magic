"""Completely real functionality tests for TextDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.text_driver import TextDriver


class TestTextDriver:
    """Test TextDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = TextDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_utf8_txt(self):
        sample_file = self.sample_files_dir / 'sample_utf8.txt'

        output_file_path = self.sample_files_dir / 'output/text/sample_utf8.txt.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_gbk_txt(self):
        sample_file = self.sample_files_dir / 'sample_gbk.txt'

        output_file_path = self.sample_files_dir / 'output/text/sample_gbk.txt.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
