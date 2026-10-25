"""
Update Crew Result

Result class for the Crew update API response.
"""

from typing import Dict, Any
from app.infrastructure.sdk.base import AbstractResult


class UpdateCrewResult(AbstractResult):
    """Result for updating a Crew via the open API."""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        """Parse raw data into structured attributes"""
        self.id = self.get('id', '')
        self.code = self.get('code', '')
        self.name_i18n = self.get('name_i18n', {})
        self.description_i18n = self.get('description_i18n', {})
        self.role_i18n = self.get('role_i18n', {})
