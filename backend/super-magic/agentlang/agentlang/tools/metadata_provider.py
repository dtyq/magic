"""
Tool metadata provider protocol and global provider management

This module defines the protocol for accessing tool metadata (schema, description, etc.)
without depending on the concrete tool implementation.

The app layer should implement this protocol and register the provider during initialization.
"""

from typing import Dict, Optional, Protocol, runtime_checkable

from agentlang.logger import get_logger

logger = get_logger(__name__)


@runtime_checkable
class ToolMetadataProviderProtocol(Protocol):
    """Tool metadata provider protocol

    Provides access to tool metadata (schema, description, etc.)
    without depending on the concrete tool implementation.

    The app layer should implement this protocol to provide
    specific tool metadata retrieval logic.
    """

    def get_tool_param(self, tool_name: str) -> Optional[Dict]:
        """Get tool parameter definition by name

        Returns the full tool parameter definition in LLM function calling format:
        {
            "type": "function",
            "function": {
                "name": "...",
                "description": "...",
                "parameters": {...}
            }
        }

        Args:
            tool_name: The name of the tool

        Returns:
            Tool parameter definition dict, or None if not found
        """
        ...


# Global provider instance
_metadata_provider: Optional[ToolMetadataProviderProtocol] = None


def set_tool_metadata_provider(provider: ToolMetadataProviderProtocol) -> None:
    """Set the global tool metadata provider

    Should be called by the app layer during initialization.

    Args:
        provider: The tool metadata provider instance
    """
    global _metadata_provider
    _metadata_provider = provider
    logger.debug("Tool metadata provider has been set")


def get_tool_metadata_provider() -> Optional[ToolMetadataProviderProtocol]:
    """Get the global tool metadata provider

    Returns:
        The registered provider, or None if not set
    """
    return _metadata_provider


def get_tool_param(tool_name: str) -> Optional[Dict]:
    """Convenience function to get tool param from the global provider

    Args:
        tool_name: The name of the tool

    Returns:
        Tool parameter definition dict, or None if provider not set or tool not found
    """
    if _metadata_provider is None:
        logger.debug("Tool metadata provider is not set, cannot get tool param")
        return None
    return _metadata_provider.get_tool_param(tool_name)
