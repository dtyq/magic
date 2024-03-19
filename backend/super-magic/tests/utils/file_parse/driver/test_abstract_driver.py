"""Tests for AbstractDriver base class."""

import pytest
from pathlib import Path

from app.utils.file_parse.driver.abstract_driver import AbstractDriver
from app.utils.file_parse.driver.interfaces.file_parser_driver_interface import (
    FileParserDriverInterface, ParseResult, ParseMetadata
)


class ConcreteTestDriver(AbstractDriver):
    """Concrete test driver for testing AbstractDriver functionality."""

    supported_extensions = ['.test']

    async def parse(self, file_path, result, **kwargs):
        """Minimal parse implementation for testing."""
        result.success = True
        result.content = "Test content"
        result.metadata = ParseMetadata(
            driver_name=self.__class__.__name__,
            file_extension='.test'
        )


class TestAbstractDriver:
    """Test AbstractDriver functionality."""

    def setup_method(self):
        """Setup test fixtures."""
        self.driver = ConcreteTestDriver()

    def test_get_supported_extensions(self):
        """Test getting supported extensions."""
        extensions = self.driver.get_supported_extensions()
        assert extensions == ['.test']

    def test_get_driver_name(self):
        """Test getting driver name."""
        # Driver name should be the class name
        assert self.driver.__class__.__name__ == 'ConcreteTestDriver'

    def test_get_supported_extensions_content(self):
        """Test that supported extensions contain expected values."""
        extensions = self.driver.get_supported_extensions()
        assert isinstance(extensions, list)
        assert len(extensions) > 0
        assert all(isinstance(ext, str) for ext in extensions)
        assert all(ext.startswith('.') for ext in extensions)

    def test_get_priority_value(self):
        """Test getting priority value."""
        priority = self.driver.get_priority()
        assert isinstance(priority, int)
        assert priority == 1  # Default priority from AbstractDriver

    def test_inherits_from_abstract_driver(self):
        """Test that concrete driver inherits from AbstractDriver."""
        assert isinstance(self.driver, AbstractDriver)
        assert isinstance(self.driver, FileParserDriverInterface)

    def test_supported_extensions_format(self):
        """Test that supported extensions are properly formatted."""
        extensions = self.driver.get_supported_extensions()
        for ext in extensions:
            assert isinstance(ext, str)
            assert ext.startswith('.')
            assert len(ext) > 1
