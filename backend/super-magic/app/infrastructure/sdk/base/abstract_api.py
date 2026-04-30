"""
SDK Base Abstract API

Base class for all SDK API implementations.
"""

from abc import ABC
from typing import Dict, Any, Optional
from urllib.parse import urljoin, urlparse
import uuid
import httpx

from .sdk_base import SdkBase
from .abstract_parameter import AbstractParameter
from .exceptions import HttpRequestError


class Request:
    """Simple request wrapper"""

    def __init__(self, method: str, url: str, options: Dict[str, Any], parameter: Optional[AbstractParameter] = None):
        self.method = method
        self.url = url
        self.options = options
        self.parameter = parameter

    def get_method(self) -> str:
        return self.method

    def get_url(self) -> str:
        return self.url

    def get_options(self) -> Dict[str, Any]:
        return self.options

    def get_parameter(self) -> Optional[AbstractParameter]:
        return self.parameter


def _prepare_request_options(request: Request) -> Dict[str, Any]:
    """
    Prepare request options for httpx

    Args:
        request: Request object

    Returns:
        Dict containing httpx request options
    """
    # Request options should already be prepared by parameter.to_options()
    return request.get_options().copy()


class AbstractApi(ABC):
    """Abstract base class for SDK APIs"""

    def __init__(self, sdk_base: SdkBase):
        """
        Initialize API with SDK base

        Args:
            sdk_base: SdkBase instance for making HTTP requests
        """
        self.sdk_base = sdk_base

    def request_by_parameter(self, parameter: AbstractParameter, method: str, endpoint_path: str) -> httpx.Response:
        """
        Execute request using parameter object

        Args:
            parameter: AbstractParameter instance
            method: HTTP method (GET, POST, etc.)
            endpoint_path: API endpoint path

        Returns:
            Raw HTTP response object
        """
        # Validate parameter
        parameter.validate()

        # Get request options from parameter
        options = parameter.to_options(method)

        # Create request
        request = Request(
            method=method,
            url=endpoint_path,
            options=options,
            parameter=parameter
        )

        # Execute request
        return self._execute_request(request)

    async def request_by_parameter_async(self, parameter: AbstractParameter, method: str, endpoint_path: str) -> httpx.Response:
        """
        Execute async request using parameter object

        Args:
            parameter: AbstractParameter instance
            method: HTTP method (GET, POST, etc.)
            endpoint_path: API endpoint path

        Returns:
            Raw HTTP response object
        """
        # Validate parameter
        parameter.validate()

        # Get request options from parameter
        options = parameter.to_options(method)

        # Create request
        request = Request(
            method=method,
            url=endpoint_path,
            options=options,
            parameter=parameter
        )

        # Execute async request
        return await self._execute_request_async(request)

    # 不打印到日志的敏感 header 名（全小写匹配）
    _SENSITIVE_HEADERS = frozenset({
        'authorization',
        'proxy-authorization',
        'user-authorization',
        'cookie',
        'set-cookie',
        'x-api-key',
        'api-key',
        'x-auth-token',
    })

    def _mask_headers(self, headers: Dict[str, Any]) -> Dict[str, Any]:
        """将敏感 header 的值替换为 ***"""
        return {
            k: '***' if k.lower() in self._SENSITIVE_HEADERS else v
            for k, v in headers.items()
        }

    def _log_request(self, method: str, url: str, options: Dict[str, Any], request_id: str) -> None:
        """记录请求的 method、URL、headers（脱敏）和 body 到 info 日志"""
        logger = self.sdk_base.get_logger()
        if logger is None:
            return
        raw_headers = options.get('headers', {})
        params = options.get('params')
        json_body = options.get('json')
        data = options.get('data')
        logger.info(
            f"SDK request [{request_id}]: {method} {url} | "
            f"headers={self._mask_headers(raw_headers)} | "
            f"params={params} | "
            f"json={json_body} | "
            f"data={data}"
        )

    def _inject_request_id(self, options: Dict[str, Any]) -> str:
        """向 options['headers'] 中注入 request-id，返回生成的 id"""
        request_id = str(uuid.uuid4())
        headers = options.get('headers', {})
        headers['request-id'] = request_id
        options['headers'] = headers
        return request_id

    def _execute_request(self, request: Request) -> httpx.Response:
        """
        Execute HTTP request

        Args:
            request: Request object

        Returns:
            HTTP response object

        Raises:
            HttpRequestError: If request execution fails
        """
        try:
            options = _prepare_request_options(request)
            url = self._get_full_url(request.get_url())
            request_id = self._inject_request_id(options)

            self._log_request(request.get_method(), url, options, request_id)

            response = self.sdk_base.get_client().request(
                request.get_method(),
                url,
                **options
            )

            # Basic HTTP error handling
            response.raise_for_status()
            return response

        except httpx.HTTPStatusError as e:
            raise HttpRequestError(f"HTTP {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise HttpRequestError(f"Request failed: {e}")

    async def _execute_request_async(self, request: Request) -> httpx.Response:
        """
        Execute async HTTP request

        Args:
            request: Request object

        Returns:
            HTTP response object

        Raises:
            HttpRequestError: If request execution fails
        """
        try:
            options = _prepare_request_options(request)
            url = self._get_full_url(request.get_url())
            request_id = self._inject_request_id(options)

            self._log_request(request.get_method(), url, options, request_id)

            response = await self.sdk_base.get_async_client().request(
                request.get_method(),
                url,
                **options
            )

            # Basic HTTP error handling
            response.raise_for_status()
            return response

        except httpx.HTTPStatusError as e:
            raise HttpRequestError(f"HTTP {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise HttpRequestError(f"Async request failed: {e}")

    def _get_full_url(self, url: str) -> str:
        """
        Get full URL for request

        Args:
            url: Relative or absolute URL

        Returns:
            Full URL string
        """
        parsed_url = urlparse(url)
        if not parsed_url.netloc:
            # Relative URL, combine with base URL.
            # Ensure base ends with '/' and url has no leading '/' so that
            # urljoin preserves any sub-path prefix in base_url (e.g. /_/magic-service).
            base_url = self._get_base_url()
            if not base_url.endswith('/'):
                base_url += '/'
            return urljoin(base_url, url.lstrip('/'))
        else:
            # Absolute URL
            return url

    def _get_base_url(self) -> str:
        """
        Get base URL from configuration

        Returns:
            Base URL string

        Raises:
            ValueError: If base URL is not configured
        """
        config = self.sdk_base.get_config()
        base_url = config.get('base_url', '')

        if not base_url:
            raise ValueError('SDK base URL must be configured')

        return base_url
