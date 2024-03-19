"""Completely real functionality tests for WordDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.word_driver import WordDriver


class TestWordDriver:
    """Test WordDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = WordDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_docx(self):
        sample_file = self.sample_files_dir / 'demo.docx'

        output_file_path = self.sample_files_dir / 'output/word/demo.docx.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_doc(self):
        sample_file = self.sample_files_dir / 'demo.doc'

        output_file_path = self.sample_files_dir / 'output/word/demo.doc.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
