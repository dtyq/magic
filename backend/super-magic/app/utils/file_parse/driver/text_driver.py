"""Text file parser driver implementation."""

from pathlib import Path
from typing import Union, List, Optional

from agentlang.logger import get_logger
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata
from .interfaces.text_driver_interface import TextDriverInterface
from ..utils.text_processing_utils import TextEncodingHandler, LineNumberFormatter, TextPaginationHelper

logger = get_logger(__name__)


class TextDriver(AbstractDriver, TextDriverInterface):
    """Text file parser driver with simplified architecture using utility classes.

    Supports various text-based file formats with encoding detection, line numbering,
    and pagination functionality. Uses extracted utility classes for better maintainability.
    """

    # Supported text file extensions
    supported_extensions = [
        # Programming languages
        '.txt', '.md', '.py', '.js', '.ts', '.java', '.cpp', '.c',
        '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala',
        '.clj', '.hs', '.elm', '.dart', '.lua', '.r', '.m',

        # Web technologies
        '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.xml', '.svg', '.vue', '.jsx', '.tsx',

        # Configuration and data files
        '.json', '.yaml', '.yml', '.toml', '.ini', '.conf',
        '.cfg', '.properties', '.env', '.gitignore', '.gitattributes',

        # Documentation and markup
        '.rst', '.adoc', '.tex', '.bib',

        # Shell and scripts
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',

        # Log files
        '.log', '.out', '.err',

        # Others
        '.sql', '.graphql', '.proto', '.dockerfile', '.makefile'
    ]

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse text file and update the provided ParseResult object.

        Args:
            file_path: Path to the text file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - offset (int): Starting line number (0-based), default 0
                - limit (int): Number of lines to read (-1 for all), default -1
                - include_line_numbers (bool): Whether to include line numbers, default True
        """
        offset = kwargs.get('offset', 0)
        limit = kwargs.get('limit', -1)
        include_line_numbers = kwargs.get('include_line_numbers', True)

        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        logger.info(f"Parsing text file: {local_file_path}")

        # Use encoding handler to read file with fallback encoding
        text_content = await TextEncodingHandler.read_with_fallback_encoding(
            local_file_path, offset, limit
        )

        # Apply line number formatting if requested
        if include_line_numbers:
            # Calculate starting line number for display
            start_line = offset + 1 if offset > 0 else 1
            formatted_content = LineNumberFormatter.format_with_line_numbers(
                text_content.content, start_line
            )
        else:
            formatted_content = text_content.content

        # Add filename as main title and write to file
        from ..utils.markdown_util import MarkdownUtil
        file_path_obj = Path(file_path)

        final_markdown_content = MarkdownUtil.add_filename_title(formatted_content, file_path_obj.name)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        # Update metadata
        result.metadata.conversion_method = 'text_reader'

        # Get pagination metadata
        pagination_info = TextPaginationHelper.get_pagination_metadata(
            text_content.line_count, offset, limit,
            len(text_content.content.splitlines())
        )

        result.metadata.additional_info = {
            'encoding_used': text_content.encoding_used,
            'total_line_count': text_content.line_count,
            'character_count': text_content.character_count,
            'include_line_numbers': include_line_numbers,
            'pagination': pagination_info
        }

        logger.info(f"Successfully parsed text file: {local_file_path} "
                   f"(encoding: {text_content.encoding_used}, lines: {text_content.line_count})")
