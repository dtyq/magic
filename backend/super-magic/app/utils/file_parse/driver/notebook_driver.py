"""Jupyter Notebook file parser driver implementation."""

from pathlib import Path
from typing import Union

from agentlang.logger import get_logger
from .abstract_driver import AbstractDriver
from .interfaces.file_parser_driver_interface import ParseResult, ParseMetadata
from .interfaces.notebook_driver_interface import NotebookDriverInterface

logger = get_logger(__name__)


class NotebookDriver(AbstractDriver, NotebookDriverInterface):
    """Jupyter Notebook file parser driver using MarkItDown integration.

    Supports Jupyter Notebook files (.ipynb) through MarkItDown's IpynbConverter.
    Converts notebook cells, markdown, code, and outputs into readable Markdown format.
    """

    # Supported Jupyter Notebook file extensions
    supported_extensions = ['.ipynb']

    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """Parse Jupyter Notebook file and update the provided ParseResult object.

        Args:
            file_path: Path to the notebook file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options:
                - offset (int): Starting offset for conversion, default 0
                - limit (int): Maximum items to convert (-1 for unlimited), default -1
        """
        # Get local file path
        local_file_path = await self._get_file_path(file_path)

        # Use base class MarkItDown functionality to convert notebook
        markdown_content = await self._convert_with_markitdown(
            local_file_path,
            offset=kwargs.get('offset', 0),
            limit=kwargs.get('limit', -1)
        )

        if not markdown_content:
            raise ValueError("MarkItDown conversion returned empty content")

        # Add filename as main title and adjust content heading levels
        from ..utils.markdown_util import MarkdownUtil
        file_path_obj = Path(file_path)

        final_markdown_content = MarkdownUtil.add_filename_title(markdown_content, file_path_obj.name)
        await MarkdownUtil.write_to_file(final_markdown_content, result.output_file_path)

        # Update result metadata
        result.metadata.conversion_method = 'markitdown'
        result.metadata.additional_info = {
            'notebook_format': '.ipynb',
            'cell_count': self._estimate_cell_count(markdown_content),
            'character_count': len(markdown_content),
            'word_count': len(markdown_content.split()),
            'conversion_source': 'IpynbConverter'
        }

    def _estimate_cell_count(self, markdown_content: str) -> int:
        """Estimate the number of cells in the notebook based on markdown content.

        Args:
            markdown_content: The converted markdown content

        Returns:
            int: Estimated number of cells
        """
        # Count common cell separators and headers that indicate cells
        cell_indicators = [
            '## Cell',  # Common cell header pattern
            '### Cell', # Alternative cell header
            '```python',  # Code cells
            '```',  # General code blocks
            '\n\n---\n\n',  # Cell separators
        ]

        cell_count = 0
        content_lower = markdown_content.lower()

        for indicator in cell_indicators:
            cell_count += content_lower.count(indicator.lower())

        # Return at least 1 if we have content
        return max(1, cell_count // 2) if markdown_content.strip() else 0
