"""
Magic Service SDK Kernel

Core classes and utilities for Magic Service SDK.
"""

from .magic_service_api import MagicServiceAbstractApi
from .magic_service_parameter import MagicServiceAbstractParameter, MagicServiceAuthConfig
from .magic_service_exception import (
    MagicServiceException,
    MagicServiceUnauthorizedException,
    MagicServiceConfigurationError,
    MagicServiceApiError
)

__all__ = [
    'MagicServiceAuthConfig',
    'MagicServiceAbstractApi',
    'MagicServiceAbstractParameter',
    'MagicServiceException',
    'MagicServiceUnauthorizedException',
    'MagicServiceConfigurationError',
    'MagicServiceApiError'
]
