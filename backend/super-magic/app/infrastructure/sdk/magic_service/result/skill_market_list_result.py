"""
Skill Market List Result

Result class for skill market list query response (/skill-market/queries).
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class SkillMarketListItem:
    """Single item in the skill market list"""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data.get('id', '')
        self.skill_code: str = data.get('skill_code', '')
        # skill code in the current user's own skill library (empty if not added)
        self.user_skill_code: str = data.get('user_skill_code', '')
        self.name: str = data.get('name', '')
        self.description: str = data.get('description', '')
        self.name_i18n: Dict[str, str] = data.get('name_i18n', {})
        self.description_i18n: Dict[str, str] = data.get('description_i18n', {})
        self.logo: str = data.get('logo', '')
        self.publisher_type: str = data.get('publisher_type', '')
        # publisher info: {name: str, avatar: str}
        self.publisher: Dict[str, str] = data.get('publisher', {})
        self.publish_status: str = data.get('publish_status', '')
        self.is_added: bool = data.get('is_added', False)
        self.need_upgrade: bool = data.get('need_upgrade', False)
        self.created_at: str = data.get('created_at', '')
        self.updated_at: str = data.get('updated_at', '')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'skill_code': self.skill_code,
            'user_skill_code': self.user_skill_code,
            'name': self.name,
            'description': self.description,
            'name_i18n': self.name_i18n,
            'description_i18n': self.description_i18n,
            'logo': self.logo,
            'publisher_type': self.publisher_type,
            'publisher': self.publisher,
            'publish_status': self.publish_status,
            'is_added': self.is_added,
            'need_upgrade': self.need_upgrade,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }


class SkillMarketListResult(AbstractResult):
    """Result for skill market list query"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize skill market list result

        Args:
            data: Raw response data from API
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        list_data = self.get('list', [])
        self.items: List[SkillMarketListItem] = [SkillMarketListItem(item) for item in list_data]
        self.page: int = self.get('page', 1)
        self.page_size: int = self.get('page_size', 20)
        self.total: int = self.get('total', 0)

    def get_items(self) -> List[SkillMarketListItem]:
        """Get skill market list items"""
        return self.items

    def get_page(self) -> int:
        """Get current page number"""
        return self.page

    def get_page_size(self) -> int:
        """Get page size"""
        return self.page_size

    def get_total(self) -> int:
        """Get total record count"""
        return self.total

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return {
            'list': [item.to_dict() for item in self.items],
            'page': self.page,
            'page_size': self.page_size,
            'total': self.total,
        }

    def __str__(self) -> str:
        return f"SkillMarketListResult[page={self.page}, total={self.total}, count={len(self.items)}]"
