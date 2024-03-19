"""
Sign Result

Result class for Magic Gateway signing API response.
"""

import httpx
from typing import Dict, Any, Optional
from ..exceptions import MagicGatewaySignError


class SignResult:
    """Result class for Magic Gateway signing API"""

    def __init__(self, response: httpx.Response):
        """
        Initialize sign result from HTTP response

        Args:
            response: HTTP response from signing API

        Raises:
            MagicGatewaySignError: If response indicates an error
        """
        self._response = response
        self._data = None

        try:
            self._data = response.json()
        except Exception as e:
            raise MagicGatewaySignError(f"Failed to parse response JSON: {e}")

        # Check for API errors
        if not self._data or 'signature' not in self._data:
            error_msg = self._data.get('error', 'Unknown error') if self._data else 'Invalid response format'
            raise MagicGatewaySignError(f"Signing failed: {error_msg}")

    def get_signature(self) -> str:
        """
        Get the signature from response

        Returns:
            Signature string
        """
        return self._data['signature']

    def get_raw_response(self) -> httpx.Response:
        """
        Get raw HTTP response

        Returns:
            Raw HTTP response object
        """
        return self._response

    def get_response_data(self) -> Dict[str, Any]:
        """
        Get parsed response data

        Returns:
            Response data dictionary
        """
        return self._data

    def is_success(self) -> bool:
        """
        Check if signing was successful

        Returns:
            True if successful, False otherwise
        """
        return 'signature' in self._data and bool(self._data['signature'])
