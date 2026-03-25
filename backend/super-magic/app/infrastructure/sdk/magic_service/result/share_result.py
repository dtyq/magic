"""
Share Results

Result classes for share management Open API responses.
"""

from typing import Dict, Any, List, Optional
from app.infrastructure.sdk.base import AbstractResult


class ShareResourceIdResult(AbstractResult):
    """Result for generate resource ID endpoint"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.id: str = self.get('id', '')


class ShareResult(AbstractResult):
    """Result for a single share record (create/update or find-similar item)"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.id: str = self.get('id', '')
        self.resource_id: str = self.get('resource_id', '')
        self.resource_type: int = self.get('resource_type', 0)
        self.resource_type_name: str = self.get('resource_type_name', '')
        self.share_code: str = self.get('share_code', '')
        self.has_password: bool = self.get('has_password', False)
        self.share_type: int = self.get('share_type', 0)
        self.extra: Dict[str, Any] = self.get('extra') or {}
        self.default_open_file_id: Optional[str] = self.get('default_open_file_id')
        self.project_id: Optional[str] = self.get('project_id')
        self.resource_name: str = self.get('resource_name', '')
        self.share_project: bool = self.get('share_project', False)
        self.share_range: Optional[str] = self.get('share_range')
        self.target_ids: list = self.get('target_ids') or []
        self.expire_at: Optional[str] = self.get('expire_at')
        self.expire_days: Optional[int] = self.get('expire_days')
        self.main_file_name: Optional[str] = self.get('main_file_name')

        # Extended fields returned by find-similar
        self.password: Optional[str] = self.get('password')
        self.file_ids: List[str] = self.get('file_ids') or []
        self.extend: Dict[str, Any] = self.get('extend') or {}
        self.view_count: int = self.get('view_count', 0)


class CancelShareResult(AbstractResult):
    """Result for cancel share endpoint"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.id: str = self.get('id', '')


class FindSimilarSharesResult:
    """Result wrapper for find-similar shares endpoint (returns a list)"""

    def __init__(self, data: list):
        self.items: List[ShareResult] = [
            ShareResult(item) for item in (data or [])
        ]

    def __iter__(self):
        return iter(self.items)

    def __len__(self) -> int:
        return len(self.items)

    def is_empty(self) -> bool:
        return len(self.items) == 0

    def first(self) -> Optional[ShareResult]:
        """Return the first share result, or None if empty"""
        return self.items[0] if self.items else None
