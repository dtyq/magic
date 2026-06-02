"""Excel file parser driver implementation."""

import asyncio
from pathlib import Path
from typing import Union, List, Optional

from agentlang.logger import get_logger
from app.utils.document_parse.constants import SPREADSHEET_EXTENSIONS
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata
from .interfaces.excel_driver_interface import ExcelDriverInterface

logger = get_logger(__name__)


class ExcelDriver(AbstractDriver, ExcelDriverInterface):
    """Excel file parser driver using MarkItDown integration.

    Supports spreadsheet-like office formats through existing converters.

    - .xlsx/.xls/.csv/.tsv: Direct MarkItDown processing
    - Other Excel/WPS/OpenDocument/template/macro formats: Converted to .xlsx
      using LibreOffice, then processed. Macros are never executed.
    """

    # Supported Excel and CSV file extensions
    supported_extensions = sorted(SPREADSHEET_EXTENSIONS)

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse Excel/CSV file and update the provided ParseResult object.

        Args:
            file_path: Path to the Excel/CSV file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - offset (int): Starting offset for conversion, default 0
                - limit (int): Maximum items to convert (-1 for unlimited), default -1
                - display_limit (int): Maximum rows to display (None for no limit), default None
        """
        file_path_obj = Path(file_path)
        original_format = file_path_obj.suffix.lower().lstrip(".")
        direct_formats = {'.xls', '.xlsx', '.csv', '.tsv'}
        requires_conversion = file_path_obj.suffix.lower() not in direct_formats

        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        converted_file_path = None
        try:
            if requires_conversion:
                from ..utils.libreoffice_util import LibreOfficeUtil
                converted_file_path = await LibreOfficeUtil.convert_document(
                    local_file_path, 'xlsx', 'converted'
                )
                processing_file_path = converted_file_path
                conversion_method = 'libreoffice_then_markitdown'
            else:
                processing_file_path = local_file_path
                conversion_method = 'markitdown'

            # Use base class MarkItDown functionality to convert file
            markdown_content = await self._convert_with_markitdown(
                processing_file_path,
                offset=kwargs.get('offset', 0),
                limit=kwargs.get('limit', -1),
                display_limit=kwargs.get('display_limit', None)  # None表示不限制显示行数
            )

            if not markdown_content:
                raise ValueError("MarkItDown conversion returned empty content")

            # Clean up problematic values that appear in cells
            cleaned_content = self._clean_problematic_values(markdown_content)

            # Add filename as main title and adjust content heading levels
            from ..utils.markdown_util import MarkdownUtil

            final_markdown_content = MarkdownUtil.add_filename_title(cleaned_content, file_path_obj.name)
            await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

            # Update result metadata
            result.metadata.conversion_method = conversion_method
            result.metadata.additional_info = {
                'spreadsheet_format': original_format,
                'original_format': original_format,
                'conversion_required': requires_conversion,
                'character_count': len(cleaned_content),
                'table_count': cleaned_content.count('|') // 3 if '|' in cleaned_content else 0  # Rough estimate
            }
        finally:
            if converted_file_path:
                try:
                    loop = asyncio.get_event_loop()
                    file_exists = await loop.run_in_executor(None, converted_file_path.exists)
                    if file_exists:
                        await loop.run_in_executor(None, converted_file_path.unlink)
                        logger.debug(f"Cleaned up temporary file: {converted_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file {converted_file_path}: {e}")

    def _clean_problematic_values(self, markdown_content: str) -> str:
        """Clean up problematic values from Excel markdown content.

        MarkItDown converts empty Excel cells and special values to various
        representations that are not user-friendly. This method uses simple
        string replacement to clean them up.

        Handles:
        - Empty values: NaN, null, None, NULL, undefined, nan → (empty)
        - Infinity values: Inf, -Inf, Infinity, -Infinity → ∞, -∞
        - Boolean values: True/False, TRUE/FALSE, true/false → ✓/✗

        Args:
            markdown_content: Raw markdown content from MarkItDown

        Returns:
            str: Cleaned markdown content with problematic values replaced
        """
        # Simple string replacement for all problematic values
        cleaned_content = markdown_content

        # Replace empty/null values with empty string
        empty_values = ['NaN', 'null', 'None', 'NULL', 'undefined', 'nan']
        for value in empty_values:
            cleaned_content = cleaned_content.replace(value, '')

        # Replace infinity values with symbols
        infinity_replacements = {
            'Inf': '∞',
            '-Inf': '-∞',
            'Infinity': '∞',
            '-Infinity': '-∞',
            'inf': '∞',
            '-inf': '-∞'
        }
        for old_value, new_value in infinity_replacements.items():
            cleaned_content = cleaned_content.replace(old_value, new_value)

        # Replace boolean values with symbols
        boolean_replacements = {
            'True': '✓',
            'False': '✗',
            'TRUE': '✓',
            'FALSE': '✗',
            'true': '✓',
            'false': '✗'
        }
        for old_value, new_value in boolean_replacements.items():
            cleaned_content = cleaned_content.replace(old_value, new_value)

        return cleaned_content
