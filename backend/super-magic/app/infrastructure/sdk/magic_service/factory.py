"""
Magic Service SDK Factory

Provides factory functions to create Magic Service SDK instances with singleton pattern.
"""

from typing import Dict, Any, Optional

from app.infrastructure.sdk.base import SdkBase, create_agentlang_logger
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError
from .magic_service import MagicService
from .kernel.magic_service_exception import MagicServiceException


class MagicServiceConfigError(Exception):
    """Configuration error for Magic Service SDK"""
    pass


# 全局单例实例缓存
_magic_service_instance: Optional[MagicService] = None


def create_magic_service_sdk(
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    use_agentlang_logger: bool = True
) -> MagicService:
    """
    Create a new Magic Service SDK instance

    This function always creates a new instance and does not manage singleton state.
    For singleton access, use get_magic_service_sdk() instead.

    Args:
        base_url: Base URL (if None, will get from InitClientMessageUtil)
        timeout: Request timeout in seconds (defaults to 30)
        use_agentlang_logger: Whether to use AgentLang logger

    Returns:
        MagicService instance (new instance each call)

    Raises:
        MagicServiceConfigError: If configuration is invalid or missing
        MagicServiceException: If SDK creation fails
    """
    try:
        # Get base_url from InitClientMessageUtil if not provided
        if base_url is None:
            base_url = InitClientMessageUtil.get_magic_service_host()

        if timeout is None:
            timeout = 30

        # Create SDK Base configuration
        sdk_config = {
            'sdk_name': 'magic_service',
            'base_url': base_url,
            'timeout': timeout,
            'enable_logging': True
        }

        # Create external logger if requested
        external_logger = None
        if use_agentlang_logger:
            external_logger = create_agentlang_logger('magic_service_sdk')

        # Create SdkBase instance
        sdk_base = SdkBase(sdk_config, external_logger=external_logger)

        # Create Magic Service instance
        return MagicService(sdk_base)

    except MagicServiceConfigError:
        raise
    except InitializationError as e:
        raise MagicServiceConfigError(f"Failed to get Magic Service configuration: {e}")
    except Exception as e:
        raise MagicServiceException(f"Failed to create Magic Service SDK: {e}")


def get_magic_service_sdk(
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    use_agentlang_logger: bool = True
) -> MagicService:
    """
    Get Magic Service SDK singleton instance

    If the instance doesn't exist, creates it with the provided parameters.
    If it already exists, returns the cached instance (parameters are ignored).

    This is the recommended way to access the Magic Service SDK in most cases.

    Args:
        base_url: Base URL (only used when creating new instance)
        timeout: Request timeout in seconds (only used when creating new instance)
        use_agentlang_logger: Whether to use AgentLang logger (only used when creating new instance)

    Returns:
        MagicService instance (singleton)

    Raises:
        MagicServiceConfigError: If configuration is invalid or missing
        MagicServiceException: If SDK creation fails
    """
    global _magic_service_instance

    # Return existing instance if available
    if _magic_service_instance is not None:
        return _magic_service_instance

    # Create new instance and cache it
    _magic_service_instance = create_magic_service_sdk(base_url, timeout, use_agentlang_logger)
    return _magic_service_instance


def create_magic_service_sdk_with_defaults() -> MagicService:
    """
    Create Magic Service SDK with default configuration

    Note: This creates a new instance each time. For singleton access, use get_magic_service_sdk().

    Returns:
        MagicService instance (new instance)

    Raises:
        MagicServiceException: If SDK creation fails
    """
    return create_magic_service_sdk()


def reset_magic_service_sdk() -> None:
    """
    Reset the Magic Service SDK singleton instance

    This is primarily for testing purposes to clear the cached instance.
    """
    global _magic_service_instance
    _magic_service_instance = None
