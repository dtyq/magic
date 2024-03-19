"""File parsing utilities.

This package contains utility functions and classes for file parsing operations.
These utilities can be shared across different file parser drivers.
"""

# Import utility functions
from .file_parser_util import (
    is_url,
    is_remote_url,
    is_pdf_url,
    get_file_extension,
    is_file_in_directory
)

# Import text processing utilities
from .text_processing_utils import (
    TextContent,
    TextEncodingHandler,
    LineNumberFormatter,
    TextPaginationHelper
)

# Import image analysis utilities
from .image_analysis_util import ImageAnalysisUtil

__all__ = [
    # File utility functions
    'is_url',
    'is_remote_url',
    'is_pdf_url',
    'get_file_extension',
    'is_file_in_directory',

    # Text processing utilities
    'TextContent',
    'TextEncodingHandler',
    'LineNumberFormatter',
    'TextPaginationHelper',

    # Image analysis utilities
    'ImageAnalysisUtil'
]
