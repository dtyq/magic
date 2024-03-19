"""
Magic Gateway SDK Exceptions

Custom exceptions for Magic Gateway SDK operations.
"""


class MagicGatewayException(Exception):
    """Base exception for Magic Gateway SDK operations"""
    pass


class MagicGatewayConfigError(MagicGatewayException):
    """Configuration error for Magic Gateway SDK"""
    pass


class MagicGatewaySignError(MagicGatewayException):
    """Error occurred during signing operation"""
    pass
