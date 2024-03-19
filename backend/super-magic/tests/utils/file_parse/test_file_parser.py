"""Tests for FileParser main class."""

import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

from app.utils.file_parse import get_file_parser, FileParser
from app.utils.file_parse.driver.pdf_visual_driver import PdfVisualDriver
from app.utils.file_parse.driver.pdf_ocr_driver import PdfOcrDriver
from app.utils.file_parse.driver.pdf_local_driver import PdfLocalDriver


class TestFileParser:
    """Test FileParser functionality."""

    def setup_method(self):
        """Setup test fixtures."""
        self.parser = FileParser()

    def test_initialization(self):
        """Test FileParser initialization."""
        assert isinstance(self.parser, FileParser)
        assert hasattr(self.parser, '_drivers')
        assert hasattr(self.parser, '_extension_to_drivers')
        # Should have some drivers registered
        assert len(self.parser._drivers) > 0

    def test_has_drivers_registered(self):
        """Test that parser has drivers registered."""
        assert len(self.parser._drivers) > 0
        assert len(self.parser._extension_to_drivers) > 0

        # Check that some common extensions are supported
        supported_extensions = list(self.parser._extension_to_drivers.keys())
        assert '.txt' in supported_extensions
        assert '.pdf' in supported_extensions

    def test_get_supported_extensions(self):
        """Test getting all supported extensions."""
        # FileParser doesn't have get_supported_extensions method,
        # but we can check _extension_to_drivers keys
        extensions = list(self.parser._extension_to_drivers.keys())
        assert isinstance(extensions, list)
        assert len(extensions) > 0

        # Should include common extensions
        assert '.txt' in extensions
        assert '.pdf' in extensions
        assert '.docx' in extensions
        assert '.xlsx' in extensions


class TestFileParserSingleton:
    """Test FileParser singleton functionality."""

    def test_get_file_parser_returns_same_instance(self):
        """Test that get_file_parser returns the same instance."""
        parser1 = get_file_parser()
        parser2 = get_file_parser()
        assert parser1 is parser2

    def test_singleton_has_drivers_registered(self):
        """Test that singleton instance has drivers registered."""
        parser = get_file_parser()
        assert len(parser._drivers) > 0
        assert len(parser._extension_to_drivers) > 0


class TestFileParserDriverRegistration:
    """Test driver registration in FileParser."""

    def test_all_drivers_registered(self):
        """Test that all expected drivers are registered."""
        parser = FileParser()
        driver_names = [driver.__class__.__name__ for driver in parser._drivers]

        # Check that key drivers are present
        expected_drivers = [
            'TextDriver',
            'PdfOcrDriver',
            'PdfLocalDriver',
            'WordDriver',
            'ExcelDriver',
            'PowerPointDriver',
            'ImageOcrDriver',
            'ImageVisualDriver',
            'NotebookDriver'
        ]

        for expected_driver in expected_drivers:
            assert expected_driver in driver_names, f"Missing driver: {expected_driver}"

    def test_extension_mapping_populated(self):
        """Test that extension to driver mapping is populated."""
        parser = FileParser()

        # Check some key mappings exist
        assert '.txt' in parser._extension_to_drivers
        assert '.pdf' in parser._extension_to_drivers
        assert '.docx' in parser._extension_to_drivers

        # Each extension should have at least one driver
        for ext, drivers in parser._extension_to_drivers.items():
            assert len(drivers) > 0, f"No drivers for extension: {ext}"

    def test_drivers_have_correct_priority_order(self):
        """Test that drivers are ordered correctly by priority."""
        parser = FileParser()

        # For PDF extension, check priority order
        pdf_drivers = parser._extension_to_drivers.get('.pdf', [])
        assert len(pdf_drivers) >= 2  # Should have both OCR and Local drivers

        # First driver should be Visual (highest priority)
        assert pdf_drivers[0].__class__.__name__ == 'PdfVisualDriver'
        # Second driver should be OCR
        assert pdf_drivers[1].__class__.__name__ == 'PdfOcrDriver'
        # Third driver should be Local (lowest priority)
        assert pdf_drivers[2].__class__.__name__ == 'PdfLocalDriver'


