"""
Tests for Magic Service SDK Factory

Real unit tests for factory functions that create Magic Service SDK instances.
"""

import unittest

from app.infrastructure.sdk.magic_service.factory import (
    create_magic_service_sdk,
    create_magic_service_sdk_with_defaults,
    MagicServiceConfigError
)
from app.infrastructure.sdk.magic_service import MagicService
from app.infrastructure.sdk.magic_service.kernel.magic_service_exception import MagicServiceException
from app.infrastructure.sdk.base import SdkBase


class TestMagicServiceFactory(unittest.TestCase):
    """Test cases for Magic Service factory functions"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_host = "https://test-magic-service.example.com"
        self.test_timeout = 60

    def test_create_magic_service_sdk_with_explicit_params(self):
        """Test creating SDK with explicitly provided parameters"""
        # Create SDK with explicit parameters
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            timeout=self.test_timeout,
            use_agentlang_logger=False
        )

        # Verify the returned object is a MagicService instance
        self.assertIsInstance(magic_service, MagicService)

        # Verify the SDK has an agent API
        self.assertTrue(hasattr(magic_service, 'agent'))

        # Verify the underlying SdkBase configuration
        sdk_base = magic_service.get_sdk_base()
        self.assertIsInstance(sdk_base, SdkBase)

        config = sdk_base.get_config()
        self.assertEqual(config.get('base_url'), self.test_host)
        self.assertEqual(config.get('timeout'), self.test_timeout)
        self.assertEqual(config.get('sdk_name'), 'magic_service')
        self.assertTrue(config.get('enable_logging'))

    def test_create_magic_service_sdk_from_config_file(self):
        """Test creating SDK using configuration from init client message file"""
        try:
            # This will try to load from the actual init client message file
            magic_service = create_magic_service_sdk()

            # If successful, verify basic structure
            self.assertIsInstance(magic_service, MagicService)
            self.assertTrue(hasattr(magic_service, 'agent'))

            # Verify host was loaded from config
            host = magic_service.get_host()
            self.assertTrue(host.startswith('https://'))

        except MagicServiceConfigError:
            # This is expected if init client message is not available
            self.skipTest("Init client message file not available or configured")

    def test_create_magic_service_sdk_with_defaults_function(self):
        """Test convenience function for creating SDK with defaults"""
        try:
            magic_service = create_magic_service_sdk_with_defaults()

            # Verify the returned object is a MagicService instance
            self.assertIsInstance(magic_service, MagicService)
            self.assertTrue(hasattr(magic_service, 'agent'))

        except MagicServiceConfigError:
            # This is expected if init client message is not available
            self.skipTest("Init client message file not available or configured")

    def test_create_magic_service_sdk_with_different_timeouts(self):
        """Test creating SDK with different timeout values"""
        test_timeouts = [10, 30, 60, 120]

        for timeout in test_timeouts:
            with self.subTest(timeout=timeout):
                magic_service = create_magic_service_sdk(
                    base_url=self.test_host,
                    timeout=timeout
                )

                config = magic_service.get_sdk_base().get_config()
                self.assertEqual(config.get('timeout'), timeout)

    def test_create_magic_service_sdk_logger_options(self):
        """Test creating SDK with different logger options"""
        # Test with AgentLang logger disabled
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )
        self.assertIsInstance(magic_service, MagicService)

        # Test with AgentLang logger enabled (may fail if agentlang not available)
        try:
            magic_service = create_magic_service_sdk(
                base_url=self.test_host,
                use_agentlang_logger=True
            )
            self.assertIsInstance(magic_service, MagicService)
        except Exception:
            # Expected if agentlang logger is not available
            pass

    def test_magic_service_basic_structure(self):
        """Test basic structure and properties of created MagicService"""
        magic_service = create_magic_service_sdk(base_url=self.test_host)

        # Test basic properties
        self.assertTrue(hasattr(magic_service, 'agent'))
        self.assertTrue(hasattr(magic_service, 'get_host'))
        self.assertTrue(hasattr(magic_service, 'get_sdk_base'))
        self.assertTrue(hasattr(magic_service, 'close'))

        # Test host property
        host = magic_service.get_host()
        self.assertEqual(host, self.test_host)

        # Test context manager support
        self.assertTrue(hasattr(magic_service, '__enter__'))
        self.assertTrue(hasattr(magic_service, '__exit__'))

    def test_magic_service_context_manager(self):
        """Test MagicService as context manager"""
        with create_magic_service_sdk(base_url=self.test_host) as magic_service:
            self.assertIsInstance(magic_service, MagicService)
            self.assertTrue(hasattr(magic_service, 'agent'))

    def test_base_url_handling(self):
        """Test behavior with different base URL values"""
        # Test with empty string (should still create SDK)
        magic_service = create_magic_service_sdk(base_url="")
        self.assertIsInstance(magic_service, MagicService)

        # Test with None (should try to load from config)
        try:
            magic_service = create_magic_service_sdk(base_url=None)
            # If this succeeds, config file was available
            self.assertIsInstance(magic_service, MagicService)
        except MagicServiceConfigError:
            # Expected if no config available
            pass

    def tearDown(self):
        """Clean up after tests"""
        # Clean up any resources if needed
        pass


if __name__ == '__main__':
    unittest.main()
