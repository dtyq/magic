"""
Import Skill Result

Result class for import skill from agent API response.
"""

from typing import Dict, Any
from app.infrastructure.sdk.base import AbstractResult


class ImportSkillResult(AbstractResult):
    """Result for import skill via open-api"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        self.id = self.get('id', '')
        self.code = self.get('code', '')
        self.name = self.get('name', {})
        self.description = self.get('description', {})
        self.is_create = self.get('is_create', False)
