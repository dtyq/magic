"""
Import Skill From Agent Result

Result class for agent-initiated skill import response (/skills/import-from-agent).
"""

from typing import Dict, Any
from app.infrastructure.sdk.base import AbstractResult


class ImportSkillFromAgentResult(AbstractResult):
    """Result for agent-initiated skill import"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize import skill from agent result

        Args:
            data: Raw response data from API
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        self.id: str = self.get('id', '')
        self.code: str = self.get('code', '')
        # name and description are i18n dicts returned by the service
        self.name: Any = self.get('name', {})
        self.description: Any = self.get('description', {})
        self.is_create: bool = self.get('is_create', False)

    def get_id(self) -> str:
        """Get skill ID"""
        return self.id

    def get_code(self) -> str:
        """Get skill code"""
        return self.code

    def get_name(self) -> Any:
        """Get skill name (i18n dict)"""
        return self.name

    def get_description(self) -> Any:
        """Get skill description (i18n dict)"""
        return self.description

    def is_newly_created(self) -> bool:
        """Check whether this import created a new skill (True) or updated an existing one (False)"""
        return self.is_create

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'is_create': self.is_create,
        }

    def __str__(self) -> str:
        action = 'created' if self.is_create else 'updated'
        return f"ImportSkillFromAgentResult[id={self.id}, code={self.code}, {action}]"
