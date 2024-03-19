"""
Tests for SDK Base Components

Real unit tests for SDK base functionality including SdkBase, Config, and LoggerProxy.
"""

import unittest
import tempfile
import os
from typing import Dict, Any

from app.infrastructure.sdk.base.sdk_base import SdkBase
from app.infrastructure.sdk.base.config import Config
from app.infrastructure.sdk.base.logger import LoggerProxy
from app.infrastructure.sdk.base.context import SdkContext
from app.infrastructure.sdk.base.exceptions import SdkException, ConfigurationError


class TestConfig(unittest.TestCase):
    """Test cases for Config class"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_data = {
            'sdk_name': 'test_config',
            'base_url': 'https://api.example.com',
            'timeout': 30,
            'nested': {
                'key1': 'value1',
                'deep': {
                    'key2': 'value2'
                }
            },
            'list_value': [1, 2, 3]
        }

    def test_config_initialization_with_dict(self):
        """Test Config initialization with dictionary"""
        config = Config(self.test_data)

        self.assertEqual(config.get('base_url'), 'https://api.example.com')
        self.assertEqual(config.get('timeout'), 30)
        self.assertEqual(config.get('nested.key1'), 'value1')
        self.assertEqual(config.get('nested.deep.key2'), 'value2')

    def test_config_get_with_default(self):
        """Test Config.get() with default values"""
        config = Config(self.test_data)

        # Existing key
        self.assertEqual(config.get('timeout'), 30)

        # Non-existing key with default
        self.assertEqual(config.get('non_existing', 'default'), 'default')

        # Non-existing nested key with default
        self.assertEqual(config.get('nested.non_existing', 'default'), 'default')

    def test_config_dot_notation_access(self):
        """Test Config dot notation access"""
        config = Config(self.test_data)

        # Simple access
        self.assertEqual(config.get('base_url'), 'https://api.example.com')

        # Nested access
        self.assertEqual(config.get('nested.key1'), 'value1')

        # Deep nested access
        self.assertEqual(config.get('nested.deep.key2'), 'value2')

    def test_config_set_values(self):
        """Test Config.set() method"""
        config = Config({'sdk_name': 'test_set'})

        # Set simple value
        config.set('new_key', 'new_value')
        self.assertEqual(config.get('new_key'), 'new_value')

        # Set nested value
        config.set('nested.key', 'nested_value')
        self.assertEqual(config.get('nested.key'), 'nested_value')

    def test_config_to_dict_method(self):
        """Test Config.to_dict() method returns all data"""
        config = Config(self.test_data)

        all_data = config.to_dict()
        self.assertEqual(all_data['base_url'], 'https://api.example.com')
        self.assertEqual(all_data['timeout'], 30)
        self.assertEqual(all_data['nested']['key1'], 'value1')

    def test_config_has_method(self):
        """Test Config.has() method"""
        config = Config(self.test_data)

        # Existing keys
        self.assertTrue(config.has('base_url'))
        self.assertTrue(config.has('nested.key1'))
        self.assertTrue(config.has('nested.deep.key2'))

        # Non-existing keys
        self.assertFalse(config.has('non_existing'))
        self.assertFalse(config.has('nested.non_existing'))


class TestLoggerProxy(unittest.TestCase):
    """Test cases for LoggerProxy class"""

    def test_logger_proxy_initialization(self):
        """Test LoggerProxy initialization"""
        proxy = LoggerProxy('test_sdk')

        # Should not raise errors
        proxy.info("Test message")
        proxy.error("Test error")
        proxy.debug("Test debug")
        proxy.warning("Test warning")

    def test_logger_proxy_with_different_log_levels(self):
        """Test LoggerProxy with different log levels"""
        # Test with DEBUG level
        debug_proxy = LoggerProxy('debug_sdk', 'DEBUG')
        debug_proxy.debug("Debug message")

        # Test with ERROR level
        error_proxy = LoggerProxy('error_sdk', 'ERROR')
        error_proxy.error("Error message")

    def test_logger_proxy_set_level(self):
        """Test LoggerProxy set_level method"""
        proxy = LoggerProxy('test_sdk')

        # Should not raise errors
        proxy.set_level('DEBUG')
        proxy.set_level('ERROR')


class TestSdkBase(unittest.TestCase):
    """Test cases for SdkBase class"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_config = {
            'sdk_name': 'test_sdk',
            'base_url': 'https://api.test.com',
            'timeout': 45,
            'enable_logging': True
        }

    def test_sdk_base_initialization(self):
        """Test SdkBase initialization with config"""
        sdk_base = SdkBase(self.test_config)

        # Test config access
        config = sdk_base.get_config()
        self.assertIsInstance(config, Config)
        self.assertEqual(config.get('sdk_name'), 'test_sdk')
        self.assertEqual(config.get('base_url'), 'https://api.test.com')
        self.assertEqual(config.get('timeout'), 45)

    def test_sdk_base_http_clients(self):
        """Test SdkBase HTTP clients creation"""
        sdk_base = SdkBase(self.test_config)

        # Test sync client
        sync_client = sdk_base.get_client()
        self.assertIsNotNone(sync_client)

        # Test async client
        async_client = sdk_base.get_async_client()
        self.assertIsNotNone(async_client)

    def test_sdk_base_logger(self):
        """Test SdkBase logger functionality"""
        sdk_base = SdkBase(self.test_config)

        logger = sdk_base.get_logger()
        self.assertIsInstance(logger, LoggerProxy)

        # Test logging methods exist and are callable
        self.assertTrue(hasattr(logger, 'info'))
        self.assertTrue(hasattr(logger, 'error'))
        self.assertTrue(hasattr(logger, 'debug'))
        self.assertTrue(hasattr(logger, 'warning'))

    def test_sdk_base_with_external_logger(self):
        """Test SdkBase with external logger"""
        # Create mock external logger
        class MockLogger:
            def __init__(self):
                self.messages = []

            def info(self, msg, **kwargs):
                self.messages.append(msg)

            def error(self, msg, **kwargs):
                self.messages.append(msg)

            def debug(self, msg, **kwargs):
                self.messages.append(msg)

            def warning(self, msg, **kwargs):
                self.messages.append(msg)

        mock_logger = MockLogger()
        sdk_base = SdkBase(self.test_config, external_logger=mock_logger)

        logger = sdk_base.get_logger()
        self.assertEqual(logger, mock_logger)  # Should return the external logger

    def test_sdk_base_logger_disabled(self):
        """Test SdkBase with logging disabled"""
        config_without_logging = self.test_config.copy()
        config_without_logging['enable_logging'] = False

        sdk_base = SdkBase(config_without_logging)
        logger = sdk_base.get_logger()
        self.assertIsNone(logger)  # Should return None when logging is disabled

    def test_sdk_base_close(self):
        """Test SdkBase close functionality"""
        sdk_base = SdkBase(self.test_config)

        # Should not raise errors
        sdk_base.close()

    def test_sdk_base_configuration_validation(self):
        """Test SdkBase configuration validation"""
        # Test with minimal valid config
        minimal_config = {'sdk_name': 'minimal'}
        sdk_base = SdkBase(minimal_config)
        self.assertIsInstance(sdk_base, SdkBase)

        # Test with empty config should raise error
        with self.assertRaises(ValueError):
            empty_config = {}
            SdkBase(empty_config)


