"""
Security utility module for handling sensitive data sanitization.

This module provides utilities for masking sensitive information like API keys
in logs and other output to prevent credential leakage.
"""

from typing import Optional


def mask_sensitive_value(value: str, prefix_length: int = 8, suffix_length: int = 0) -> str:
    """
    Mask sensitive value for logging.

    Args:
        value: The sensitive value to mask
        prefix_length: Number of characters to show at the beginning
        suffix_length: Number of characters to show at the end (0 means no suffix)

    Returns:
        Masked value string
    """
    if not value or not isinstance(value, str):
        return "****"

    if len(value) <= prefix_length + suffix_length:
        return "****"

    if suffix_length > 0:
        return f"{value[:prefix_length]}****{value[-suffix_length:]}"
    else:
        return f"{value[:prefix_length]}****"


def sanitize_api_key(api_key: Optional[str]) -> str:
    """
    Sanitize API key for logging.

    Args:
        api_key: The API key to sanitize

    Returns:
        Masked API key string
    """
    if not api_key:
        return "N/A"
    return mask_sensitive_value(api_key, prefix_length=8, suffix_length=4)
