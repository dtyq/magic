"""
MagicBase base parameter.

Shared request header handling for MagicBase APIs hosted by Magic Service.
"""

from typing import Any, Dict, Optional

from agentlang.utils.metadata import MetadataUtil

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class MagicBaseBaseParameter(MagicServiceAbstractParameter):
    """Base parameter for MagicBase API requests."""

    def __init__(
        self,
        project_id: str,
        authorization: Optional[str] = None,
        organization_code: Optional[str] = None,
    ):
        super().__init__()
        self.project_id = str(project_id).strip() if project_id is not None else ""

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
        return {}

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
        if self._request_id:
            headers["request-id"] = self._request_id
        MetadataUtil.add_sandbox_id_header(headers)
        return headers

    def validate(self) -> None:
        if not self.project_id:
            raise ValueError("project_id is required")
        if not self.project_id.isdigit():
            raise ValueError("project_id must be a numeric string")
        if not self.user_authorization:
            raise ValueError("authorization is required for MagicBase agent tools")
        if not self.organization_code:
            raise ValueError("organization_code is required for MagicBase agent tools")
