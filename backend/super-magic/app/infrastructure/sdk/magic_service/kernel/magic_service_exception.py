"""
Magic Service Exceptions

Custom exceptions for Magic Service API errors.
"""

from app.infrastructure.sdk.base.exceptions import SdkException


class MagicServiceException(SdkException):
    """Base exception for Magic Service API errors"""
    pass


class MagicServiceUnauthorizedException(MagicServiceException):
    """Exception for Magic Service authentication errors"""

    def __init__(self, message: str = "Magic Service unauthorized", code: int = 401):
        super().__init__(message)
        self.code = code


class MagicServiceConfigurationError(MagicServiceException):
    """Exception for Magic Service configuration errors"""
    pass


class MagicServiceApiError(MagicServiceException):
    """Exception for Magic Service API response errors"""

    def __init__(self, message: str, code: int = 500, api_code: int = None):
        super().__init__(message)
        self.code = code
        self.api_code = api_code
