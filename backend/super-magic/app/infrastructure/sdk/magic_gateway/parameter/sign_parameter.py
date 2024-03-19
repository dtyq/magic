"""
Sign Parameter

Parameter class for Magic Gateway signing API.
"""

import os
from typing import Dict, Any

from agentlang.utils.metadata import MetadataUtil
from app.infrastructure.sdk.base import AbstractParameter


class SignParameter(AbstractParameter):
    """Parameter for Magic Gateway signing API"""

    def __init__(self, data: str):
        """
        Initialize sign parameter

        Args:
            data: Data to be signed
        """
        self.data = data

    def validate(self) -> None:
        """
        Validate parameter data

        Raises:
            ValueError: If required fields are missing or invalid
        """
        if not self.data:
            raise ValueError("Data is required for signing")

        if not isinstance(self.data, str):
            raise ValueError("Data must be a string")

    def to_options(self, method: str) -> Dict[str, Any]:
        """
        Convert parameter to HTTP request options

        Args:
            method: HTTP method (should be POST for signing)

        Returns:
            Dict containing request options
        """
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        # 添加 Magic-Authorization 与 User-Authorization 请求头
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        options = {'headers': headers}

        if method.upper() == 'POST':
            options['json'] = {
                'data': self.data
            }

        return options

    def get_data(self) -> str:
        """Get data to be signed"""
        return self.data
