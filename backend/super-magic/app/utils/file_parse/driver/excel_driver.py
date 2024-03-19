"""Excel file parser driver implementation."""

from pathlib import Path
from typing import Union, List, Optional

from agentlang.logger import get_logger
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata
from .interfaces.excel_driver_interface import ExcelDriverInterface

logger = get_logger(__name__)


class ExcelDriver(AbstractDriver, ExcelDriverInterface):
    """Excel file parser driver using MarkItDown integration.

    Supports Excel (.xlsx, .xls) and CSV files through existing converters.
    Uses the ExcelConverter and CSVConverter plugins from MarkItDown.
    """

    # Supported Excel and CSV file extensions
    supported_extensions = ['.xls', '.xlsx', '.csv']

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
        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        # Use base class MarkItDown functionality to convert file
        markdown_content = await self._convert_with_markitdown(
            local_file_path,
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
        file_path_obj = Path(file_path)

        final_markdown_content = MarkdownUtil.add_filename_title(cleaned_content, file_path_obj.name)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        # Update result metadata
        result.metadata.conversion_method = 'markitdown'
        result.metadata.additional_info = {
            'spreadsheet_format': local_file_path.suffix.lower(),
            'character_count': len(cleaned_content),
            'table_count': cleaned_content.count('|') // 3 if '|' in cleaned_content else 0  # Rough estimate
        }

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
