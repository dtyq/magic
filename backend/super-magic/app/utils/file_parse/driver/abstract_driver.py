"""Abstract file parser driver implementation with common functionality."""

import asyncio
from abc import ABC
from pathlib import Path
from typing import Union, Optional, Dict, Any
import io

import aiofiles
from markitdown import MarkItDown, StreamInfo
from agentlang.logger import get_logger

from .interfaces.file_parser_driver_interface import FileParserDriverInterface, ParseResult, ParseMetadata
from ..utils.file_parser_util import is_url, get_file_extension

logger = get_logger(__name__)


class AbstractDriver(FileParserDriverInterface, ABC):
    """Abstract file parser driver with common functionality.

    Provides common functionality for all file parser drivers:
    - MarkItDown integration with native converters
    - File path validation and URL detection
    - Temporary file management
    - Common error handling patterns
    - Default implementations for common methods

    Subclasses must define:
    - supported_extensions: List of supported file extensions (class attribute)
    - parse: Main parsing logic

    Subclasses may optionally define:
    - priority: Driver priority for conflict resolution (class attribute, higher = more priority, default = 1)
    - remote_capable: Whether driver supports remote files (class attribute, default = False)
    """

    # Default priority for all drivers
    priority = 1

    # Remote file support capability (to be overridden by subclasses if needed)
    remote_capable = False

    # Supported file extensions (to be defined by subclasses)
    supported_extensions = []

    def __init__(self):
        """Initialize abstract driver with MarkItDown and common settings."""
        # Initialize MarkItDown instance with native converters only
        self._md = MarkItDown()
        logger.debug("Initialized MarkItDown with native converters")

    def is_remote_capable(self) -> bool:
        """Check if this driver supports remote files.

        Returns:
            bool: True if driver supports remote files, False otherwise
        """
        return self.remote_capable

    async def _convert_with_markitdown(self, file_path: Path, **kwargs) -> str:
        """Convert file using MarkItDown library.

        Args:
            file_path: Path to the file to convert
            **kwargs: Additional conversion options (offset, limit, etc.)

        Returns:
            str: Converted markdown content

        Raises:
            Exception: If conversion fails
        """
        offset = kwargs.get('offset', 0)
        limit = kwargs.get('limit', -1)

        # Extract additional parameters for conversion
        conversion_kwargs = {k: v for k, v in kwargs.items() if k not in ['offset', 'limit']}

        # Run asynchronous file read and MarkItDown conversion
        result = await self._async_markitdown_convert(file_path, offset, limit, **conversion_kwargs)

        return result.markdown if result and result.markdown else ""

    async def _async_markitdown_convert(self, file_path: Path, offset: int, limit: int, **kwargs):
        """Asynchronous MarkItDown conversion with async file operations.

        Args:
            file_path: Path to the file
            offset: Starting offset for conversion
            limit: Maximum number of items to convert (-1 for unlimited)
            **kwargs: Additional conversion parameters

        Returns:
            MarkItDown conversion result
        """
        # 异步读取文件内容
        async with aiofiles.open(file_path, "rb") as f:
            file_content = await f.read()

        # 创建BytesIO对象以供MarkItDown处理
        file_stream = io.BytesIO(file_content)

        # Run MarkItDown conversion in thread pool (since it's synchronous)
        # Using thread pool prevents blocking the event loop during file parsing
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,  # Use default ThreadPoolExecutor
            lambda: self._md.convert(
                file_stream,
                stream_info=StreamInfo(extension=file_path.suffix),
                offset=offset,
                limit=limit,
                **kwargs
            )
        )

        return result

    async def _get_file_path(self, file_path: Union[str, Path]) -> Path:
        """Get file path, handle remote URLs if supported.

        Args:
            file_path: File path or URL

        Returns:
            Path: Local file path

        Raises:
            ValueError: If remote URLs are not supported or file doesn't exist
        """
        if is_url(file_path):
            if not self.is_remote_capable():
                raise ValueError(f"Remote files not supported by this driver: {file_path}")
            # Remote file download not implemented yet
            raise NotImplementedError("Remote file download functionality not implemented yet")

        local_path = Path(file_path)
        if not local_path.exists():
            raise ValueError(f"File does not exist: {file_path}")

        return local_path


    # === Helper methods for metadata ===

    def _get_basic_metadata(self, file_path: Path) -> ParseMetadata:
        """Get basic file metadata.

        Args:
            file_path: Path to the file

        Returns:
            ParseMetadata: Structured metadata object
        """
        stat = file_path.stat()
        return ParseMetadata(
            file_path=str(file_path),
            file_name=file_path.name,
            file_size=stat.st_size,
            file_extension=file_path.suffix,
            conversion_method='markitdown'
        )


    # === Default implementations ===

    def get_supported_extensions(self) -> list[str]:
        """Get list of file extensions supported by this driver.

        Returns:
            list[str]: List of supported file extensions (e.g., ['.txt', '.md'])
        """
        return self.supported_extensions

    def get_priority(self) -> int:
        """Get the priority of this driver for conflict resolution.

        Returns:
            int: Priority value (higher = more priority)
        """
        return self.priority


    # === Abstract methods (implemented by base interface) ===
    # parse is already defined in FileParserDriverInterface and must be implemented by subclasses
