"""
Update File Source Parameter

Parameter class for the update-file-source API endpoint.
"""

from enum import IntEnum
from typing import Any, Dict, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class FileSource(IntEnum):
    """Enumeration of file source values."""
    DEFAULT = 0
    HOME = 1
    PROJECT_DIRECTORY = 2
    AGENT = 3
    COPY = 4
    AI_IMAGE_GENERATION = 5
    MOVE = 6
    AI_VIDEO_GENERATION = 7
    SKILL = 8


class UpdateFileSourceParameter(MagicServiceAbstractParameter):
    """Parameter for PATCH /api/v1/open-api/sandbox/file/source."""

    def __init__(
        self,
        file_id: int,
        source: FileSource,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        """
        Initialize update-file-source parameter.

        Args:
            file_id: File ID (positive integer).
            source: File source enum value.
            authorization: SandboxUserAuth token; auto-loaded from InitClientMessage if omitted.
            organization_code: Organization code for the request header;
                               auto-loaded from metadata if omitted.
        """
        super().__init__()
        self.file_id = file_id
        self.source = source

        if authorization is not None:
            self.user_authorization = authorization

        if organization_code is not None:
            self.organization_code = organization_code
        else:
            self._load_organization_code()

    def _load_organization_code(self) -> None:
        """Auto-load organization_code from InitClientMessage metadata."""
        try:
            from app.utils.init_client_message_util import InitClientMessageUtil
            metadata = InitClientMessageUtil.get_metadata()
            self.organization_code: Optional[str] = metadata.get("organization_code")
        except Exception:
            self.organization_code = None

    def to_body(self) -> Dict[str, Any]:
        return {
            "file_id": self.file_id,
            "source": int(self.source),
        }

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def to_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": "*/*",
            "Connection": "keep-alive",
        }
        if self.user_authorization:
            headers["Authorization"] = self.user_authorization
        if self.organization_code:
            headers["organization-code"] = self.organization_code
        return headers

    def validate(self) -> None:
        if not self.file_id or self.file_id <= 0:
            raise ValueError("file_id must be a positive integer")
        if not isinstance(self.source, FileSource):
            raise ValueError(f"source must be a FileSource enum value, got {self.source!r}")
