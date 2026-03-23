"""
Streaming configuration generator for creating StreamingConfig instances.

This module provides a centralized way to generate streaming configurations
with fixed, predictable behavior.
"""

from typing import Optional
from urllib.parse import urlparse
from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
from agentlang.logger import get_logger
from app.utils.init_client_message_util import InitClientMessageUtil, InitializationError

logger = get_logger(__name__)


class StreamingConfigGenerator:
    """Generator for creating SocketIODriverConfig instances with fixed configuration logic."""

    @classmethod
    def _contains_unsafe_url_chars(cls, host: str) -> bool:
        """Reject whitespace and control characters in configured URLs."""
        return any(char.isspace() or ord(char) < 32 for char in host)

    @classmethod
    def _build_safe_log_base_url(cls, url: str, protocol: Optional[str] = None) -> str:
        """Build a sanitized URL for logs without userinfo, query, or fragment."""
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return "<invalid>"

        safe_protocol = protocol or parsed.scheme or "unknown"
        port_suffix = f":{parsed.port}" if parsed.port else ""
        return f"{safe_protocol}://{hostname}{port_suffix}"

    @classmethod
    def _build_socketio_config(
        cls, host: str, *, convert_http_to_ws: bool
    ) -> tuple[Optional[str], Optional[str]]:
        """Build Socket.IO config from a host string."""
        if not host or cls._contains_unsafe_url_chars(host):
            logger.error("Invalid Socket.IO host: empty or contains unsafe characters")
            return None, None

        parsed = urlparse(host)

        if convert_http_to_ws:
            if parsed.scheme == 'https':
                protocol = 'wss'
            elif parsed.scheme == 'http':
                protocol = 'ws'
            elif parsed.scheme in ('ws', 'wss'):
                protocol = parsed.scheme
            else:
                logger.error(f"Unsupported protocol in host: {parsed.scheme}")
                return None, None
        else:
            if parsed.scheme in ('ws', 'wss'):
                protocol = parsed.scheme
            elif parsed.scheme == 'https':
                protocol = 'wss'
            elif parsed.scheme == 'http':
                protocol = 'ws'
            else:
                logger.debug(f"Unsupported protocol in WS host: {parsed.scheme}")
                return None, None

        if not parsed.netloc or not parsed.hostname:
            logger.error("Invalid Socket.IO host: missing netloc or hostname")
            return None, None

        base_url = f"{protocol}://{parsed.netloc}"
        normalized_path = parsed.path.rstrip("/")
        socketio_path = f"{normalized_path}/socket.io/" if normalized_path else "/socket.io/"
        return base_url, socketio_path

    @classmethod
    def create_for_agent(cls) -> Optional[SocketIODriverConfig]:
        """
        Create a SocketIODriverConfig for agent use with fixed generation logic.

        Returns:
            Optional[SocketIODriverConfig]: Generated SocketIO driver configuration, or None if not applicable
        """
        try:
            base_url, socketio_path = cls._get_socketio_config_from_credentials()
            if base_url and socketio_path:
                config = SocketIODriverConfig.create_enabled(
                    base_url=base_url,
                    socketio_path=socketio_path
                )
                safe_base_url = cls._build_safe_log_base_url(base_url)
                logger.debug(
                    f"Created SocketIO driver config with base_url: {safe_base_url}, "
                    f"socketio_path: {socketio_path}"
                )
                return config
            else:
                logger.debug("No Socket.IO configuration available, returning None")
                return None

        except Exception as e:
            logger.warning(f"Failed to generate SocketIO driver config: {e}")
            return None

    @classmethod
    def _get_socketio_config_from_credentials(cls) -> tuple[Optional[str], Optional[str]]:
        """
        Get Socket.IO base_url and socketio_path from init_client_message.json using existing utility.

        Returns:
            tuple[Optional[str], Optional[str]]: (base_url, socketio_path) or (None, None) if not available
        """
        try:
            # Use existing utility to get full config
            config_data = InitClientMessageUtil.get_full_config()

            magic_service_ws_host = config_data.get('magic_service_ws_host')
            if magic_service_ws_host:
                base_url, socketio_path = cls._build_socketio_config(
                    magic_service_ws_host,
                    convert_http_to_ws=False
                )
                if base_url and socketio_path:
                    safe_base_url = cls._build_safe_log_base_url(base_url)
                    logger.debug(
                        f"Using sanitized Socket.IO WS host, "
                        f"base_url: {safe_base_url}, socketio_path: {socketio_path}"
                    )
                    return base_url, socketio_path
                logger.debug("magic_service_ws_host is invalid, falling back to magic_service_host")

            magic_service_host = config_data.get('magic_service_host')
            if not magic_service_host:
                logger.debug("No magic_service_host found in credentials")
                return None, None

            base_url, socketio_path = cls._build_socketio_config(
                magic_service_host,
                convert_http_to_ws=True
            )
            if base_url and socketio_path:
                safe_base_url = cls._build_safe_log_base_url(base_url)
                logger.debug(
                    f"Converted HTTP host to Socket.IO config with base_url: {safe_base_url}, "
                    f"socketio_path: {socketio_path}"
                )
            return base_url, socketio_path

        except InitializationError as e:
            logger.debug(f"Initialization error: {e}")
            return None, None
        except Exception as e:
            logger.warning(f"Failed to read credentials: {e}")
            return None, None
