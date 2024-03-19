"""
App layer implementation of tool metadata provider

Provides concrete implementation of ToolMetadataProviderProtocol
using the app's tool_factory.
"""

from typing import Dict, Optional

from agentlang.logger import get_logger
from agentlang.tools.metadata_provider import ToolMetadataProviderProtocol

logger = get_logger(__name__)


class AppToolMetadataProvider(ToolMetadataProviderProtocol):
    """App layer tool metadata provider

    Provides tool metadata by delegating to tool_factory.
    """

    def get_tool_param(self, tool_name: str) -> Optional[Dict]:
        """Get tool parameter definition by name

        Args:
            tool_name: The name of the tool

        Returns:
            Tool parameter definition dict, or None if not found
        """
        # Import here to avoid circular imports
        from app.tools.core.tool_factory import tool_factory
        return tool_factory.get_tool_param_from_definition(tool_name)


# Singleton instance
_app_metadata_provider: Optional[AppToolMetadataProvider] = None


def get_app_metadata_provider() -> AppToolMetadataProvider:
    """Get the singleton instance of AppToolMetadataProvider

    Returns:
        The singleton AppToolMetadataProvider instance
    """
    global _app_metadata_provider
    if _app_metadata_provider is None:
        _app_metadata_provider = AppToolMetadataProvider()
    return _app_metadata_provider


def register_app_metadata_provider() -> None:
    """Register the app metadata provider to agentlang

    Should be called during app initialization.
    """
    from agentlang.tools.metadata_provider import set_tool_metadata_provider
    provider = get_app_metadata_provider()
    set_tool_metadata_provider(provider)
    logger.info("App tool metadata provider registered")
