"""Interface for text file parser drivers."""

from abc import ABC

from .file_parser_driver_interface import FileParserDriverInterface


class TextDriverInterface(FileParserDriverInterface, ABC):
    """Interface for text file parser drivers."""
    pass
