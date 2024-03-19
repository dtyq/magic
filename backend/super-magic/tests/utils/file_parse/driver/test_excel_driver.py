"""Completely real functionality tests for ExcelDriver - NO MOCKS ALLOWED."""

import pytest
from pathlib import Path

from app.utils.file_parse import get_file_parser
from app.utils.file_parse.driver.excel_driver import ExcelDriver


class TestExcelDriver:
    """Test ExcelDriver with completely real file parsing - NO MOCKS."""

    def setup_method(self):
        self.file_parser = get_file_parser()
        self.driver = ExcelDriver()
        self.sample_files_dir = Path(__file__).parent.parent / 'test_file'

    @pytest.mark.asyncio
    async def test_parse_xlsx(self):
        sample_file = self.sample_files_dir / 'demo.xlsx'

        output_file_path = self.sample_files_dir / 'output/excel/demo.xlsx.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_xls(self):
        sample_file = self.sample_files_dir / 'demo.xls'

        output_file_path = self.sample_files_dir / 'output/excel/demo.xls.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_parse_csv(self):
        sample_file = self.sample_files_dir / 'demo.csv'

        output_file_path = self.sample_files_dir / 'output/excel/demo.csv.md'

        result = await self.file_parser.parse(str(sample_file), output_file_path, driver=self.driver)

        print(result)

        assert result.success is True
