"""
Skill File URLs Result

Result class for batch skill file URLs API response.
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class SkillFileUrlItem:
    """Single skill file URL item"""

    def __init__(self, data: Dict[str, Any]):
        self.id = data.get('id', '')
        self.file_key = data.get('file_key', '')
        self.file_url = data.get('file_url')
        self.source_type = data.get('source_type', '')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'file_key': self.file_key,
            'file_url': self.file_url,
            'source_type': self.source_type,
        }


class SkillFileUrlsResult(AbstractResult):
    """Result for batch skill file URLs API"""

    def __init__(self, data):
        # data may be a list directly
        if isinstance(data, list):
            self._items_data = data
            super().__init__({})
        else:
            self._items_data = []
            super().__init__(data if data else {})

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        self.items: List[SkillFileUrlItem] = [SkillFileUrlItem(item) for item in self._items_data]

    def get_file_url(self, skill_id: str) -> Optional[str]:
        """Get file URL for a specific skill ID"""
        for item in self.items:
            if str(item.id) == str(skill_id):
                return item.file_url
        return None
