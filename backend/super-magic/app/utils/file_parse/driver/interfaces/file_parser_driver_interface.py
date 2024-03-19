"""Base interface for file parser drivers."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional, Union
from enum import Enum

from dataclasses import dataclass


class ConversionStrategy(str, Enum):
    """Conversion strategy enumeration."""
    PERFORMANCE = "performance"
    BALANCED = "balanced"
    QUALITY = "quality"


@dataclass
class ParseMetadata:
    """Structured metadata for file parsing results."""
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_extension: Optional[str] = None
    conversion_method: Optional[str] = None
    driver_name: Optional[str] = None
    parsing_time: Optional[float] = None
    additional_info: Optional[Dict[str, Any]] = None


@dataclass
class ParseResult:
    """Result of file parsing operation."""
    metadata: ParseMetadata
    success: bool
    output_file_path: Optional[Path] = None
    output_images_dir: str = ""
    error_message: Optional[str] = None
    needs_visual_understanding: bool = True
    conversion_strategy: str = ConversionStrategy.BALANCED.value


class FileParserDriverInterface(ABC):
    """Base interface for file parser drivers."""

    @abstractmethod
    async def parse(self, file_path: Union[str, Path], result: ParseResult, **kwargs) -> None:
        """
        Parse the file and update the provided ParseResult object.

        Args:
            file_path: Path to the file
            result: ParseResult object to update with parsed content and metadata
            **kwargs: Additional parsing options
        """
        pass

    @abstractmethod
    def get_supported_extensions(self) -> list[str]:
        """
        Get list of file extensions supported by this driver.

        Returns:
            list[str]: List of supported file extensions (e.g., ['.txt', '.md'])
        """
        pass

    @abstractmethod
    def get_priority(self) -> int:
        """
        Get the priority of this driver for conflict resolution.

        Higher numbers indicate higher priority. When multiple drivers support
        the same file extension, they will be tried in descending priority order.

        Returns:
            int: Priority value (higher = more priority)
        """
        pass
