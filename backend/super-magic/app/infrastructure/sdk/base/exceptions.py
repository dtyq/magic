"""
SDK Base Exceptions

Basic exception classes for SDK
"""


class SdkException(Exception):
    """Base SDK exception"""
    pass


class ConfigurationError(SdkException):
    """Configuration error"""
    pass


class HttpRequestError(SdkException):
    """HTTP request error"""
    pass


class AuthenticationError(SdkException):
    """Authentication error"""
    pass
