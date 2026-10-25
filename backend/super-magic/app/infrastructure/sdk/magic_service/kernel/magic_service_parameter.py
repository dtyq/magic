"""
Magic Service Abstract Parameter

Base class for all Magic Service API parameters with authentication support.
"""

from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional

from agentlang.utils.metadata import MetadataUtil
from app.infrastructure.sdk.base import AbstractParameter


@dataclass(frozen=True)
class MagicServiceAuthConfig:
    """会话内的可信请求身份；凭据不进入日志、Horizon 或工具结果。"""

    user_id: str
    organization_code: str
    user_authorization: str = field(repr=False)
    token: str | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        if not self.user_id or not self.organization_code or not self.user_authorization:
            raise ValueError("Current user authentication is incomplete")


class MagicServiceAbstractParameter(AbstractParameter):
    """Abstract base class for Magic Service API parameters with authentication"""

    def __init__(self, auth_config: MagicServiceAuthConfig | None = None):
        """Initialize parameter with authentication fields"""
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.user_authorization: Optional[str] = None
        self._request_id: Optional[str] = None
        self.organization_code: str | None = None

        if auth_config is not None:
            self.token = auth_config.token
            self.user_id = auth_config.user_id
            self.user_authorization = auth_config.user_authorization
            self.organization_code = auth_config.organization_code
            return

        # Automatically load auth config from init client message
        self._load_auth_config()

    def set_auth_config(self, token: str, user_id: Optional[str] = None) -> 'MagicServiceAbstractParameter':
        """
        Set authentication configuration

        Args:
            token: API access token
            user_id: User ID (optional)

        Returns:
            Self for method chaining
        """
        self.token = token
        self.user_id = user_id
        return self

    def get_access_token(self) -> Optional[str]:
        """Get access token"""
        return self.token

    def get_user_id(self) -> Optional[str]:
        """Get user ID"""
        return self.user_id

    def get_request_id(self) -> Optional[str]:
        """Get request ID"""
        return self._request_id

    def set_request_id(self, request_id: str) -> 'MagicServiceAbstractParameter':
        """
        Set request ID

        Args:
            request_id: Unique request identifier

        Returns:
            Self for method chaining
        """
        self._request_id = request_id
        return self

    def validate(self) -> None:
        """
        Validate parameter data including authentication

        Raises:
            ValueError: If required authentication fields are missing
        """
        if not self.token and not self.user_authorization:
            raise ValueError("Either access token or user authorization is required")

    @abstractmethod
    def to_body(self) -> Dict[str, Any]:
        """
        Convert parameter to request body

        Returns:
            Dict containing request body data
        """
        pass

    @abstractmethod
    def to_query_params(self) -> Dict[str, Any]:
        """
        Convert parameter to query parameters

        Returns:
            Dict containing query parameters
        """
        pass

    def to_headers(self) -> Dict[str, str]:
        """
        Generate headers for Magic Service requests

        Returns:
            Dict containing headers including authentication
        """
        headers = {
            'Accept': '*/*',
            'Connection': 'keep-alive'
        }

        if self.token:
            headers['token'] = self.token

        if self.user_id:
            headers['user-id'] = self.user_id

        if self.user_authorization:
            headers['user-authorization'] = self.user_authorization

        if self._request_id:
            headers['request-id'] = self._request_id

        MetadataUtil.add_sandbox_id_header(headers)
        return headers

    def to_options(self, method: str) -> Dict[str, Any]:
        """
        Convert parameter to HTTP request options for Magic Service

        Args:
            method: HTTP method (GET, POST, etc.)

        Returns:
            Dict containing all request options
        """
        options = {
            'headers': self.to_headers()
        }

        # Add query params for GET requests
        if method.upper() == 'GET':
            query_params = self.to_query_params()
            if query_params:
                options['params'] = query_params

        # Add body data for non-GET requests
        if method.upper() != 'GET':
            body_data = self.to_body()
            if body_data:
                options['json'] = body_data

        return options

    def _load_auth_config(self) -> None:
        """
        Load authentication configuration from init client message

        This method tries to automatically get user_id and user_authorization from
        InitClientMessageUtil. If it fails, the values remain None.
        """
        try:
            from app.utils.init_client_message_util import InitClientMessageUtil

            full_config = InitClientMessageUtil.get_full_config()

            # Get user_id from metadata
            metadata = full_config.get('metadata', {})
            self.user_id = metadata.get('user_id')
            # Get authorization using unified method
            self.user_authorization = InitClientMessageUtil.get_user_authorization()

        except Exception:
            # If loading fails, keep token, user_id and user_authorization as None
            # This allows the parameter to be used without init client message
            pass
