"""
Query Skills Parameter

Parameter class for querying user skill list and skill market list.
Both /skills/queries and /skill-market/queries share the same query fields.
"""

from typing import Dict, Any, List, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class QuerySkillsParameter(MagicServiceAbstractParameter):
    """Parameter for querying skill list (user skills or skill market)"""

    def __init__(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        keyword: Optional[str] = None,
        source_type: Optional[str] = None,
        publisher_type: Optional[str] = None,
        codes: Optional[List[str]] = None,
    ):
        """
        Initialize query skills parameter

        Args:
            page: Page number, min 1
            page_size: Page size, min 1, max 1000
            keyword: Search keyword, max 255 characters
            source_type: Skill source type filter
            publisher_type: Publisher type filter, one of: USER, OFFICIAL, VERIFIED_CREATOR, PARTNER
            codes: Filter by exact skill codes (pending backend support)
        """
        super().__init__()
        self.page = page
        self.page_size = page_size
        self.keyword = keyword
        self.source_type = source_type
        self.publisher_type = publisher_type
        self.codes = codes

    def to_body(self) -> Dict[str, Any]:
        """
        Convert parameter to request body

        Returns:
            Dict containing non-None query fields
        """
        body: Dict[str, Any] = {}
        if self.page is not None:
            body['page'] = self.page
        if self.page_size is not None:
            body['page_size'] = self.page_size
        if self.keyword is not None:
            body['keyword'] = self.keyword
        if self.source_type is not None:
            body['source_type'] = self.source_type
        if self.publisher_type is not None:
            body['publisher_type'] = self.publisher_type
        if self.codes is not None:
            body['codes'] = self.codes
        return body

    def to_query_params(self) -> Dict[str, Any]:
        """Not used for POST requests"""
        return {}

    def validate(self) -> None:
        """
        Validate parameter data

        Raises:
            ValueError: If any field has an invalid value
        """
        super().validate()
        if self.page is not None and self.page < 1:
            raise ValueError("page must be at least 1")
        if self.page_size is not None and (self.page_size < 1 or self.page_size > 1000):
            raise ValueError("page_size must be between 1 and 1000")
        valid_publisher_types = ('USER', 'OFFICIAL', 'VERIFIED_CREATOR', 'PARTNER')
        if self.publisher_type is not None and self.publisher_type not in valid_publisher_types:
            raise ValueError(f"publisher_type must be one of: {', '.join(valid_publisher_types)}")
