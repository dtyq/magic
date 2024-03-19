"""Interface for PDF file parser drivers."""

from abc import ABC

from .file_parser_driver_interface import FileParserDriverInterface


class PdfDriverInterface(FileParserDriverInterface, ABC):
    """Interface for PDF file parser drivers."""
    pass
