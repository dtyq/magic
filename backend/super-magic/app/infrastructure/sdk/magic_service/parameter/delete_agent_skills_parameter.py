"""
Delete Agent Skills Parameter

Parameter class for deleting skills from an agent via open-api.
"""

from typing import Dict, Any, List
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class DeleteAgentSkillsParameter(MagicServiceAbstractParameter):
    """Parameter for incrementally deleting skills from an agent"""

    def __init__(self, code: str, skill_codes: List[str]):
        """
        Initialize delete agent skills parameter

        Args:
            code: Agent code
            skill_codes: List of skill codes to delete
        """
        super().__init__()
        self.code = code
        self.skill_codes = skill_codes

    def get_code(self) -> str:
        """Get agent code"""
        return self.code

    def to_body(self) -> Dict[str, Any]:
        """Convert parameter to request body"""
        return {
            'skill_codes': self.skill_codes
        }

    def to_query_params(self) -> Dict[str, Any]:
        """DELETE request, no query params"""
        return {}

    def to_options(self, method: str) -> Dict[str, Any]:
        """Convert to HTTP request options for DELETE with body"""
        options = {
            'headers': self.to_headers()
        }
        body_data = self.to_body()
        if body_data:
            options['json'] = body_data
        return options

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.code:
            raise ValueError("Agent code is required")
        if not self.skill_codes:
            raise ValueError("skill_codes is required and must not be empty")
