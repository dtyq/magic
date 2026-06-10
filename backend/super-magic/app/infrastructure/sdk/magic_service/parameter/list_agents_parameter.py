"""
List Agents Parameter

Parameter class for listing user's available agents.
"""

from typing import Dict, Any
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class ListAgentsParameter(MagicServiceAbstractParameter):
    """Parameter for list agents (featured) API"""

    def __init__(self):
        super().__init__()

    def to_body(self) -> Dict[str, Any]:
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
