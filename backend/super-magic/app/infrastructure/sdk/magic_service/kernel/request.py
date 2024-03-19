"""
Magic Service Request

Encapsulates HTTP request details for Magic Service APIs.
"""

from typing import Dict, Any, Optional, Union, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from .abstract_parameter import AbstractParameter


class RequestMethod(Enum):
    """HTTP request methods"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class Request:
    """Magic Service API request wrapper"""

    def __init__(
        self,
        method: Union[RequestMethod, str],
        url: str,
        options: Optional[Dict[str, Any]] = None,
        parameter: Optional['AbstractParameter'] = None
    ):
        """
        Initialize request

        Args:
            method: HTTP method
            url: Request URL (can be relative or absolute)
            options: Request options (headers, params, data, etc.)
            parameter: Parameter object containing request data
        """
        self.method = method.value if isinstance(method, RequestMethod) else method
        self.url = url
        self.options = options or {}
        self.parameter = parameter

    def get_method(self) -> str:
        """Get HTTP method"""
        return self.method

    def get_url(self) -> str:
        """Get request URL"""
        return self.url

    def get_options(self) -> Dict[str, Any]:
        """Get request options"""
        return self.options.copy()

    def get_parameter(self) -> Optional['AbstractParameter']:
        """Get parameter object"""
        return self.parameter

    def merge_options(self, additional_options: Dict[str, Any]) -> 'Request':
        """
        Create new request with merged options

        Args:
            additional_options: Additional options to merge

        Returns:
            New Request instance with merged options
        """
        merged_options = self.options.copy()
        merged_options.update(additional_options)

        return Request(
            method=self.method,
            url=self.url,
            options=merged_options,
            parameter=self.parameter
        )

    def with_headers(self, headers: Dict[str, str]) -> 'Request':
        """
        Create new request with additional headers

        Args:
            headers: Headers to add

        Returns:
            New Request instance with additional headers
        """
        current_headers = self.options.get('headers', {})
        new_headers = {**current_headers, **headers}

        return self.merge_options({'headers': new_headers})

    def with_params(self, params: Dict[str, Any]) -> 'Request':
        """
        Create new request with query parameters

        Args:
            params: Query parameters to add

        Returns:
            New Request instance with parameters
        """
        return self.merge_options({'params': params})

    def with_json(self, data: Dict[str, Any]) -> 'Request':
        """
        Create new request with JSON data

        Args:
            data: JSON data to send

        Returns:
            New Request instance with JSON data
        """
        return self.merge_options({'json': data})
