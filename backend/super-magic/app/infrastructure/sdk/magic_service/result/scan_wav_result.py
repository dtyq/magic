"""
Scan WAV Result

Result class for the scan-wav API response.

# TEMP: Temporary result class for triggering MagicFS metadata refresh.
# Will be removed once MagicFS handles this automatically.
"""

from typing import Any, Dict

from app.infrastructure.sdk.base import AbstractResult


class ScanWavResult(AbstractResult):
    """Result for POST /api/v1/open-api/sandbox/file/scan-wav."""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def _parse_data(self) -> None:
        self.scanned: int = self.get("scanned", 0)
        self.inserted: int = self.get("inserted", 0)
        self.message: str = self.get("message", "")

    def get_scanned(self) -> int:
        """Total number of WAV files found in object storage."""
        return self.scanned

    def get_inserted(self) -> int:
        """Number of newly inserted file records (0 when fully idempotent)."""
        return self.inserted

    def get_message(self) -> str:
        """Result description from the server."""
        return self.message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scanned": self.scanned,
            "inserted": self.inserted,
            "message": self.message,
        }

    def __str__(self) -> str:
        return f"ScanWavResult(scanned={self.scanned}, inserted={self.inserted})"
