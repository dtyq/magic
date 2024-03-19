"""File parsing utilities with driver pattern implementation."""

from .file_parser import FileParser, get_file_parser
from .driver.interfaces.file_parser_driver_interface import FileParserDriverInterface, ParseResult, ParseMetadata
from .driver.abstract_driver import AbstractDriver
from .driver.pdf_ocr_driver import PdfOcrDriver
from .driver.pdf_local_driver import PdfLocalDriver
from .driver.pdf_visual_driver import PdfVisualDriver
from .driver.text_driver import TextDriver
from .driver.word_driver import WordDriver
from .driver.excel_driver import ExcelDriver
from .driver.powerpoint_driver import PowerPointDriver
from .driver.image_ocr_driver import ImageOcrDriver
from .driver.image_visual_driver import ImageVisualDriver
from .driver.notebook_driver import NotebookDriver

# Import utility modules
from . import utils

__all__ = [
    # Main parser and utilities
    'FileParser',
    'get_file_parser',

    # Interfaces and base classes
    'FileParserDriverInterface',
    'ParseResult',
    'ParseMetadata',
    'AbstractDriver',

    # Specific drivers
    'PdfOcrDriver',
    'PdfLocalDriver',
    'PdfVisualDriver',
    'TextDriver',
    'WordDriver',
    'ExcelDriver',
    'PowerPointDriver',
    'ImageOcrDriver',
    'ImageVisualDriver',
    'NotebookDriver',

    # Utility modules
    'utils'
]
