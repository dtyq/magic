"""File parser utility functions.

This module contains utility functions that are used by file parser drivers
and the main FileParser class but don't need to be instance methods.
These functions are stateless and can be used independently.
"""

from pathlib import Path
from typing import Union, Optional
from urllib.parse import urlparse


def is_url(file_path: Union[str, Path]) -> bool:
    """Check if the file path is a URL.

    Args:
        file_path: File path to check

    Returns:
        bool: True if it's a URL, False otherwise
    """
    file_str = str(file_path).lower()
    return file_str.startswith(('http://', 'https://'))


def is_remote_url(file_path: Union[str, Path]) -> bool:
    """Check if the file path is a remote URL.

    Args:
        file_path: File path or URL to check

    Returns:
        bool: True if it's a remote URL, False otherwise
    """
    try:
        file_str = str(file_path)
        parsed = urlparse(file_str)
        return bool(parsed.scheme and parsed.netloc)
    except Exception:
        return False


def is_pdf_url(url: str) -> bool:
    """Check if URL points to a PDF file.

    Args:
        url: URL to check

    Returns:
        bool: True if URL appears to be a PDF file
    """
    # Check if URL ends with .pdf
    if url.lower().endswith('.pdf'):
        return True

    # Check if URL contains .pdf in path
    parsed = urlparse(url)
    if '.pdf' in parsed.path.lower():
        return True

    return False


def get_file_extension(file_path: Union[str, Path]) -> str:
    """Get the file extension from a file path.

    Args:
        file_path: Path to the file

    Returns:
        str: File extension in lowercase (e.g., '.txt', '.pdf')
    """
    return Path(file_path).suffix.lower()


def is_file_in_directory(file_path: Union[str, Path], directory: Union[str, Path]) -> bool:
    """Check if file is within the specified directory.

    Args:
        file_path: Path to the file to check
        directory: Directory path to check against

    Returns:
        bool: True if file is within the directory, False otherwise
    """
    try:
        file_abs_path = Path(file_path).resolve()
        dir_abs_path = Path(directory).resolve()
        file_abs_path.relative_to(dir_abs_path)
        return True
    except ValueError:
        return False
