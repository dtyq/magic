"""
Update File Source Result

Result class for the update-file-source API response.
"""

from typing import Any, Dict

from app.infrastructure.sdk.base import AbstractResult


class UpdateFileSourceResult(AbstractResult):
    """Result for PATCH /api/v1/open-api/sandbox/file/source."""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.file_id: int = self.get("file_id", 0)
        self.source: int = self.get("source", 0)

    def get_file_id(self) -> int:
        """File ID that was updated."""
        return self.file_id

    def get_source(self) -> int:
        """Updated source enum value."""
        return self.source

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_id": self.file_id,
            "source": self.source,
        }

    def __str__(self) -> str:
        return f"UpdateFileSourceResult(file_id={self.file_id}, source={self.source})"
