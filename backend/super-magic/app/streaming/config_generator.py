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
                logger.debug(f"Created SocketIO driver config with base_url: {base_url}, socketio_path: {socketio_path}")
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

            magic_service_host = config_data.get('magic_service_host')
            if not magic_service_host:
                logger.debug("No magic_service_host found in credentials")
                return None, None

            # 使用 urllib.parse 解析 URL
            parsed = urlparse(magic_service_host)

            # 转换协议：https -> wss, http -> ws
            if parsed.scheme == 'https':
                protocol = 'wss'
            elif parsed.scheme == 'http':
                protocol = 'ws'
            else:
                logger.debug(f"Unsupported protocol in magic_service_host: {parsed.scheme}")
                return None, None

            # 构建结果
            base_url = f"{protocol}://{parsed.netloc}"
            socketio_path = f"{parsed.path}/socket.io/"

            logger.debug(f"Converted {magic_service_host} to base_url: {base_url}, socketio_path: {socketio_path}")
            return base_url, socketio_path

        except InitializationError as e:
            logger.debug(f"Initialization error: {e}")
            return None, None
        except Exception as e:
            logger.warning(f"Failed to read credentials: {e}")
            return None, None
