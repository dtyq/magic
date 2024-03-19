"""PowerPoint file parser driver interface."""

from abc import ABC
from .file_parser_driver_interface import FileParserDriverInterface


class PowerPointDriverInterface(FileParserDriverInterface, ABC):
    """Interface for PowerPoint file parser drivers.

    Defines the contract for drivers that can parse PowerPoint presentations.
    Inherits all methods from FileParserDriverInterface.
    """
    pass
