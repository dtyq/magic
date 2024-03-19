"""Tests for file parser utility functions."""

import pytest
from pathlib import Path

from app.utils.file_parse.utils.file_parser_util import (
    is_url, is_remote_url, is_pdf_url, get_file_extension, is_file_in_directory
)


class TestIsUrl:
    """Test is_url function."""

    def test_is_url_with_http(self):
        """Test is_url with HTTP URLs."""
        assert is_url('http://example.com') is True
        assert is_url('HTTP://EXAMPLE.COM') is True  # Case insensitive

    def test_is_url_with_https(self):
        """Test is_url with HTTPS URLs."""
        assert is_url('https://example.com') is True
        assert is_url('HTTPS://EXAMPLE.COM') is True  # Case insensitive

    def test_is_url_with_non_http_schemes(self):
        """Test is_url with non-HTTP schemes."""
        # is_url only checks for HTTP/HTTPS
        assert is_url('ftp://example.com') is False
        assert is_url('file://example.com') is False
        assert is_url('mailto:test@example.com') is False

    def test_is_url_with_local_paths(self):
        """Test is_url with local file paths."""
        assert is_url('/local/path/file.txt') is False
        assert is_url('./relative/path.txt') is False
        assert is_url('C:\\Windows\\file.txt') is False

    def test_is_url_with_path_objects(self):
        """Test is_url with Path objects."""
        assert is_url(Path('/local/path')) is False
        assert is_url(Path('./relative')) is False

    def test_is_url_with_invalid_strings(self):
        """Test is_url with invalid or edge case strings."""
        assert is_url('') is False
        assert is_url('not_a_url') is False
        assert is_url('http://') is True  # Starts with http://
        assert is_url('https://') is True  # Starts with https://


class TestIsRemoteUrl:
    """Test is_remote_url function."""

    def test_is_remote_url_with_valid_urls(self):
        """Test is_remote_url with valid remote URLs."""
        assert is_remote_url('http://example.com') is True
        assert is_remote_url('https://example.com') is True
        assert is_remote_url('ftp://example.com') is True
        assert is_remote_url('file://remote-server/path') is True

    def test_is_remote_url_with_local_paths(self):
        """Test is_remote_url with local file paths."""
        assert is_remote_url('/local/path/file.txt') is False
        assert is_remote_url('./relative/path.txt') is False
        assert is_remote_url('C:\\Windows\\file.txt') is False

    def test_is_remote_url_with_invalid_urls(self):
        """Test is_remote_url with invalid URLs."""
        assert is_remote_url('') is False
        assert is_remote_url('not_a_url') is False
        assert is_remote_url('http://') is False  # No netloc

    def test_is_remote_url_with_path_objects(self):
        """Test is_remote_url with Path objects."""
        assert is_remote_url(Path('/local/path')) is False


class TestIsPdfUrl:
    """Test is_pdf_url function."""

    def test_is_pdf_url_with_pdf_extension(self):
        """Test is_pdf_url with URLs ending in .pdf."""
        assert is_pdf_url('http://example.com/document.pdf') is True
        assert is_pdf_url('https://example.com/file.PDF') is True  # Case insensitive
        assert is_pdf_url('http://example.com/path/to/file.pdf') is True

    def test_is_pdf_url_with_pdf_in_path(self):
        """Test is_pdf_url with .pdf in the path."""
        assert is_pdf_url('http://example.com/file.pdf?param=value') is True
        assert is_pdf_url('http://example.com/docs.pdf/view') is True

    def test_is_pdf_url_with_non_pdf_urls(self):
        """Test is_pdf_url with non-PDF URLs."""
        assert is_pdf_url('http://example.com/document.txt') is False
        assert is_pdf_url('http://example.com/image.jpg') is False
        assert is_pdf_url('http://example.com/page.html') is False
        assert is_pdf_url('http://example.com/') is False

    def test_is_pdf_url_edge_cases(self):
        """Test is_pdf_url with edge cases."""
        assert is_pdf_url('') is False
        assert is_pdf_url('not_a_url') is False
        assert is_pdf_url('http://example.com/notpdf.doc') is False


class TestGetFileExtension:
    """Test get_file_extension function."""

    def test_get_file_extension_basic(self):
        """Test get_file_extension with basic file paths."""
        assert get_file_extension('document.pdf') == '.pdf'
        assert get_file_extension('image.jpg') == '.jpg'
        assert get_file_extension('text.txt') == '.txt'

    def test_get_file_extension_case_insensitive(self):
        """Test get_file_extension returns lowercase."""
        assert get_file_extension('DOCUMENT.PDF') == '.pdf'
        assert get_file_extension('Image.JPG') == '.jpg'
        assert get_file_extension('Text.TXT') == '.txt'

    def test_get_file_extension_with_paths(self):
        """Test get_file_extension with full paths."""
        assert get_file_extension('/path/to/document.pdf') == '.pdf'
        assert get_file_extension('./relative/file.txt') == '.txt'
        assert get_file_extension('C:\\Windows\\file.exe') == '.exe'

    def test_get_file_extension_with_path_objects(self):
        """Test get_file_extension with Path objects."""
        assert get_file_extension(Path('document.pdf')) == '.pdf'
        assert get_file_extension(Path('/path/to/file.txt')) == '.txt'

    def test_get_file_extension_no_extension(self):
        """Test get_file_extension with files without extensions."""
        assert get_file_extension('filename') == ''
        assert get_file_extension('/path/to/filename') == ''
        assert get_file_extension(Path('filename')) == ''

    def test_get_file_extension_multiple_dots(self):
        """Test get_file_extension with multiple dots in filename."""
        assert get_file_extension('file.backup.txt') == '.txt'
        assert get_file_extension('archive.tar.gz') == '.gz'
        assert get_file_extension('script.min.js') == '.js'


class TestIsFileInDirectory:
    """Test is_file_in_directory function."""

    def test_is_file_in_directory_basic(self):
        """Test is_file_in_directory with basic cases."""
        # This test uses relative paths that should work
        current_dir = Path.cwd()
        test_file = current_dir / 'some_file.txt'

        assert is_file_in_directory(test_file, current_dir) is True

    def test_is_file_in_directory_with_strings(self):
        """Test is_file_in_directory with string paths."""
        # Use relative paths for testing
        assert is_file_in_directory('./test/file.txt', './test') is True
        assert is_file_in_directory('./test/subdir/file.txt', './test') is True

    def test_is_file_in_directory_outside(self):
        """Test is_file_in_directory with file outside directory."""
        # Create paths that are clearly outside each other
        assert is_file_in_directory('/completely/different/path/file.txt', '/another/path') is False

    def test_is_file_in_directory_with_path_objects(self):
        """Test is_file_in_directory with Path objects."""
        current_dir = Path.cwd()
        test_file = current_dir / 'subdir' / 'file.txt'

        assert is_file_in_directory(test_file, current_dir) is True

    def test_is_file_in_directory_same_path(self):
        """Test is_file_in_directory when file and directory are the same."""
        current_dir = Path.cwd()
        assert is_file_in_directory(current_dir, current_dir) is True

    def test_is_file_in_directory_nonexistent_paths(self):
        """Test is_file_in_directory with non-existent paths."""
        # The function should still work with non-existent paths
        result = is_file_in_directory('/nonexistent/file.txt', '/nonexistent')
        assert isinstance(result, bool)  # Should return a boolean, not raise
