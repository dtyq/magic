"""
Share Resource ID Parameter

Parameter class for generating a snowflake resource ID before creating a file/file-collection share.
"""

from typing import Dict, Any
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class ShareResourceIdParameter(MagicServiceAbstractParameter):
    """Parameter for generating a share resource ID (no request body required)"""

    def __init__(self):
        super().__init__()

    def to_body(self) -> Dict[str, Any]:
        """No request body needed"""
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        """No query parameters needed"""
        return {}
