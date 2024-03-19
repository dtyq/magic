"""Image file parser driver interface."""

from abc import ABC
from .file_parser_driver_interface import FileParserDriverInterface


class ImageDriverInterface(FileParserDriverInterface, ABC):
    """Interface for image file parser drivers.

    Defines the contract for drivers that can parse image files.
    Future implementations may include OCR and visual understanding capabilities.
    Inherits all methods from FileParserDriverInterface.
    """
    pass
