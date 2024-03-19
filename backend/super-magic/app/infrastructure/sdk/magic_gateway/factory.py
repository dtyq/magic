"""
Magic Gateway SDK Factory

Factory functions for creating and managing Magic Gateway SDK instances.
"""

import os
from typing import Optional
from app.infrastructure.sdk.base import SdkBase
from app.infrastructure.sdk.base.agentlang_logger_adapter import create_agentlang_logger
from .magic_gateway import MagicGateway
from .exceptions import MagicGatewayException, MagicGatewayConfigError


# 全局单例实例缓存
_magic_gateway_instance: Optional[MagicGateway] = None


def create_magic_gateway_sdk(
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    use_agentlang_logger: bool = True
) -> MagicGateway:
    """
    Create a new Magic Gateway SDK instance

    This function always creates a new instance and does not manage singleton state.
    For singleton access, use get_magic_gateway_sdk() instead.

    Args:
        base_url: Base URL (if None, will get from MAGIC_GATEWAY_BASE_URL env var)
        timeout: Request timeout in seconds (defaults to 30)
        use_agentlang_logger: Whether to use AgentLang logger

    Returns:
        MagicGateway instance (new instance each call)

    Raises:
        MagicGatewayConfigError: If configuration is invalid or missing
        MagicGatewayException: If SDK creation fails
    """
    try:
        # Get base_url from environment variable if not provided
        if base_url is None:
            base_url = os.getenv('MAGIC_GATEWAY_BASE_URL')
            if not base_url:
                raise MagicGatewayConfigError("MAGIC_GATEWAY_BASE_URL environment variable not set")

        if timeout is None:
            timeout = 30

        # Create SDK Base configuration
        sdk_config = {
            'sdk_name': 'magic_gateway',
            'base_url': base_url,
            'timeout': timeout,
            'enable_logging': True
        }

        # Create external logger if requested
        external_logger = None
        if use_agentlang_logger:
            external_logger = create_agentlang_logger('magic_gateway_sdk')

        # Create SdkBase instance
        sdk_base = SdkBase(sdk_config, external_logger=external_logger)

        # Create Magic Gateway instance
        return MagicGateway(sdk_base)

    except MagicGatewayConfigError:
        raise
    except Exception as e:
        raise MagicGatewayException(f"Failed to create Magic Gateway SDK: {e}")


def get_magic_gateway_sdk(
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    use_agentlang_logger: bool = True
) -> MagicGateway:
    """
    Get Magic Gateway SDK instance (singleton pattern)

    This function manages a global singleton instance. If an instance doesn't exist
    or if different parameters are provided, a new instance will be created.

    Args:
        base_url: Base URL (if None, will get from MAGIC_GATEWAY_BASE_URL env var)
        timeout: Request timeout in seconds (defaults to 30)
        use_agentlang_logger: Whether to use AgentLang logger

    Returns:
        MagicGateway instance (singleton)

    Raises:
        MagicGatewayConfigError: If configuration is invalid or missing
        MagicGatewayException: If SDK creation fails
    """
    global _magic_gateway_instance

    # For singleton pattern, create new instance if none exists
    if _magic_gateway_instance is None:
        _magic_gateway_instance = create_magic_gateway_sdk(
            base_url=base_url,
            timeout=timeout,
            use_agentlang_logger=use_agentlang_logger
        )

    return _magic_gateway_instance


def reset_magic_gateway_sdk() -> None:
    """
    Reset the singleton Magic Gateway SDK instance

    This function closes the current singleton instance (if any) and sets it to None.
    The next call to get_magic_gateway_sdk() will create a new instance.
    """
    global _magic_gateway_instance

    if _magic_gateway_instance is not None:
        try:
            _magic_gateway_instance.close()
        except Exception:
            # Ignore errors during cleanup
            pass
        finally:
            _magic_gateway_instance = None
