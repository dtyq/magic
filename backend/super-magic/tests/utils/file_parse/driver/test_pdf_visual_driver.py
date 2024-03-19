"""Completely real functionality tests for PdfVisualDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.pdf_visual_driver import PdfVisualDriver


class TestPdfVisualDriver:
    """Test PdfVisualDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = PdfVisualDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_pdf(self):
        sample_file = self.sample_files_dir / 'dummy.pdf'

        output_file_path = self.sample_files_dir / 'output/pdf_visual/dummy.pdf.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_pdf_with_images(self):
        sample_file = self.sample_files_dir / 'demo_with_image.pdf'

        output_file_path = self.sample_files_dir / 'output/pdf_visual/demo_with_image.pdf.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
