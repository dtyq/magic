"""
Magic Service Infrastructure Module

This module provides abstraction for Magic Service API configuration and client management.
"""

from .config import MagicServiceConfig, MagicServiceConfigLoader
from .client import MagicServiceClient
from .exceptions import MagicServiceError, ConfigurationError
from .constants import FileEditType
from app.core.entity.file import File

__all__ = [
    'MagicServiceConfig',
    'MagicServiceConfigLoader',
    'MagicServiceClient',
    'File',
    'MagicServiceError',
    'ConfigurationError',
    'FileEditType'
]
