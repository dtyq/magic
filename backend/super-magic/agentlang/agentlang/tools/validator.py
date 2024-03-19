"""
Tool validator interface for filtering invalid tools

This module defines the protocol for tool validation, allowing the app layer
to implement specific validation logic without agentlang depending on app code.
"""

from typing import Dict, Protocol, runtime_checkable


@runtime_checkable
class ToolValidatorProtocol(Protocol):
    """Tool validator protocol for filtering tools

    This protocol defines the interface for tool validation.
    The app layer should implement this protocol to provide
    specific validation logic (checking tool existence, availability, etc.)
    """

    def filter_valid_tools(self, tools_definition: Dict[str, Dict]) -> Dict[str, Dict]:
        """Filter and return only valid tools from the definition

        Args:
            tools_definition: Original tool definitions dict, where key is tool name
                and value is tool configuration

        Returns:
            Dict[str, Dict]: Filtered valid tools dictionary
        """
        ...
