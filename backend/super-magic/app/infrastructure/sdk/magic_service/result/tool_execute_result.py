"""
Tool Execute Result

Result class for tool execution API response.
"""

from typing import Dict, Any, Optional
from app.infrastructure.sdk.base import AbstractResult


class ToolExecuteResult(AbstractResult):
    """Result for tool execute API"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize tool execute result

        Args:
            data: Raw response data from API
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        # The response follows Magic Service standard format:
        # { "code": 1000, "message": "ok", "data": { "result": {...} } }
        # The actual tool result is in data.result
        self.tool_result = self.get('result')

        # For convenience, also expose nested result content
        if isinstance(self.tool_result, dict):
            self.result_content = self.tool_result
        else:
            self.result_content = {}

    def get_result(self) -> Any:
        """Get tool execution result"""
        return self.tool_result

    def get_content(self) -> str:
        """Get result content if available"""
        if isinstance(self.tool_result, dict):
            return self.tool_result.get('content', '')
        return ''

    def get_result_field(self, field: str, default: Any = None) -> Any:
        """Get a specific field from the result"""
        if isinstance(self.tool_result, dict):
            return self.tool_result.get(field, default)
        return default

    def has_result(self) -> bool:
        """Check if tool has result"""
        return self.tool_result is not None

    def has_content(self) -> bool:
        """Check if result has content field"""
        return isinstance(self.tool_result, dict) and 'content' in self.tool_result

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert result to dictionary

        Returns:
            Dict representation of structured result
        """
        return {
            'result': self.tool_result
        }

    def __str__(self) -> str:
        """String representation of tool execution result"""
        if self.has_content():
            content_preview = self.get_content()[:50]
            if len(content_preview) == 50:
                content_preview += '...'
            return f"ToolExecuteResult: {content_preview}"
        elif self.has_result():
            return f"ToolExecuteResult: {str(self.tool_result)[:50]}..."
        else:
            return "ToolExecuteResult: No result"
