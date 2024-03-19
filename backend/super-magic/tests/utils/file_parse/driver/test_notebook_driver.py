"""Completely real functionality tests for NotebookDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.notebook_driver import NotebookDriver


class TestNotebookDriver:
    """Test NotebookDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = NotebookDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_ipynb(self):
        sample_file = self.sample_files_dir / 'demo.ipynb'

        output_file_path = self.sample_files_dir / 'output/notebook/demo.ipynb.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
