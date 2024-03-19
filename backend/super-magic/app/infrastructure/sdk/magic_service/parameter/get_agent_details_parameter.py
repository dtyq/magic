"""
Get Agent Details Parameter

Parameter class for getting agent details API.
"""

from typing import Dict, Any, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class GetAgentDetailsParameter(MagicServiceAbstractParameter):
    """Parameter for get agent details API"""

    def __init__(
        self,
        agent_id: str,
        with_prompt_string: bool = True,
        with_tool_schema: bool = False
    ):
        """
        Initialize get agent details parameter

        Args:
            agent_id: Agent ID (e.g., 'SMA-68b55b991fdc63-21929374')
            with_prompt_string: Whether to include prompt_string in response
            with_tool_schema: Whether to include tool schema in response
        """
        super().__init__()
        self.agent_id = agent_id
        self.with_prompt_string = with_prompt_string
        self.with_tool_schema = with_tool_schema

    def get_agent_id(self) -> str:
        """Get agent ID"""
        return self.agent_id

    def get_with_prompt_string(self) -> bool:
        """Get with_prompt_string flag"""
        return self.with_prompt_string

    def get_with_tool_schema(self) -> bool:
        """Get with_tool_schema flag"""
        return self.with_tool_schema

    def to_body(self) -> Dict[str, Any]:
        """
        Convert parameter to request body

        For GET requests, this is typically empty.

        Returns:
            Dict containing request body data
        """
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """
        Convert parameter to query parameters

        Returns:
            Dict containing query parameters
        """
        params = {}

        if self.with_prompt_string:
            params['with_prompt_string'] = 'true'

        if self.with_tool_schema:
            params['with_tool_schema'] = 'true'

        return params

    def validate(self) -> None:
        """
        Validate parameter data

        Raises:
            ValueError: If required fields are missing or invalid
        """
        super().validate()  # Validates token

        if not self.agent_id:
            raise ValueError("Agent ID is required")

        if not isinstance(self.agent_id, str):
            raise ValueError("Agent ID must be a string")

        if not isinstance(self.with_prompt_string, bool):
            raise ValueError("with_prompt_string must be a boolean")

        if not isinstance(self.with_tool_schema, bool):
            raise ValueError("with_tool_schema must be a boolean")
