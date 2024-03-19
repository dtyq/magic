"""
SDK Base Core Container

SDK core container, similar to PHP version's simple design
"""

from typing import Dict, Any, Optional, Union, Protocol
import httpx

from .config import Config
from .logger import LoggerProxy


class LoggerInterface(Protocol):
    """Logger interface for duck typing compatibility"""
    def info(self, message: str, **kwargs) -> None: ...
    def error(self, message: str, **kwargs) -> None: ...
    def debug(self, message: str, **kwargs) -> None: ...
    def warning(self, message: str, **kwargs) -> None: ...


class SdkBase:
    """SDK core container, similar to PHP version's simple design"""

    def __init__(self, configs: Dict[str, Any], external_logger: Optional[LoggerInterface] = None):
        self._config: Optional[Config] = None
        self._client: Optional[httpx.Client] = None
        self._async_client: Optional[httpx.AsyncClient] = None
        self._logger: Optional[Union[LoggerProxy, LoggerInterface]] = None
        self._external_logger: Optional[LoggerInterface] = external_logger

        self._register_config(configs)

    def get_config(self) -> Config:
        """Get configuration instance"""
        if self._config is None:
            raise RuntimeError("Config not registered")
        return self._config

    def get_client(self) -> httpx.Client:
        """Get synchronous HTTP client"""
        if self._client is None:
            config = self.get_config()
            self._client = httpx.Client(
                base_url=config.get_base_url(),
                timeout=config.get_timeout()
            )
        return self._client

    def get_async_client(self) -> httpx.AsyncClient:
        """Get asynchronous HTTP client"""
        if self._async_client is None:
            config = self.get_config()
            self._async_client = httpx.AsyncClient(
                base_url=config.get_base_url(),
                timeout=config.get_timeout()
            )
        return self._async_client

    def get_logger(self) -> Optional[Union[LoggerProxy, LoggerInterface]]:
        """Get logger (returns external logger if provided, None if logging is disabled, or LoggerProxy)"""
        # External logger has highest priority - always return if provided
        if self._external_logger is not None:
            return self._external_logger

        config = self.get_config()

        # Check if logging is enabled for default logger
        if not config.get('enable_logging', True):
            return None

        # Create default LoggerProxy if needed
        if self._logger is None:
            log_level = config.get('log_level', 'INFO')
            self._logger = LoggerProxy(config.get_sdk_name(), log_level)
        return self._logger

    def close(self):
        """Close HTTP clients"""
        if self._client is not None:
            self._client.close()
            self._client = None
        if self._async_client is not None:
            # AsyncClient close is async, but we'll handle it in destructor
            self._async_client = None

    def _register_config(self, configs: Dict[str, Any]) -> None:
        """Register configuration"""
        self._config = Config(configs)

    def __del__(self):
        """Cleanup on destruction"""
        self.close()
