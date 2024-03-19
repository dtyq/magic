"""Interface for Word document parser drivers."""

from abc import ABC

from .file_parser_driver_interface import FileParserDriverInterface


class WordDriverInterface(FileParserDriverInterface, ABC):
    """Interface for Word document parser drivers."""
    pass
