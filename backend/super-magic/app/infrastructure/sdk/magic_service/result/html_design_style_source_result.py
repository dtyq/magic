"""
HTML Design Style Source Result

Result class for the design style source API response
(/api/v1/open-api/sandbox/html-design-styles/{style_code}/source).
"""

from typing import Any, Dict

from app.infrastructure.sdk.base import AbstractResult


class HtmlDesignStyleSourceResult(AbstractResult):
    """Result carrying the raw DESIGN.md content for one style code."""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.style_code: str = str(self.get('style_code', ''))
        self.content: str = str(self.get('content', ''))
        self.sha256: str = str(self.get('sha256', ''))

    def to_dict(self) -> Dict[str, Any]:
        return {
            'style_code': self.style_code,
            'content': self.content,
            'sha256': self.sha256,
        }