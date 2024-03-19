"""
Tool Execute Parameter

Parameter class for tool execution API.
"""

from typing import Dict, Any, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class ToolExecuteParameter(MagicServiceAbstractParameter):
    """Parameter for tool execute API"""

    def __init__(
        self,
        code: str,
        arguments: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize tool execute parameter

        Args:
            code: Tool code (e.g., 'teamshare_box_teamshare_doc_markdown_query')
            arguments: Tool arguments (optional)
        """
        super().__init__()
        self.code = code
        self.arguments = arguments or {}

    def get_code(self) -> str:
        """Get tool code"""
        return self.code

    def get_arguments(self) -> Dict[str, Any]:
        """Get tool arguments"""
        return self.arguments

    def set_argument(self, key: str, value: Any) -> None:
        """Set a single argument"""
        self.arguments[key] = value

    def remove_argument(self, key: str) -> None:
        """Remove an argument"""
        if key in self.arguments:
            del self.arguments[key]

    def has_arguments(self) -> bool:
        """Check if tool has arguments"""
        return len(self.arguments) > 0

    def to_body(self) -> Dict[str, Any]:
        """
        Convert parameter to request body

        Returns:
            Dict containing request body data
        """
        body = {
            'code': self.code
        }

        if self.arguments:
            body['arguments'] = self.arguments

        return body

    def to_query_params(self) -> Dict[str, Any]:
        """
        Convert parameter to query parameters

        For POST requests, this is typically empty.

        Returns:
            Dict containing query parameters
        """
        return {}

    def validate(self) -> None:
        """
        Validate parameter data

        Raises:
            ValueError: If required fields are missing or invalid
        """
        super().validate()  # Validates token

        if not self.code:
            raise ValueError("Tool code is required")

        if not isinstance(self.code, str):
            raise ValueError("Tool code must be a string")

        if self.arguments is not None and not isinstance(self.arguments, dict):
            raise ValueError("Arguments must be a dictionary")
