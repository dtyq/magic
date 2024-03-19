"""
Magic Service Infrastructure Exceptions

Defines custom exceptions for Magic Service operations.
"""

from typing import Optional, Dict, Any


class MagicServiceError(Exception):
    """Base exception for Magic Service operations"""

    def __init__(self, message: str, cause: Optional[Exception] = None):
        super().__init__(message)
        self.message = message
        self.cause = cause

    def __str__(self) -> str:
        return self.message


class ConfigurationError(MagicServiceError):
    """Exception raised when Magic Service configuration is invalid or missing"""

    def __init__(self, message: str, missing_fields: Optional[list] = None):
        super().__init__(message)
        self.missing_fields = missing_fields or []


class ApiError(MagicServiceError):
    """Exception raised when Magic Service API requests fail"""

    def __init__(self,
                 message: str,
                 status_code: Optional[int] = None,
                 response_data: Optional[Dict[str, Any]] = None,
                 cause: Optional[Exception] = None):
        super().__init__(message, cause)
        self.status_code = status_code
        self.response_data = response_data

    def __str__(self) -> str:
        if self.status_code:
            return f"{self.message} (Status: {self.status_code})"
        return self.message


class ConnectionError(MagicServiceError):
    """Exception raised when connection to Magic Service fails"""
    pass
