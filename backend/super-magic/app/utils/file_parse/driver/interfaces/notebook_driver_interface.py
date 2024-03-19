"""Notebook driver interface definition."""

from abc import ABC
from .file_parser_driver_interface import FileParserDriverInterface


class NotebookDriverInterface(FileParserDriverInterface, ABC):
    """Interface for Jupyter Notebook file parser drivers.

    This interface defines the contract for parsing Jupyter Notebook files (.ipynb).
    Implementations should handle notebook cells, metadata, and output formatting.
    """

    def get_driver_type(self) -> str:
        """Get the type of this driver.

        Returns:
            str: Always returns 'notebook'
        """
        return 'notebook'
