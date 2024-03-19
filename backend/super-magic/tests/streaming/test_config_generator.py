"""
Tests for StreamingConfigGenerator.

This module tests the streaming configuration generator functionality.
"""

from unittest.mock import patch
from app.streaming.config_generator import StreamingConfigGenerator
from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
from app.utils.init_client_message_util import InitializationError


class TestStreamingConfigGenerator:
    """Test cases for StreamingConfigGenerator class."""

    def test_create_for_agent_with_valid_credentials(self):
        """Test creating config for agent with valid credentials."""
        credentials_data = {
            "magic_service_host": "https://api.example.com/magic-service"
        }

        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', return_value=credentials_data):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is not None
            assert isinstance(result, SocketIODriverConfig)
            assert result.enabled is True
            assert result.base_url == "wss://api.example.com"
            assert result.socketio_path == "/magic-service/socket.io/"

    def test_create_for_agent_with_http_url(self):
        """Test creating config for agent with http URL in credentials."""
        credentials_data = {
            "magic_service_host": "http://localhost:8080/magic-service"
        }

        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', return_value=credentials_data):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is not None
            assert isinstance(result, SocketIODriverConfig)
            assert result.enabled is True
            assert result.base_url == "ws://localhost:8080"
            assert result.socketio_path == "/magic-service/socket.io/"

    def test_create_for_agent_initialization_error(self):
        """Test creating config for agent when InitializationError occurs."""
        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', side_effect=InitializationError("File not found")):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is None

    def test_create_for_agent_no_magic_service_host(self):
        """Test creating config for agent when magic_service_host is missing."""
        credentials_data = {
            "other_field": "some_value"
        }

        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', return_value=credentials_data):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is None

    def test_create_for_agent_unsupported_protocol(self):
        """Test creating config for agent with unsupported protocol."""
        credentials_data = {
            "magic_service_host": "ftp://example.com/magic-service"
        }

        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', return_value=credentials_data):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is None

    def test_create_for_agent_generic_exception(self):
        """Test creating config for agent when generic exception occurs."""
        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', side_effect=Exception("Generic error")):
            result = StreamingConfigGenerator.create_for_agent()

            assert result is None

    def test_get_socketio_config_from_credentials_success(self):
        """Test getting Socket.IO config from credentials successfully."""
        credentials_data = {
            "magic_service_host": "https://api.example.com/service"
        }

        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', return_value=credentials_data):
            base_url, socketio_path = StreamingConfigGenerator._get_socketio_config_from_credentials()

            assert base_url == "wss://api.example.com"
            assert socketio_path == "/service/socket.io/"

    def test_get_socketio_config_from_credentials_initialization_error(self):
        """Test getting Socket.IO config when InitializationError occurs."""
        with patch('app.utils.init_client_message_util.InitClientMessageUtil.get_full_config', side_effect=InitializationError("Config error")):
            base_url, socketio_path = StreamingConfigGenerator._get_socketio_config_from_credentials()

            assert base_url is None
            assert socketio_path is None

    def test_exception_handling_in_create_for_agent(self):
        """Test exception handling in create_for_agent method."""
        with patch('app.streaming.config_generator.StreamingConfigGenerator._get_socketio_config_from_credentials') as mock_get_config:
            mock_get_config.side_effect = Exception("Test error")

            result = StreamingConfigGenerator.create_for_agent()

            assert result is None
