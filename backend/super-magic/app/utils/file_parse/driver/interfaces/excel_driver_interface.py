"""Excel file parser driver interface."""

from abc import ABC
from .file_parser_driver_interface import FileParserDriverInterface


class ExcelDriverInterface(FileParserDriverInterface, ABC):
    """Interface for Excel file parser drivers.

    Defines the contract for drivers that can parse Excel and CSV files.
    Inherits all methods from FileParserDriverInterface.
    """
    pass
