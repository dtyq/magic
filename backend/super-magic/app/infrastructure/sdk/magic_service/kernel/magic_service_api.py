"""
Magic Service Abstract API

Base class for all Magic Service API implementations with authentication support.
"""

from typing import Dict, Any, Optional
import httpx

from app.infrastructure.sdk.base import AbstractApi, SdkBase
from .magic_service_parameter import MagicServiceAbstractParameter
from .magic_service_exception import (
    MagicServiceException,
    MagicServiceUnauthorizedException,
    MagicServiceApiError
)


def _process_magic_service_response(response: httpx.Response) -> Dict[str, Any]:
    """
    Process Magic Service specific response format

    Args:
        response: HTTP response object

    Returns:
        Dict containing extracted data

    Raises:
        MagicServiceException: If response processing fails
        MagicServiceUnauthorizedException: If authentication fails
        MagicServiceApiError: If API returns error response
    """
    # Parse JSON response
    try:
        body = response.json()
    except Exception as e:
        raise MagicServiceException(f"Failed to parse JSON response: {e}")

    if not body:
        return {}

    # Validate response structure
    if not isinstance(body, dict):
        raise MagicServiceException("Invalid response format: expected JSON object")

    # Check for authentication error
    code = body.get('code')
    if code == 401:
        raise MagicServiceUnauthorizedException('Magic Service unauthorized', 401)

    # Check for other API errors
    if code != 1000:  # Magic Service success code is 1000
        message = body.get('message', 'Magic Service error')
        raise MagicServiceApiError(message, 500, code)

    return body.get('data', {})


class MagicServiceAbstractApi(AbstractApi):
    """Abstract base class for Magic Service APIs with authentication"""

    def __init__(self, sdk_base: SdkBase):
        """
        Initialize Magic Service API

        Args:
            sdk_base: SdkBase instance for making HTTP requests
        """
        super().__init__(sdk_base)

    def request_by_parameter(self, parameter: MagicServiceAbstractParameter, method: str, endpoint_path: str) -> Dict[str, Any]:
        """
        Execute request using Magic Service parameter object

        Args:
            parameter: MagicServiceAbstractParameter instance
            method: HTTP method (GET, POST, etc.)
            endpoint_path: API endpoint path

        Returns:
            Dict containing API response data
        """
        # Execute base request
        response = super().request_by_parameter(parameter, method, endpoint_path)

        # Process Magic Service specific response
        return _process_magic_service_response(response)

    async def request_by_parameter_async(self, parameter: MagicServiceAbstractParameter, method: str, endpoint_path: str) -> Dict[str, Any]:
        """
        Execute async request using Magic Service parameter object

        Args:
            parameter: MagicServiceAbstractParameter instance
            method: HTTP method (GET, POST, etc.)
            endpoint_path: API endpoint path

        Returns:
            Dict containing API response data
        """
        # Execute base async request
        response = await super().request_by_parameter_async(parameter, method, endpoint_path)

        # Process Magic Service specific response
        return _process_magic_service_response(response)
