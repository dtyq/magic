"""
Cancel Share Parameter

Parameter class for cancelling (soft-deleting) a share by resource ID.
"""

from typing import Dict, Any
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class CancelShareParameter(MagicServiceAbstractParameter):
    """Parameter for cancelling a share"""

    def __init__(self, resource_id: str):
        """
        Args:
            resource_id: The resource ID to cancel (same value passed as resource_id when creating the share)
        """
        super().__init__()
        self.resource_id = resource_id

    def get_resource_id(self) -> str:
        """Return the resource ID used in the URL path"""
        return self.resource_id

    def to_body(self) -> Dict[str, Any]:
        """No request body needed for cancel"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        if not self.resource_id:
            raise ValueError("resource_id is required")
