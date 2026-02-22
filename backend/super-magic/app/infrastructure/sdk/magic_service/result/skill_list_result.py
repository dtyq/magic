"""
Skill List Result

Result class for user skill list query response (/skills/queries).
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class SkillListItem:
    """Single skill item in the user skill list"""

    def __init__(self, data: Dict[str, Any]):
        # 注意：后端 id 字段实际填的是 code 值，并非数据库自增 id
        self.id: str = data.get('id', '')
        self.code: str = data.get('code', '')
        self.name: str = data.get('name', '')
        self.description: str = data.get('description', '')
        self.name_i18n: Dict[str, str] = data.get('name_i18n', {})
        self.description_i18n: Dict[str, str] = data.get('description_i18n', {})
        self.logo: str = data.get('logo', '')
        self.source_type: str = data.get('source_type', '')
        self.is_enabled: int = data.get('is_enabled', 0)
        self.pinned_at: Optional[str] = data.get('pinned_at')
        self.latest_published_at: Optional[str] = data.get('latest_published_at')
        # sandbox 路由未传 versionMap，该字段目前始终为空字符串
        self.latest_version: str = data.get('latest_version', '')
        # sandbox 路由未传 creatorMap，该字段目前始终为 None
        self.creator_info: Optional[Dict[str, Any]] = data.get('creator_info')
        self.updated_at: str = data.get('updated_at', '')
        self.created_at: str = data.get('created_at', '')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'name_i18n': self.name_i18n,
            'description_i18n': self.description_i18n,
            'logo': self.logo,
            'source_type': self.source_type,
            'is_enabled': self.is_enabled,
            'pinned_at': self.pinned_at,
            'latest_published_at': self.latest_published_at,
            'latest_version': self.latest_version,
            'creator_info': self.creator_info,
            'updated_at': self.updated_at,
            'created_at': self.created_at,
        }


class SkillListResult(AbstractResult):
    """Result for user skill list query"""

    def __init__(self, data: Dict[str, Any]):
        """
        Initialize skill list result

        Args:
            data: Raw response data from API
        """
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        list_data = self.get('list', [])
        self.items: List[SkillListItem] = [SkillListItem(item) for item in list_data]
        self.page: int = self.get('page', 1)
        self.page_size: int = self.get('page_size', 20)
        self.total: int = self.get('total', 0)

    def get_items(self) -> List[SkillListItem]:
        """Get skill list items"""
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
        return f"SkillListResult[page={self.page}, total={self.total}, count={len(self.items)}]"
