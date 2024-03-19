"""
Magic Gateway SDK

Main SDK class providing access to all Magic Gateway APIs.
"""

import hashlib
from typing import Dict, Any
from app.infrastructure.sdk.base import SdkBase, SdkContext
from .api.sign_api import SignApi


class MagicGateway:
    """Magic Gateway SDK - Main router for all Magic Gateway operations"""

    NAME = 'magic_gateway'

    def __init__(self, sdk_base: SdkBase):
        """
        Initialize Magic Gateway SDK

        Args:
            sdk_base: SdkBase instance for HTTP operations
        """
        # Create unique key for this instance
        config_data = sdk_base.get_config().to_dict()
        self.key = hashlib.md5(
            f"{self.NAME}{str(config_data)}".encode()
        ).hexdigest()

        # Register in global context if not already registered
        if not SdkContext.has(self.key):
            SdkContext.register(self.key, sdk_base)

        # Initialize API routes
        self._routes = {
            'sign': SignApi
        }

        # Initialize fetched API instances
        self._fetched_definitions = {}
        self._register_apis(sdk_base)

    def __getattr__(self, name: str):
        """
        Magic method to provide property-style access to APIs

        Args:
            name: API name to access

        Returns:
            API instance

        Raises:
            AttributeError: If API route not found
        """
        api_instance = self._fetched_definitions.get(name)
        if api_instance is None:
            raise AttributeError(f"No API route found for '{name}'. Available routes: {list(self._routes.keys())}")
        return api_instance

    @property
    def sign(self) -> SignApi:
        """Get sign API instance"""
        return self._fetched_definitions['sign']

    def get_host(self) -> str:
        """
        Get Magic Gateway host URL

        Returns:
            Host URL string
        """
        sdk_base = SdkContext.get(self.key)
        config = sdk_base.get_config()
        return config.get('base_url', '')

    def get_sdk_base(self) -> SdkBase:
        """
        Get underlying SdkBase instance

        Returns:
            SdkBase instance
        """
        return SdkContext.get(self.key)

    def close(self) -> None:
        """Close SDK resources"""
        sdk_base = SdkContext.get(self.key)
        if sdk_base:
            sdk_base.close()
        SdkContext.remove(self.key)

    def _register_apis(self, sdk_base: SdkBase) -> None:
        """
        Register all API instances

        Args:
            sdk_base: SdkBase instance
        """
        for route_name, api_class in self._routes.items():
            self._fetched_definitions[route_name] = api_class(sdk_base)

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()
