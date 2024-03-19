"""Text processing utilities for file parsing.

This module contains utility classes for text file processing that can be reused
across different text-based file parser drivers. These utilities handle common
tasks like encoding detection, line number formatting, and content pagination.
"""

import aiofiles
from pathlib import Path
from typing import Union, Tuple, List
from dataclasses import dataclass

from agentlang.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TextContent:
    """Structured text content with metadata."""
    content: str
    line_count: int
    character_count: int
    encoding_used: str
    has_line_numbers: bool = False


class TextEncodingHandler:
    """Handler for text file encoding detection and reading with fallback."""

    # Common encodings to try in order
    ENCODING_FALLBACKS = ['utf-8', 'gbk', 'gb2312', 'latin1', 'cp1252']

    @classmethod
    async def read_with_fallback_encoding(
        cls,
        file_path: Union[str, Path],
        offset: int = 0,
        limit: int = -1
    ) -> TextContent:
        """Read text file with encoding fallback and optional pagination.

        Args:
            file_path: Path to the text file
            offset: Starting line number (0-based), default 0
            limit: Number of lines to read (-1 for all), default -1

        Returns:
            TextContent: Structured text content with metadata

        Raises:
            UnicodeDecodeError: If all encoding attempts fail
            FileNotFoundError: If file doesn't exist
        """
        file_path_obj = Path(file_path)

        for encoding in cls.ENCODING_FALLBACKS:
            try:
                content, line_count = await cls._read_with_encoding(
                    file_path_obj, encoding, offset, limit
                )

                logger.debug(f"Successfully read file {file_path} with encoding {encoding}")

                return TextContent(
                    content=content,
                    line_count=line_count,
                    character_count=len(content),
                    encoding_used=encoding
                )

            except UnicodeDecodeError:
                logger.debug(f"Failed to read {file_path} with encoding {encoding}")
                continue

        # If all encodings fail
        raise UnicodeDecodeError(
            f"Failed to read file {file_path} with any of the supported encodings: {cls.ENCODING_FALLBACKS}"
        )

    @classmethod
    async def _read_with_encoding(
        cls,
        file_path: Path,
        encoding: str,
        offset: int,
        limit: int
    ) -> Tuple[str, int]:
        """Read file with specific encoding and pagination.

        Args:
            file_path: Path to the file
            encoding: Encoding to use
            offset: Starting line offset
            limit: Line limit (-1 for unlimited)

        Returns:
            Tuple[str, int]: (content, total_line_count)
        """
        lines = []
        total_line_count = 0

        async with aiofiles.open(file_path, "r", encoding=encoding, errors="replace") as f:
            async for line in f:
                # Count all lines for metadata
                total_line_count += 1

                # Apply pagination logic
                if cls._should_include_line(total_line_count - 1, offset, limit):
                    # Remove trailing newlines and add back a single newline
                    clean_line = line.rstrip('\n\r') + '\n'
                    lines.append(clean_line)

        return "".join(lines), total_line_count

    @staticmethod
    def _should_include_line(line_idx: int, offset: int, limit: int) -> bool:
        """Check if a line should be included based on pagination parameters.

        Args:
            line_idx: Current line index (0-based)
            offset: Starting offset
            limit: Line limit (-1 for unlimited)

        Returns:
            bool: True if line should be included
        """
        if line_idx < offset:
            return False

        if limit > 0 and line_idx >= offset + limit:
            return False

        return True


class LineNumberFormatter:
    """Formatter for adding line numbers to text content."""

    LINE_NUMBER_FORMAT = "{:6}|{}"  # 6-character right-aligned line numbers

    @classmethod
    def format_with_line_numbers(
        cls,
        content: str,
        start_line: int = 1
    ) -> str:
        """Add line numbers to text content.

        Args:
            content: Text content to format
            start_line: Starting line number (1-based), default 1

        Returns:
            str: Content with line numbers added
        """
        if not content:
            return content

        lines = content.splitlines(keepends=True)
        formatted_lines = []

        for i, line in enumerate(lines):
            line_number = start_line + i
            # Remove existing newline, format with line number, add newline back
            clean_line = line.rstrip('\n\r')
            formatted_line = cls.LINE_NUMBER_FORMAT.format(line_number, clean_line) + '\n'
            formatted_lines.append(formatted_line)

        return "".join(formatted_lines)

    @classmethod
    def remove_line_numbers(cls, content: str) -> str:
        """Remove line numbers from formatted content.

        Args:
            content: Content with line numbers

        Returns:
            str: Content without line numbers
        """
        if not content:
            return content

        lines = content.splitlines(keepends=True)
        clean_lines = []

        for line in lines:
            # Check if line starts with line number format
            if '|' in line and line[:7].strip().isdigit():
                # Extract content after the pipe
                pipe_index = line.find('|')
                if pipe_index != -1:
                    clean_line = line[pipe_index + 1:]
                    clean_lines.append(clean_line)
                else:
                    clean_lines.append(line)
            else:
                clean_lines.append(line)

        return "".join(clean_lines)


class TextPaginationHelper:
    """Helper for text content pagination and range operations."""

    @staticmethod
    def calculate_line_range(
        total_lines: int,
        offset: int,
        limit: int
    ) -> Tuple[int, int]:
        """Calculate the actual line range to read.

        Args:
            total_lines: Total number of lines in file
            offset: Starting line offset (0-based)
            limit: Number of lines to read (-1 for unlimited)

        Returns:
            Tuple[int, int]: (start_line, end_line) both 1-based for display
        """
        # Ensure offset is within bounds
        start_line = max(1, offset + 1)  # Convert to 1-based

        if limit <= 0:
            # Read to end
            end_line = total_lines
        else:
            # Read limited number of lines
            end_line = min(total_lines, start_line + limit - 1)

        return start_line, end_line

    @staticmethod
    def get_pagination_metadata(
        total_lines: int,
        offset: int,
        limit: int,
        actual_lines_read: int
    ) -> dict:
        """Get metadata about pagination operation.

        Args:
            total_lines: Total lines in file
            offset: Offset used
            limit: Limit used
            actual_lines_read: Actual number of lines read

        Returns:
            dict: Pagination metadata
        """
        start_line, end_line = TextPaginationHelper.calculate_line_range(
            total_lines, offset, limit
        )

        return {
            'total_lines': total_lines,
            'start_line': start_line,
            'end_line': end_line,
            'lines_read': actual_lines_read,
            'offset': offset,
            'limit': limit,
            'is_partial': actual_lines_read < total_lines
        }