class TestSdkContext(unittest.TestCase):
    """Test cases for SdkContext class"""

    def setUp(self):
        """Set up test fixtures"""
        # Clear any existing context
        SdkContext.clear()

    def test_sdk_context_register_and_get(self):
        """Test SdkContext register and get functionality"""
        config = {'sdk_name': 'test_context'}
        sdk_base = SdkBase(config)

        # Register SDK
        SdkContext.register('test_key', sdk_base)

        # Retrieve SDK
        retrieved = SdkContext.get('test_key')
        self.assertEqual(retrieved, sdk_base)

    def test_sdk_context_get_nonexistent(self):
        """Test SdkContext.get() with non-existent key raises error"""
        with self.assertRaises(RuntimeError):
            SdkContext.get('non_existent')

    def test_sdk_context_multiple_instances(self):
        """Test SdkContext with multiple SDK instances"""
        config1 = {'sdk_name': 'sdk1'}
        config2 = {'sdk_name': 'sdk2'}

        sdk1 = SdkBase(config1)
        sdk2 = SdkBase(config2)

        # Register both
        SdkContext.register('key1', sdk1)
        SdkContext.register('key2', sdk2)

        # Retrieve both
        self.assertEqual(SdkContext.get('key1'), sdk1)
        self.assertEqual(SdkContext.get('key2'), sdk2)

    def tearDown(self):
        """Clean up after tests"""
        # Clear context
        SdkContext.clear()


class TestSdkExceptions(unittest.TestCase):
    """Test cases for SDK exceptions"""

    def test_sdk_exception(self):
        """Test basic SdkException"""
        with self.assertRaises(SdkException) as context:
            raise SdkException("Test SDK error")

        self.assertEqual(str(context.exception), "Test SDK error")

    def test_configuration_error(self):
        """Test ConfigurationError exception"""
        with self.assertRaises(ConfigurationError) as context:
            raise ConfigurationError("Configuration is invalid")

        self.assertEqual(str(context.exception), "Configuration is invalid")

        # Should also be instance of SdkException
        self.assertIsInstance(context.exception, SdkException)


class TestSdkBaseIntegration(unittest.TestCase):
    """Integration tests for SDK base components working together"""

    def test_full_sdk_base_workflow(self):
        """Test complete SDK base workflow"""
        # Create configuration
        config_data = {
            'sdk_name': 'integration_test',
            'base_url': 'https://httpbin.org',
            'timeout': 30,
            'enable_logging': True
        }

        # Create SDK base
        sdk_base = SdkBase(config_data)

        # Test configuration
        config = sdk_base.get_config()
        self.assertEqual(config.get('sdk_name'), 'integration_test')

        # Test logger
        logger = sdk_base.get_logger()
        logger.info("Integration test message")

        # Test HTTP clients
        sync_client = sdk_base.get_client()
        async_client = sdk_base.get_async_client()

        self.assertIsNotNone(sync_client)
        self.assertIsNotNone(async_client)

        # Test context registration
        SdkContext.register('integration_test', sdk_base)
        retrieved = SdkContext.get('integration_test')
        self.assertEqual(retrieved, sdk_base)

        # Clean up
        sdk_base.close()

    def tearDown(self):
        """Clean up after integration tests"""
        SdkContext.clear()


if __name__ == '__main__':
    unittest.main()
