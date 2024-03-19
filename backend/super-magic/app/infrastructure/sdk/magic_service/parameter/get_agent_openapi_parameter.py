"""
Get Agent OpenAPI Parameter

Parameter class for getting agent details via open-api.
"""

from typing import Dict, Any
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class GetAgentOpenApiParameter(MagicServiceAbstractParameter):
    """Parameter for get agent details via open-api"""

    def __init__(
        self,
        code: str,
        with_tool_schema: bool = False
    ):
        """
        Initialize get agent open-api parameter

        Args:
            code: Agent code (e.g., 'sma-xxxxxx')
            with_tool_schema: Whether to include tool schema in response
        """
        super().__init__()
        self.code = code
        self.with_tool_schema = with_tool_schema

    def get_code(self) -> str:
        """Get agent code"""
        return self.code

    def to_body(self) -> Dict[str, Any]:
        """GET request, no body"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """Convert parameter to query parameters"""
        params = {}
        if self.with_tool_schema:
            params['with_tool_schema'] = 'true'
        return params

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.code:
            raise ValueError("Agent code is required")
