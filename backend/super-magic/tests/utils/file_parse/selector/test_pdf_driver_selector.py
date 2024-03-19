"""Unit tests for PDF driver selector."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch
import tempfile

from app.utils.file_parse.selector import PdfDriverSelector


class TestPdfDriverSelector:
    """Test cases for PdfDriverSelector class."""

    @pytest.fixture
    def selector(self):
        """Create a selector instance for testing."""
        return PdfDriverSelector()

    @pytest.fixture
    def mock_drivers(self):
        """Create mock driver instances."""
        visual_driver = Mock()
        visual_driver.__class__.__name__ = 'PdfVisualDriver'
        visual_driver.get_priority.return_value = 3

        ocr_driver = Mock()
        ocr_driver.__class__.__name__ = 'PdfOcrDriver'
        ocr_driver.get_priority.return_value = 2

        local_driver = Mock()
        local_driver.__class__.__name__ = 'PdfLocalDriver'
        local_driver.get_priority.return_value = 1

        return [visual_driver, ocr_driver, local_driver]

    def test_singleton_pattern(self):
        """Test that multiple selector instances are independent (no singleton in selector itself)."""
        selector1 = PdfDriverSelector()
        selector2 = PdfDriverSelector()

        # Selectors are now instantiated per file parser, not globally singleton
        assert selector1 is not selector2

    def test_small_pdf_low_text_density(self, selector):
        """Test driver selection for small PDF with low text density."""
        pdf_info = {
            'page_count': 5,
            'file_size_mb': 2.0,
            'has_images': True,
            'text_density': 'low',
            'avg_chars_per_page': 300
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'visual'

    def test_small_pdf_high_text_density(self, selector):
        """Test driver selection for small PDF with high text density - should use OCR."""
        pdf_info = {
            'page_count': 8,
            'file_size_mb': 3.0,
            'has_images': False,
            'text_density': 'high',
            'avg_chars_per_page': 2500
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        # High text density should use OCR instead of visual
        assert driver_type == 'ocr'

    def test_small_pdf_medium_text_density(self, selector):
        """Test driver selection for small PDF with medium text density."""
        pdf_info = {
            'page_count': 7,
            'file_size_mb': 2.5,
            'has_images': True,
            'text_density': 'medium',
            'avg_chars_per_page': 1200
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        # Medium text density within visual threshold should use visual
        assert driver_type == 'visual'

    def test_medium_pdf(self, selector):
        """Test driver selection for medium PDF (11-50 pages)."""
        pdf_info = {
            'page_count': 30,
            'file_size_mb': 8.0,
            'has_images': True,
            'text_density': 'medium',
            'avg_chars_per_page': 1000
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'ocr'

    def test_medium_pdf_high_text_density(self, selector):
        """Test driver selection for medium PDF with high text density."""
        pdf_info = {
            'page_count': 25,
            'file_size_mb': 5.0,
            'has_images': False,
            'text_density': 'high',
            'avg_chars_per_page': 2800
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        # High text density with medium page count should use OCR
        assert driver_type == 'ocr'

    def test_large_pdf(self, selector):
        """Test driver selection for large PDF (50+ pages)."""
        pdf_info = {
            'page_count': 80,
            'file_size_mb': 15.0,
            'has_images': True,
            'text_density': 'high',
            'avg_chars_per_page': 2500
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'local'

    def test_large_file_size(self, selector):
        """Test driver selection for very large file (>100 MB)."""
        pdf_info = {
            'page_count': 10,
            'file_size_mb': 150.0,
            'has_images': True,
            'text_density': 'medium',
            'avg_chars_per_page': 1000
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        # Large files should use local driver regardless of page count
        assert driver_type == 'local'

    def test_edge_case_exactly_visual_max(self, selector):
        """Test edge case at visual max pages threshold."""
        pdf_info = {
            'page_count': 10,
            'file_size_mb': 5.0,
            'has_images': True,
            'text_density': 'low',
            'avg_chars_per_page': 400
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'visual'

    def test_edge_case_exactly_ocr_max(self, selector):
        """Test edge case at OCR max pages threshold."""
        pdf_info = {
            'page_count': 50,
            'file_size_mb': 10.0,
            'has_images': True,
            'text_density': 'medium',
            'avg_chars_per_page': 1200
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'ocr'

    def test_filter_drivers_by_type_visual(self, selector, mock_drivers):
        """Test filtering drivers by visual type with fallback chain: Visual → Local."""
        filtered = selector._filter_drivers_by_type(mock_drivers, 'visual')

        # Visual driver should have Local as fallback
        assert len(filtered) == 2
        assert filtered[0].__class__.__name__ == 'PdfVisualDriver'
        assert filtered[1].__class__.__name__ == 'PdfLocalDriver'

    def test_filter_drivers_by_type_ocr(self, selector, mock_drivers):
        """Test filtering drivers by OCR type with fallback chain: OCR → Local."""
        filtered = selector._filter_drivers_by_type(mock_drivers, 'ocr')

        # OCR driver should have Local as fallback
        assert len(filtered) == 2
        assert filtered[0].__class__.__name__ == 'PdfOcrDriver'
        assert filtered[1].__class__.__name__ == 'PdfLocalDriver'

    def test_filter_drivers_by_type_local(self, selector, mock_drivers):
        """Test filtering drivers by local type with no fallback."""
        filtered = selector._filter_drivers_by_type(mock_drivers, 'local')

        # Local driver should have no fallback
        assert len(filtered) == 1
        assert filtered[0].__class__.__name__ == 'PdfLocalDriver'

    def test_filter_drivers_by_type_invalid(self, selector, mock_drivers):
        """Test filtering with invalid type returns all drivers."""
        filtered = selector._filter_drivers_by_type(mock_drivers, 'invalid_type')

        assert len(filtered) == 3

    def test_reorder_drivers_visual_first(self, selector, mock_drivers):
        """Test reordering drivers with visual driver first with fallback chain: Visual → Local."""
        reordered = selector._reorder_drivers(mock_drivers, 'visual')

        # Visual should only fallback to Local (no OCR in chain)
        assert len(reordered) == 2
        assert reordered[0].__class__.__name__ == 'PdfVisualDriver'
        assert reordered[1].__class__.__name__ == 'PdfLocalDriver'

    def test_reorder_drivers_ocr_first(self, selector, mock_drivers):
        """Test reordering drivers with OCR driver first with fallback chain: OCR → Local."""
        reordered = selector._reorder_drivers(mock_drivers, 'ocr')

        # OCR should only fallback to Local (no Visual in chain)
        assert len(reordered) == 2
        assert reordered[0].__class__.__name__ == 'PdfOcrDriver'
        assert reordered[1].__class__.__name__ == 'PdfLocalDriver'

    def test_reorder_drivers_local_first(self, selector, mock_drivers):
        """Test reordering drivers with local driver first with no fallback."""
        reordered = selector._reorder_drivers(mock_drivers, 'local')

        # Local should have no fallback
        assert len(reordered) == 1
        assert reordered[0].__class__.__name__ == 'PdfLocalDriver'

    @pytest.mark.asyncio
    async def test_select_driver_with_force_type_visual(self, selector, mock_drivers):
        """Test driver selection with forced visual type."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            selected = await selector.select_driver(
                temp_path,
                mock_drivers,
                force_driver_type='visual'
            )

            # Visual should have Local as fallback
            assert len(selected) == 2
            assert selected[0].__class__.__name__ == 'PdfVisualDriver'
            assert selected[1].__class__.__name__ == 'PdfLocalDriver'
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_select_driver_with_force_type_ocr(self, selector, mock_drivers):
        """Test driver selection with forced OCR type."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            selected = await selector.select_driver(
                temp_path,
                mock_drivers,
                force_driver_type='ocr'
            )

            # OCR should have Local as fallback
            assert len(selected) == 2
            assert selected[0].__class__.__name__ == 'PdfOcrDriver'
            assert selected[1].__class__.__name__ == 'PdfLocalDriver'
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_select_driver_with_force_type_local(self, selector, mock_drivers):
        """Test driver selection with forced local type."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            selected = await selector.select_driver(
                temp_path,
                mock_drivers,
                force_driver_type='local'
            )

            # Local should have no fallback
            assert len(selected) == 1
            assert selected[0].__class__.__name__ == 'PdfLocalDriver'
        finally:
            if temp_path.exists():
                temp_path.unlink()

    @pytest.mark.asyncio
    async def test_select_driver_nonexistent_file(self, selector, mock_drivers):
        """Test driver selection with non-existent file returns all drivers."""
        fake_path = Path('/nonexistent/file.pdf')

        selected = await selector.select_driver(
            fake_path,
            mock_drivers
        )

        assert len(selected) == 3

    @pytest.mark.asyncio
    async def test_select_driver_custom_thresholds(self, selector, mock_drivers):
        """Test driver selection with custom thresholds."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            with patch.object(selector, 'analyze_file') as mock_analyze:
                mock_analyze.return_value = {
                    'page_count': 15,
                    'file_size_mb': 5.0,
                    'has_images': True,
                    'text_density': 'medium',
                    'avg_chars_per_page': 1000
                }

                # With visual_max_pages=10, 15 pages should use OCR
                selected = await selector.select_driver(
                    temp_path,
                    mock_drivers,
                    visual_max_pages=10,
                    ocr_max_pages=50
                )
                assert len(selected) == 2  # OCR + Local fallback
                assert selected[0].__class__.__name__ == 'PdfOcrDriver'
                assert selected[1].__class__.__name__ == 'PdfLocalDriver'

                # With visual_max_pages=20, 15 pages should use Visual
                selected = await selector.select_driver(
                    temp_path,
                    mock_drivers,
                    visual_max_pages=20,
                    ocr_max_pages=50
                )
                assert len(selected) == 2  # Visual + Local fallback
                assert selected[0].__class__.__name__ == 'PdfVisualDriver'
                assert selected[1].__class__.__name__ == 'PdfLocalDriver'
        finally:
            if temp_path.exists():
                temp_path.unlink()

    def test_high_text_density_priority(self, selector):
        """Test that high text density gets OCR even for small page counts."""
        pdf_info = {
            'page_count': 5,
            'file_size_mb': 2.0,
            'has_images': False,
            'text_density': 'high',
            'avg_chars_per_page': 3000
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'ocr'

    def test_low_text_density_priority(self, selector):
        """Test that low text density gets visual for small page counts."""
        pdf_info = {
            'page_count': 5,
            'file_size_mb': 2.0,
            'has_images': True,
            'text_density': 'low',
            'avg_chars_per_page': 200
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'visual'

    def test_decision_priority_order(self, selector):
        """Test that decision priority order is correct: file size > text density > page count."""
        pdf_info = {
            'page_count': 5,
            'file_size_mb': 150.0,
            'has_images': True,
            'text_density': 'low',
            'avg_chars_per_page': 200
        }

        driver_type = selector.determine_optimal_driver_type(
            pdf_info,
            visual_max_pages=10,
            ocr_max_pages=50,
            large_file_size_mb=100
        )

        assert driver_type == 'local'

    def test_fallback_chain_max_length(self, selector, mock_drivers):
        """Test that fallback chain has maximum length of 2 (primary + Local)."""
        # Test Visual fallback chain
        visual_chain = selector._reorder_drivers(mock_drivers, 'visual')
        assert len(visual_chain) <= 2, "Visual fallback chain should have max 2 drivers"

        # Test OCR fallback chain
        ocr_chain = selector._reorder_drivers(mock_drivers, 'ocr')
        assert len(ocr_chain) <= 2, "OCR fallback chain should have max 2 drivers"

        # Test Local fallback chain
        local_chain = selector._reorder_drivers(mock_drivers, 'local')
        assert len(local_chain) == 1, "Local should have no fallback"

    def test_no_cross_fallback_between_visual_and_ocr(self, selector, mock_drivers):
        """Test that Visual and OCR do not fallback to each other."""
        # Visual chain should not contain OCR
        visual_chain = selector._reorder_drivers(mock_drivers, 'visual')
        visual_chain_names = [d.__class__.__name__ for d in visual_chain]
        assert 'PdfOcrDriver' not in visual_chain_names, "Visual should not fallback to OCR"

        # OCR chain should not contain Visual
        ocr_chain = selector._reorder_drivers(mock_drivers, 'ocr')
        ocr_chain_names = [d.__class__.__name__ for d in ocr_chain]
        assert 'PdfVisualDriver' not in ocr_chain_names, "OCR should not fallback to Visual"

    def test_visual_fallback_to_local_only(self, selector, mock_drivers):
        """Test that Visual driver only fallbacks to Local driver."""
        chain = selector._reorder_drivers(mock_drivers, 'visual')

        assert len(chain) == 2
        assert chain[0].__class__.__name__ == 'PdfVisualDriver'
        assert chain[1].__class__.__name__ == 'PdfLocalDriver'

    def test_ocr_fallback_to_local_only(self, selector, mock_drivers):
        """Test that OCR driver only fallbacks to Local driver."""
        chain = selector._reorder_drivers(mock_drivers, 'ocr')

        assert len(chain) == 2
        assert chain[0].__class__.__name__ == 'PdfOcrDriver'
        assert chain[1].__class__.__name__ == 'PdfLocalDriver'

    def test_local_no_fallback(self, selector, mock_drivers):
        """Test that Local driver has no fallback."""
        chain = selector._reorder_drivers(mock_drivers, 'local')

        assert len(chain) == 1
        assert chain[0].__class__.__name__ == 'PdfLocalDriver'

    def test_filter_visual_without_local_driver(self, selector):
        """Test filtering Visual when Local driver is not available."""
        # Create mock drivers without Local driver
        visual_driver = Mock()
        visual_driver.__class__.__name__ = 'PdfVisualDriver'
        ocr_driver = Mock()
        ocr_driver.__class__.__name__ = 'PdfOcrDriver'

        drivers = [visual_driver, ocr_driver]

        filtered = selector._filter_drivers_by_type(drivers, 'visual')

        # Should only return Visual driver (no Local available)
        assert len(filtered) == 1
        assert filtered[0].__class__.__name__ == 'PdfVisualDriver'

    def test_filter_ocr_without_local_driver(self, selector):
        """Test filtering OCR when Local driver is not available."""
        # Create mock drivers without Local driver
        visual_driver = Mock()
        visual_driver.__class__.__name__ = 'PdfVisualDriver'
        ocr_driver = Mock()
        ocr_driver.__class__.__name__ = 'PdfOcrDriver'

        drivers = [visual_driver, ocr_driver]

        filtered = selector._filter_drivers_by_type(drivers, 'ocr')

        # Should only return OCR driver (no Local available)
        assert len(filtered) == 1
        assert filtered[0].__class__.__name__ == 'PdfOcrDriver'

    @pytest.mark.asyncio
    async def test_auto_selection_returns_correct_chain(self, selector, mock_drivers):
        """Test that auto selection returns proper fallback chain."""
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(b'%PDF-1.4\n')

        try:
            with patch.object(selector, 'analyze_file') as mock_analyze:
                # Small PDF should select Visual
                mock_analyze.return_value = {
                    'page_count': 5,
                    'file_size_mb': 2.0,
                    'has_images': True,
                    'text_density': 'low',
                    'avg_chars_per_page': 300
                }

                selected = await selector.select_driver(temp_path, mock_drivers)
                assert len(selected) == 2
                assert selected[0].__class__.__name__ == 'PdfVisualDriver'
                assert selected[1].__class__.__name__ == 'PdfLocalDriver'

                # Large PDF should select Local only
                mock_analyze.return_value = {
                    'page_count': 100,
                    'file_size_mb': 20.0,
                    'has_images': True,
                    'text_density': 'high',
                    'avg_chars_per_page': 2500
                }

                selected = await selector.select_driver(temp_path, mock_drivers)
                assert len(selected) == 1
                assert selected[0].__class__.__name__ == 'PdfLocalDriver'
        finally:
            if temp_path.exists():
                temp_path.unlink()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
