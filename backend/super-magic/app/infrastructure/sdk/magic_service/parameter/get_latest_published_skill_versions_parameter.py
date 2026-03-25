"""
Get Latest Published Skill Versions Parameter

Parameter class for querying the latest published version of skills by codes.
Endpoint: POST /api/v1/open-api/sandbox/skills/last-versions/queries
"""

from typing import Dict, Any, List, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class GetLatestPublishedSkillVersionsParameter(MagicServiceAbstractParameter):
    """Parameter for querying latest published skill versions by codes"""

    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
        codes: Optional[List[str]] = None,
        keyword: Optional[str] = None,
    ):
        """
        Initialize parameter

        Args:
            page: Page number, min 1, defaults to 1
            page_size: Page size, min 1, max 100, defaults to 20
            codes: List of skill codes to query, max 200 items, each max 64 chars
            keyword: Search keyword, max 255 characters
        """
        super().__init__()
        self.page = page
        self.page_size = page_size
        self.codes = codes
        self.keyword = keyword

    def to_body(self) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            'page': self.page,
            'page_size': self.page_size,
        }
        if self.codes is not None:
            body['codes'] = self.codes
        if self.keyword is not None:
            body['keyword'] = self.keyword
        return body

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        if self.page < 1:
            raise ValueError("page must be at least 1")
        if self.page_size < 1 or self.page_size > 100:
            raise ValueError("page_size must be between 1 and 100")
        if self.codes is not None and len(self.codes) > 200:
            raise ValueError("codes must not exceed 200 items")