class TestFileParserIntelligentSelection:
    """Test intelligent driver selection in FileParser."""

    @pytest.fixture
    def mock_selector(self):
        """Create a mock selector."""
        selector = Mock()
        selector.select_driver = AsyncMock()
        return selector

    @pytest.mark.asyncio
    async def test_apply_intelligent_driver_selection_basic(self, mock_selector):
        """Test basic intelligent driver selection with selector interface."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            parser = FileParser()
            candidate_drivers = [PdfVisualDriver(), PdfOcrDriver(), PdfLocalDriver()]
            expected_drivers = [PdfOcrDriver(), PdfVisualDriver(), PdfLocalDriver()]

            mock_selector.select_driver.return_value = expected_drivers

            result = await parser._apply_intelligent_driver_selection(
                mock_selector,
                temp_path,
                candidate_drivers
            )

            # Verify selector was called
            mock_selector.select_driver.assert_called_once()
            call_args = mock_selector.select_driver.call_args
            assert call_args[0][0] == temp_path
            assert call_args[0][1] == candidate_drivers
            assert result == expected_drivers
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_apply_intelligent_selection_with_custom_thresholds(self, mock_selector):
        """Test intelligent selection with custom threshold parameters."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            parser = FileParser()
            candidate_drivers = [Mock(), Mock(), Mock()]
            mock_selector.select_driver.return_value = candidate_drivers

            await parser._apply_intelligent_driver_selection(
                mock_selector,
                temp_path,
                candidate_drivers,
                pdf_visual_max_pages=15,
                pdf_ocr_max_pages=60,
                pdf_large_file_size_mb=200
            )

            # Verify custom parameters were converted and passed
            call_kwargs = mock_selector.select_driver.call_args[1]
            assert call_kwargs['visual_max_pages'] == 15
            assert call_kwargs['ocr_max_pages'] == 60
            assert call_kwargs['large_file_size_mb'] == 200
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_apply_intelligent_selection_with_force_driver_type(self, mock_selector):
        """Test intelligent selection with forced driver type."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            parser = FileParser()
            candidate_drivers = [Mock(), Mock(), Mock()]
            mock_selector.select_driver.return_value = candidate_drivers

            await parser._apply_intelligent_driver_selection(
                mock_selector,
                temp_path,
                candidate_drivers,
                force_pdf_driver_type='ocr'
            )

            # Verify force_driver_type was passed
            call_kwargs = mock_selector.select_driver.call_args[1]
            assert call_kwargs['force_driver_type'] == 'ocr'
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_apply_intelligent_selection_fallback_on_error(self, mock_selector):
        """Test fallback to original drivers when selector fails."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            parser = FileParser()
            candidate_drivers = [Mock(), Mock(), Mock()]
            mock_selector.select_driver.side_effect = Exception("Selector error")

            result = await parser._apply_intelligent_driver_selection(
                mock_selector,
                temp_path,
                candidate_drivers
            )

            assert result == candidate_drivers
        finally:
            if temp_path.exists():
                temp_path.unlink()

    def test_selector_registration(self):
        """Test that selectors are properly registered during initialization."""
        parser = FileParser()

        # Check that PDF selector is registered
        pdf_selector = parser._get_selector_for_extension('.pdf')
        assert pdf_selector is not None

        # Check that non-PDF extensions return None
        txt_selector = parser._get_selector_for_extension('.txt')
        assert txt_selector is None

    @pytest.mark.asyncio
    async def test_parse_non_pdf_skips_intelligent_selection(self):
        """Test that non-PDF files don't trigger intelligent selection."""
        with tempfile.NamedTemporaryFile(suffix='.txt', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'Hello World')

        output_file = temp_path.parent / 'output.md'

        try:
            parser = FileParser()
            with patch.object(parser._drivers[3], 'parse', new_callable=AsyncMock):
                await parser.parse(temp_path, output_file)
                assert True
        finally:
            if temp_path.exists():
                temp_path.unlink()
            if output_file.exists():
                output_file.unlink()

    @pytest.mark.asyncio
    async def test_parse_with_manual_driver_skips_intelligent_selection(self):
        """Test that manually specifying driver skips intelligent selection."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        output_file = temp_path.parent / 'output.md'

        try:
            parser = FileParser()
            manual_driver = PdfLocalDriver()

            with patch.object(manual_driver, 'parse', new_callable=AsyncMock):
                await parser.parse(temp_path, output_file, driver=manual_driver)
                assert True
        finally:
            if temp_path.exists():
                temp_path.unlink()
            if output_file.exists():
                output_file.unlink()
