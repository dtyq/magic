"""
Add Agent Skills Parameter

Parameter class for adding skills to an agent via open-api.
"""

from typing import Dict, Any, List
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class AddAgentSkillsParameter(MagicServiceAbstractParameter):
    """Parameter for incrementally adding skills to an agent"""

    def __init__(self, code: str, skill_codes: List[str]):
        """
        Initialize add agent skills parameter

        Args:
            code: Agent code
            skill_codes: List of skill codes to add
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
        """POST request, no query params"""
        return {}

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.code:
            raise ValueError("Agent code is required")
        if not self.skill_codes:
            raise ValueError("skill_codes is required and must not be empty")
