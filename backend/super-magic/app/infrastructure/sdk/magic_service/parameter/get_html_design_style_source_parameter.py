"""
Get HTML Design Style Source Parameter

Parameter class for fetching a bundled DESIGN.md source document from Magic Service.
Endpoint: GET /api/v1/open-api/sandbox/html-design-styles/{style_code}/source
"""

import re
from typing import Any, Dict

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter

STYLE_CODE_PATTERN = r"^[a-z0-9][a-z0-9.-]*$"


class GetHtmlDesignStyleSourceParameter(MagicServiceAbstractParameter):
    """Parameter for reading a raw design style source by style_code."""

    def __init__(self, style_code: str):
        super().__init__()
        self.style_code = style_code

    def to_body(self) -> Dict[str, Any]:
        return {}

    def to_query_params(self) -> Dict[str, Any]:
        return {}

    def validate(self) -> None:
        super().validate()
        if not isinstance(self.style_code, str):
            raise ValueError("style_code must be a string")
        style_code = self.style_code.strip()
        if not style_code or not re.fullmatch(STYLE_CODE_PATTERN, style_code):
            raise ValueError("style_code contains invalid characters")

    def get_style_code(self) -> str:
        return self.style_code.strip()
