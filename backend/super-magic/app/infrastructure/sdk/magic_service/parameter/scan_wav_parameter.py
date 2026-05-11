"""
Scan WAV Parameter

Parameter class for the scan-wav API endpoint.

# TEMP: Temporary parameter for triggering MagicFS metadata refresh before
# local audio file scanning. Will be removed once MagicFS handles this automatically.
"""

from typing import Any, Dict, Optional

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class ScanWavParameter(MagicServiceAbstractParameter):
    """Parameter for POST /api/v1/open-api/sandbox/file/scan-wav."""

    def __init__(
        self,
        project_id: str,
        relative_path: str,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        """
        Initialize scan-wav parameter.

        Args:
            project_id: Project ID the directory belongs to.
            relative_path: Workspace-relative path, e.g. '.asr_recordings/session_xxx'.
            authorization: SandboxUserAuth token; auto-loaded from InitClientMessage if omitted.
            organization_code: Organization code for the request header;
                               auto-loaded from metadata if omitted.
        """
        super().__init__()
        self.project_id = project_id
        self.relative_path = relative_path

        # Override the auth value loaded by base class if caller provides one explicitly
        if authorization is not None:
            self.user_authorization = authorization

        # organization_code is loaded separately because the base class does not handle it
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
            "project_id": self.project_id,
            "relative_path": self.relative_path,
        }

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def to_headers(self) -> Dict[str, str]:
        # The API uses standard `Authorization` header (not `user-authorization`)
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
        if not self.project_id:
            raise ValueError("project_id is required")
        if not self.relative_path:
            raise ValueError("relative_path is required")
