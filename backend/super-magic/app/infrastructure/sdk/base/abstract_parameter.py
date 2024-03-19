"""
SDK Base Abstract Parameter

Base class for all SDK API parameters.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class AbstractParameter(ABC):
    """Abstract base class for SDK API parameters"""

    @abstractmethod
    def validate(self) -> None:
        """
        Validate parameter data

        Override in subclasses to add validation logic.
        Should raise appropriate exceptions if validation fails.
        """
        pass

    @abstractmethod
    def to_options(self, method: str) -> Dict[str, Any]:
        """
        Convert parameter to HTTP request options

        Args:
            method: HTTP method (GET, POST, etc.)

        Returns:
            Dict containing all request options including:
            - headers: HTTP headers
            - params: Query parameters (for GET requests)
            - json: JSON data (for POST/PUT requests)
            - data: Form data (if needed)
            - other httpx options
        """
        pass
