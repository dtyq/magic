"""
Get Skill File URLs Parameter

Parameter class for batch getting skill file URLs via open-api.
"""

from typing import Dict, Any, List
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class GetSkillFileUrlsParameter(MagicServiceAbstractParameter):
    """Parameter for batch getting skill file download URLs"""

    def __init__(self, skill_ids: List[str]):
        """
        Initialize get skill file URLs parameter

        Args:
            skill_ids: List of skill IDs (string format)
        """
        super().__init__()
        self.skill_ids = skill_ids

    def to_body(self) -> Dict[str, Any]:
        """Convert parameter to request body"""
        return {
            'skill_ids': self.skill_ids
        }

    def to_query_params(self) -> Dict[str, Any]:
        """POST request, no query params"""
        return {}

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.skill_ids:
            raise ValueError("skill_ids is required and must not be empty")
        if len(self.skill_ids) > 100:
            raise ValueError("skill_ids cannot exceed 100 items")
