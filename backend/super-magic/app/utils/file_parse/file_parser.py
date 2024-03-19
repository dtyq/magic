"""Main file parser with driver pattern implementation."""

from pathlib import Path
from typing import Union, List, Optional, Dict, Any, DefaultDict
from collections import defaultdict

from agentlang.logger import get_logger
from .driver.interfaces.file_parser_driver_interface import FileParserDriverInterface, ParseResult, ParseMetadata
from .driver.pdf_ocr_driver import PdfOcrDriver
from .driver.pdf_local_driver import PdfLocalDriver
from .driver.pdf_visual_driver import PdfVisualDriver
from .selector.interfaces.driver_selector_interface import DriverSelectorInterface
from .selector import PdfDriverSelector
from .driver.text_driver import TextDriver
from .driver.word_driver import WordDriver
from .driver.excel_driver import ExcelDriver
from .driver.powerpoint_driver import PowerPointDriver
from .driver.image_ocr_driver import ImageOcrDriver
from .driver.image_visual_driver import ImageVisualDriver
from .driver.notebook_driver import NotebookDriver
from .utils.file_parser_util import get_file_extension

logger = get_logger(__name__)

# Global singleton instance
_file_parser_instance: Optional['FileParser'] = None


class FileParser:
    """Enhanced file parser that manages multiple drivers with simple matching."""

    def __init__(self):
        """Initialize file parser with available drivers."""
        self._drivers: List[FileParserDriverInterface] = []
        self._extension_to_drivers: DefaultDict[str, List[FileParserDriverInterface]] = defaultdict(list)
        self._extension_to_selector: Dict[str, DriverSelectorInterface] = {}
        self._register_all_drivers()
        self._build_extension_index()
        self._register_selectors()

    def _register_all_drivers(self):
        """Register all available file parser drivers."""
        # PDF drivers (Visual has the highest priority, then OCR, then local)
        self._drivers.append(PdfVisualDriver())  # PDF files with visual understanding (highest priority)
        self._drivers.append(PdfOcrDriver())     # PDF files with OCR (Magic Service)
        self._drivers.append(PdfLocalDriver())   # PDF files with local processing (MarkItDown)

        # Core text driver
        self._drivers.append(TextDriver())      # Text files

        # Extended drivers (using MarkItDown integration)
        self._drivers.append(WordDriver())      # Word documents (DOCX)
        self._drivers.append(ExcelDriver())     # Excel and CSV files
        self._drivers.append(PowerPointDriver()) # PowerPoint presentations
        self._drivers.append(NotebookDriver())  # Jupyter Notebooks (IPYNB)
        self._drivers.append(ImageOcrDriver())  # Image files with OCR (higher priority)
        self._drivers.append(ImageVisualDriver()) # Image files with visual understanding

    def _build_extension_index(self):
        """Build index mapping file extensions to lists of candidate drivers for fast lookup."""
        self._extension_to_drivers.clear()

        for driver in self._drivers:
            try:
                extensions = driver.get_supported_extensions()
                for ext in extensions:
                    self._extension_to_drivers[ext].append(driver)
            except Exception as e:
                logger.warning(f"Failed to get extensions from driver {driver}: {e}")
                continue

    def _register_selectors(self):
        """Register intelligent selectors for file types that support it."""
        # Register PDF selector
        self._extension_to_selector['.pdf'] = PdfDriverSelector()

    def _get_selector_for_extension(self, extension: str) -> Optional[DriverSelectorInterface]:
        """Get intelligent selector for the given file extension.

        Args:
            extension: File extension (e.g., '.pdf')

        Returns:
            Optional[DriverSelectorInterface]: Selector instance or None if not available
        """
        return self._extension_to_selector.get(extension)

    def _find_driver(self, file_path: Union[str, Path]) -> List[FileParserDriverInterface]:
        """
        Find all appropriate drivers for the given file using extension-based lookup.

        Args:
            file_path: Path to the file

        Returns:
            List[FileParserDriverInterface]: List of drivers that can parse the file, ordered by priority (highest first)
        """
        extension = get_file_extension(file_path)

        if extension in self._extension_to_drivers:
            # Get all available drivers for this extension
            drivers = self._extension_to_drivers[extension].copy()

            # Sort drivers by priority (highest first) as default order
            drivers.sort(key=lambda driver: driver.get_priority(), reverse=True)
            return drivers

        # No drivers found for this extension
        return []

    async def parse(self, file_path: Union[str, Path], output_file_path: Union[str, Path], driver: Optional[Union[FileParserDriverInterface, List[FileParserDriverInterface]]] = None, **kwargs) -> ParseResult:
        """
        Parse the given file using the specified driver(s) or find appropriate drivers with fallback.

        Args:
            file_path: Path to the file to parse
            output_file_path: Full path where the parsed markdown file will be saved (e.g., /a/b/c.md)
            driver: Optional driver or list of drivers to use for parsing. If a single driver is provided,
                   it will be used directly. If a list is provided, drivers will be tried in order (top to bottom priority).
                   If not provided, will find and try appropriate drivers based on file extension.
            **kwargs: Additional parsing options passed to the driver and selector:
                - enable_visual_understanding (bool): Whether to perform visual understanding on extracted images, default True
                - force_{type}_driver_type (str): Force specific driver type for file type (e.g., force_pdf_driver_type='ocr')
                - {type}_* (various): File-type specific selector parameters (e.g., pdf_visual_max_pages, pdf_ocr_max_pages)
                - Other driver-specific options

        Returns:
            ParseResult: ParseResult with output_file_path and metadata
        """
        # Convert to Path objects for easier manipulation
        file_path_obj = Path(file_path)
        output_file_path_obj = Path(output_file_path)

        # Handle file conflicts and create directory asynchronously
        final_output_file_path = await self._prepare_output_path(output_file_path_obj)

        parse_result = ParseResult(
            metadata=ParseMetadata(
                file_path=str(file_path),
                file_name=file_path_obj.name,
                file_extension=get_file_extension(file_path)
            ),
            success=False,
            output_file_path=final_output_file_path,
            error_message=None
        )

        # Check if file exists
        if not file_path_obj.exists():
            parse_result.error_message = f"File does not exist: {file_path}"
            return parse_result

        parse_result.metadata.file_size = file_path_obj.stat().st_size

        # Determine candidate drivers
        if driver is not None:
            # Use user-specified driver(s)
            candidate_drivers = [driver] if not isinstance(driver, list) else driver
        else:
            # Auto-select drivers based on file extension
            candidate_drivers = self._find_driver(file_path)

            # Apply intelligent driver selection if available
            extension = get_file_extension(file_path)
            selector = self._get_selector_for_extension(extension)
            if selector and candidate_drivers:
                candidate_drivers = await self._apply_intelligent_driver_selection(
                    selector, file_path, candidate_drivers, **kwargs
                )

        # Check if we have any drivers to try
        if not candidate_drivers:
            parse_result.error_message = f"No driver available for file: {file_path}"
            return parse_result

        # Try each candidate driver until one succeeds
        for i, candidate_driver in enumerate(candidate_drivers):
            try:
                logger.info(f"开始解析文件 {file_path_obj.name}，使用驱动: {candidate_driver.__class__.__name__}")

                await candidate_driver.parse(file_path, parse_result, **kwargs)
                parse_result.success = True

                # 统一设置 driver_name
                parse_result.metadata.driver_name = candidate_driver.__class__.__name__

                logger.info(f"成功解析文件 {file_path_obj.name}，驱动: {candidate_driver.__class__.__name__}")

                # Normalize image formatting in markdown file
                if str(parse_result.output_file_path).lower().endswith('.md'):
                    from .utils.markdown_util import MarkdownUtil
                    await MarkdownUtil.normalize_image_formatting(Path(parse_result.output_file_path))

                # Perform visual understanding for .md files with images (if enabled and needed)
                enable_visual_understanding = kwargs.get('enable_visual_understanding', True)
                if (enable_visual_understanding and
                    parse_result.needs_visual_understanding and
                    parse_result.output_images_dir and
                    str(parse_result.output_file_path).lower().endswith('.md')):
                    await self._perform_visual_understanding(parse_result)

                return parse_result
            except Exception as e:
                logger.warning(f"Driver {i+1} failed to parse {file_path}: {e}")
                parse_result.error_message = f"Driver failed with exception: {str(e)}"
                continue

        # All drivers failed
        logger.error(f"All {len(candidate_drivers)} drivers failed to parse {file_path}")
        parse_result.error_message = f"All drivers failed to parse file: {file_path}"
        return parse_result

    async def _apply_intelligent_driver_selection(
        self,
        selector: DriverSelectorInterface,
        file_path: Union[str, Path],
        candidate_drivers: List[FileParserDriverInterface],
        **kwargs
    ) -> List[FileParserDriverInterface]:
        """Apply intelligent driver selection using the provided selector.

        Args:
            selector: Intelligent selector implementation
            file_path: Path to the file
            candidate_drivers: List of available drivers
            **kwargs: Additional options for driver selection (selector-specific)

        Returns:
            List[FileParserDriverInterface]: Reordered drivers based on intelligent selection
        """
        try:
            # Extract selector-specific kwargs
            # Support both generic and type-specific parameter names
            selector_kwargs = {}

            # Generic parameters
            for key in ['visual_max_pages', 'ocr_max_pages', 'large_file_size_mb']:
                if key in kwargs:
                    selector_kwargs[key] = kwargs[key]

            # Type-specific parameters (e.g., pdf_visual_max_pages)
            extension = get_file_extension(file_path).lstrip('.')
            for key, value in kwargs.items():
                if key.startswith(f'{extension}_'):
                    # Convert pdf_visual_max_pages to visual_max_pages
                    generic_key = key[len(extension) + 1:]
                    selector_kwargs[generic_key] = value

            # Get force driver type
            force_driver_type = kwargs.get(f'force_{extension}_driver_type') or kwargs.get('force_driver_type')

            # Select optimal drivers using the interface
            selected_drivers = await selector.select_driver(
                file_path,
                candidate_drivers,
                force_driver_type=force_driver_type,
                **selector_kwargs
            )

            return selected_drivers

        except Exception as e:
            logger.warning(f"Failed to apply intelligent driver selection: {e}")
            # Return original drivers as fallback
            return candidate_drivers

    async def _prepare_output_path(self, requested_path: Path) -> Path:
        """Prepare output file path with conflict resolution and create directory.

        Args:
            requested_path: The requested output file path

        Returns:
            Path: Final output file path (may be renamed if conflicts exist)
        """
        import asyncio

        # Generate unique filename if conflicts exist
        final_path = self._resolve_filename_conflicts(requested_path)

        # Create output directory asynchronously
        output_dir = final_path.parent
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: output_dir.mkdir(parents=True, exist_ok=True)
        )

        return final_path

    def _resolve_filename_conflicts(self, file_path: Path) -> Path:
        """Resolve filename conflicts by adding _copy, _copy2, etc.

        Args:
            file_path: Original file path

        Returns:
            Path: Resolved file path without conflicts
        """
        if not file_path.exists():
            return file_path

        # Extract components
        directory = file_path.parent
        stem = file_path.stem
        suffix = file_path.suffix

        # Try different copy suffixes
        counter = 1
        while True:
            if counter == 1:
                new_name = f"{stem}_copy{suffix}"
            else:
                new_name = f"{stem}_copy{counter}{suffix}"

            new_path = directory / new_name
            if not new_path.exists():
                return new_path

            counter += 1

            # Safety limit to prevent infinite loop
            if counter > 1000:
                raise RuntimeError(f"Too many filename conflicts for {file_path}")

    async def _perform_visual_understanding(self, parse_result: ParseResult) -> None:
        """Perform visual understanding on extracted images and append results to markdown file.

        Args:
            parse_result: ParseResult containing output_file_path and output_images_dir
        """
        try:
            from .utils import ImageAnalysisUtil
            import aiofiles
            import glob

            images_dir = Path(parse_result.output_images_dir)

            # Check if images directory exists and has images
            if not images_dir.exists():
                return

            # Get all image files in the directory
            image_extensions = ['*.png', '*.jpg', '*.jpeg', '*.gif', '*.bmp', '*.webp']
            image_files = []

            for extension in image_extensions:
                image_files.extend(glob.glob(str(images_dir / extension)))
                # Also check for uppercase extensions
                image_files.extend(glob.glob(str(images_dir / extension.upper())))

            if not image_files:
                return

            # Sort image files to maintain consistent order
            image_files.sort()

            # Create general query without specific file names (let batches handle file names)
            general_query = """请分析这些图片的内容，识别其中的文字、图表、表格等信息。对于每张图片，请：
1. 明确标注图片文件名
2. 详细描述内容并提取其中的文字信息
3. 如果图片只是装饰性的（如边框、背景等），请说明

请按文件名顺序进行分析，每张图片的分析结果请以"### [文件名]"开始。"""

            # Perform visual understanding analysis
            analysis_result = await ImageAnalysisUtil.analyze_images_with_visual_understanding(
                image_files,
                query=general_query
            )

            if analysis_result and analysis_result.strip():
                # Append visual understanding results to markdown file
                visual_section = f"\n\n## 图片视觉理解分析\n\n{analysis_result.strip()}\n"

                async with aiofiles.open(parse_result.output_file_path, 'a', encoding='utf-8') as f:
                    await f.write(visual_section)

        except ImportError as e:
            logger.warning(f"ImageAnalysisUtil not available for visual understanding: {e}")
        except Exception as e:
            logger.error(f"Visual understanding failed: {e}")
            # Don't raise the exception to avoid failing the entire parsing process

def get_file_parser() -> FileParser:
    """
    Get the singleton FileParser instance.

    Returns:
        FileParser: The singleton FileParser instance
    """
    global _file_parser_instance

    if _file_parser_instance is None:
        _file_parser_instance = FileParser()

    return _file_parser_instance
