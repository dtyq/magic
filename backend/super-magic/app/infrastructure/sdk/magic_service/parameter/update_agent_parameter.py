"""
Update Agent Parameter

Parameter class for updating agent via open-api.
"""

from typing import Dict, Any, Optional
from ..kernel.magic_service_parameter import MagicServiceAbstractParameter


class UpdateAgentParameter(MagicServiceAbstractParameter):
    """Parameter for update agent via open-api"""

    def __init__(
        self,
        code: str,
        name_i18n: Optional[Dict[str, str]] = None,
        description_i18n: Optional[Dict[str, str]] = None,
        role_i18n: Optional[Dict[str, Any]] = None,
        prompt_shadow: Optional[str] = None,
        icon: Optional[Dict[str, str]] = None,
        icon_type: Optional[int] = None,
    ):
        """
        Initialize update agent parameter

        Args:
            code: Agent code
            name_i18n: Multilingual name, e.g. {"zh_CN": "名称", "en_US": "Name"}
            description_i18n: Multilingual description
            role_i18n: Multilingual role definition
            prompt_shadow: Obfuscated prompt (ShadowCode encoded)
            icon: Icon config, e.g. {"type": "image", "value": "..."}
            icon_type: Icon type, 1=icon, 2=image
        """
        super().__init__()
        self.code = code
        self.name_i18n = name_i18n
        self.description_i18n = description_i18n
        self.role_i18n = role_i18n
        self.prompt_shadow = prompt_shadow
        self.icon = icon
        self.icon_type = icon_type

    def get_code(self) -> str:
        """Get agent code"""
        return self.code

    def to_body(self) -> Dict[str, Any]:
        """Convert parameter to request body (partial update)"""
        body = {}
        if self.name_i18n is not None:
            body['name_i18n'] = self.name_i18n
        if self.description_i18n is not None:
            body['description_i18n'] = self.description_i18n
        if self.role_i18n is not None:
            body['role_i18n'] = self.role_i18n
        if self.prompt_shadow is not None:
            body['prompt_shadow'] = self.prompt_shadow
        if self.icon is not None:
            body['icon'] = self.icon
        if self.icon_type is not None:
            body['icon_type'] = self.icon_type
        return body

    def to_query_params(self) -> Dict[str, Any]:
        """PUT request, no query params"""
        return {}

    def to_options(self, method: str) -> Dict[str, Any]:
        """Convert to HTTP request options for PUT"""
        options = {
            'headers': self.to_headers()
        }
        body_data = self.to_body()
        if body_data:
            options['json'] = body_data
        return options

    def validate(self) -> None:
        """Validate parameter data"""
        super().validate()
        if not self.code:
            raise ValueError("Agent code is required")
