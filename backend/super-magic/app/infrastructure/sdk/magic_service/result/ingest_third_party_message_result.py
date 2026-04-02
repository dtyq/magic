"""
Ingest Third Party Message Result

Result class for third-party IM inbound message persistence API response.
"""

from typing import Any, Dict, Optional

from app.infrastructure.sdk.base import AbstractResult


class IngestThirdPartyMessageResult(AbstractResult):
    """Result for ingest-third-party-message API."""

    task_id: Optional[str]
    message_id: Optional[str]
    im_seq_id: Optional[str]
    deduplicated: bool

    def _parse_data(self) -> None:
        self.task_id = self.get("task_id")
        self.message_id = self.get("message_id")
        self.im_seq_id = self.get("im_seq_id")
        self.deduplicated = bool(self.get("deduplicated", False))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "message_id": self.message_id,
            "im_seq_id": self.im_seq_id,
            "deduplicated": self.deduplicated,
        }
