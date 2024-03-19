"""
SDK Base Abstract Result

Base class for all SDK API results.
"""

import json
from abc import ABC
from typing import Dict, Any


class AbstractResult(ABC):
    """Abstract base class for SDK API results"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize result with API response data

        Args:
            data: Raw response data from API
        """
        self._raw_data = data
        self._parse_data()

    def _parse_data(self) -> None:
        """
        Parse raw data into structured attributes

        Override in subclasses to extract specific fields.
        """
        pass

    def get_raw_data(self) -> Dict[str, Any]:
        """
        Get raw response data

        Returns:
            Dict containing original response data
        """
        return self._raw_data.copy()

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get value from raw data

        Args:
            key: Key to retrieve
            default: Default value if key not found

        Returns:
            Value from raw data or default
        """
        return self._raw_data.get(key, default)

    def has(self, key: str) -> bool:
        """
        Check if key exists in raw data

        Args:
            key: Key to check

        Returns:
            True if key exists, False otherwise
        """
        return key in self._raw_data

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert result to dictionary

        By default, returns raw data. Override in subclasses
        to return structured data.

        Returns:
            Dict representation of result
        """
        return self.get_raw_data()

    def to_string(self) -> str:
        """
        Convert result to JSON string

        This method converts the result dictionary to a JSON string,
        which is useful for returning structured API results as text content.

        Returns:
            str: JSON string representation of the result
        """
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def __getitem__(self, key: str) -> Any:
        """Allow dictionary-style access to raw data"""
        return self._raw_data[key]

    def __contains__(self, key: str) -> bool:
        """Allow 'in' operator to check for keys"""
        return key in self._raw_data

    def __repr__(self) -> str:
        """String representation of result"""
        class_name = self.__class__.__name__
        return f"{class_name}({self._raw_data})"
