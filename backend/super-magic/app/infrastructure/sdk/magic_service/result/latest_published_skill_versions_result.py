"""
Latest Published Skill Versions Result

Result class for latest published skill versions query response
(/skills/last-versions/queries).
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class LatestPublishedSkillVersionItem:
    """Single item in the latest published skill versions list"""

    def __init__(self, data: Dict[str, Any]):
        self.id: str = data.get('id', '')
        self.code: str = data.get('code', '')
        self.version: str = data.get('version', '')
        self.name: str = data.get('name', '')
        self.description: str = data.get('description', '')
        self.name_i18n: Dict[str, str] = data.get('name_i18n', {})
        self.description_i18n: Optional[Dict[str, str]] = data.get('description_i18n')
        self.logo: str = data.get('logo', '')
        self.file_key: Optional[str] = data.get('file_key')
        self.file_url: Optional[str] = data.get('file_url')
        self.source_type: str = data.get('source_type', '')
        self.publish_status: str = data.get('publish_status', '')
        self.review_status: Optional[str] = data.get('review_status')
        self.publish_target_type: str = data.get('publish_target_type', '')
        self.published_at: Optional[str] = data.get('published_at')
        self.project_id: Optional[str] = data.get('project_id')
        self.created_at: Optional[str] = data.get('created_at')
        self.updated_at: Optional[str] = data.get('updated_at')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'code': self.code,
            'version': self.version,
            'name': self.name,
            'description': self.description,
            'name_i18n': self.name_i18n,
            'description_i18n': self.description_i18n,
            'logo': self.logo,
            'file_key': self.file_key,
            'file_url': self.file_url,
            'source_type': self.source_type,
            'publish_status': self.publish_status,
            'review_status': self.review_status,
            'publish_target_type': self.publish_target_type,
            'published_at': self.published_at,
            'project_id': self.project_id,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }


class LatestPublishedSkillVersionsResult(AbstractResult):
    """Result for latest published skill versions query"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        list_data = self.get('list', [])
        self.items: List[LatestPublishedSkillVersionItem] = [
            LatestPublishedSkillVersionItem(item) for item in list_data
        ]
        self.page: int = self.get('page', 1)
        self.page_size: int = self.get('page_size', 20)
        self.total: int = self.get('total', 0)

    def get_items(self) -> List[LatestPublishedSkillVersionItem]:
        return self.items

    def get_page(self) -> int:
        return self.page

    def get_page_size(self) -> int:
        return self.page_size

    def get_total(self) -> int:
        return self.total

    def to_dict(self) -> Dict[str, Any]:
        return {
            'list': [item.to_dict() for item in self.items],
            'page': self.page,
            'page_size': self.page_size,
            'total': self.total,
        }

    def __str__(self) -> str:
        return f"LatestPublishedSkillVersionsResult[page={self.page}, total={self.total}, count={len(self.items)}]"
