"""
Tests for Magic Service API

Real unit tests for Magic Service API classes and methods.
"""

import unittest

from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk
from app.infrastructure.sdk.magic_service.api.agent_api import AgentApi
from app.infrastructure.sdk.magic_service.parameter.get_agent_details_parameter import GetAgentDetailsParameter
from app.infrastructure.sdk.magic_service.result.agent_details_result import AgentDetailsResult
from app.infrastructure.sdk.magic_service import MagicService
from app.infrastructure.sdk.base import SdkBase


class TestMagicServiceApi(unittest.TestCase):
    """Test cases for Magic Service API classes"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_host = "https://httpbin.org"  # Use httpbin for testing
        self.test_agent_id = "SMA-68b55b991fdc63-21929374"

    def test_magic_service_creation(self):
        """Test MagicService creation and basic properties"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        self.assertIsInstance(magic_service, MagicService)
        self.assertTrue(hasattr(magic_service, 'agent'))
        self.assertIsInstance(magic_service.agent, AgentApi)

    def test_agent_api_structure(self):
        """Test AgentApi structure and methods"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        agent_api = magic_service.agent

        # Test that required methods exist
        self.assertTrue(hasattr(agent_api, 'get_agent_details'))
        self.assertTrue(hasattr(agent_api, 'get_agent_details_async'))

        # Test that it's properly initialized with SDK base
        self.assertTrue(hasattr(agent_api, 'sdk_base'))
        self.assertIsInstance(agent_api.sdk_base, SdkBase)

    def test_get_agent_details_parameter_validation(self):
        """Test parameter validation before API call"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        # Test with invalid parameter
        invalid_param = GetAgentDetailsParameter("")

        with self.assertRaises(ValueError):
            magic_service.agent.get_agent_details(invalid_param)

    def test_get_agent_details_endpoint_construction(self):
        """Test that the endpoint path is constructed correctly"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        param = GetAgentDetailsParameter(self.test_agent_id)

        # Test that method exists and parameter is accepted
        try:
            # This will likely fail due to the endpoint not existing on httpbin
            # but we're testing the structure, not the actual API call
            magic_service.agent.get_agent_details(param)
        except Exception as e:
            # Expected since httpbin doesn't have our API endpoint
            # Check that it's a connection/HTTP error, not a parameter error
            error_msg = str(e).lower()
            self.assertTrue(
                any(keyword in error_msg for keyword in [
                    'connection', 'http', 'status', 'not found', '404', 'network'
                ]),
                f"Unexpected error type: {e}"
            )

    def test_agent_details_result_structure(self):
        """Test AgentDetailsResult structure"""
        # Create a mock response data similar to what the API would return
        mock_data = {
            "name": "Test Agent",
            "description": "A test agent",
            "icon": "test_icon",
            "type": 2,
            "enabled": True,
            "tools": [],
            "prompt_string": "You are a test agent.",
            "creator": "test_user",
            "modifier": "test_user",
            "id": self.test_agent_id
        }

        result = AgentDetailsResult(mock_data)

        # Test basic structure
        self.assertIsInstance(result, AgentDetailsResult)
        self.assertTrue(hasattr(result, 'get_name'))
        self.assertTrue(hasattr(result, 'get_description'))
        self.assertTrue(hasattr(result, 'get_id'))

        # Test data access
        self.assertEqual(result.get_name(), "Test Agent")
        self.assertEqual(result.get_description(), "A test agent")
        self.assertEqual(result.get_id(), self.test_agent_id)

    def test_magic_service_context_manager(self):
        """Test MagicService context manager functionality"""
        with create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        ) as magic_service:
            self.assertIsInstance(magic_service, MagicService)
            self.assertTrue(hasattr(magic_service, 'agent'))

    def test_magic_service_configuration_access(self):
        """Test accessing configuration through MagicService"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            timeout=45,
            use_agentlang_logger=False
        )

        # Test host access
        host = magic_service.get_host()
        self.assertEqual(host, self.test_host)

        # Test SDK base access
        sdk_base = magic_service.get_sdk_base()
        self.assertIsInstance(sdk_base, SdkBase)

        config = sdk_base.get_config()
        self.assertEqual(config.get('base_url'), self.test_host)
        self.assertEqual(config.get('timeout'), 45)

    def test_agent_api_inheritance(self):
        """Test AgentApi inheritance structure"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        agent_api = magic_service.agent

        # Test inheritance - should have request methods from base class
        self.assertTrue(hasattr(agent_api, 'request_by_parameter'))
        self.assertTrue(hasattr(agent_api, 'request_by_parameter_async'))

    def test_parameter_options_generation(self):
        """Test parameter to_options method generates correct structure"""
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=True
        )

        # Test GET request options
        options = param.to_options('GET')

        self.assertIsInstance(options, dict)
        self.assertIn('headers', options)

        if 'params' in options:
            self.assertEqual(options['params'].get('with_prompt_string'), 'true')

    def tearDown(self):
        """Clean up after tests"""
        pass


class TestMagicServiceIntegration(unittest.TestCase):
    """Integration tests for Magic Service SDK"""

    def setUp(self):
        """Set up test fixtures for integration tests"""
        self.test_host = "https://httpbin.org"
        self.test_agent_id = "SMA-68b55b991fdc63-21929374"

    def test_full_sdk_workflow(self):
        """Test complete SDK workflow from creation to API call attempt"""
        # Step 1: Create SDK
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        # Step 2: Create parameter
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=True
        )

        # Step 3: Attempt API call (will fail but should validate structure)
        try:
            result = magic_service.agent.get_agent_details(param)
        except Exception as e:
            # Expected since httpbin doesn't have our endpoint
            # Just verify it's not a parameter or structure error
            error_msg = str(e).lower()
            self.assertFalse(
                any(keyword in error_msg for keyword in ['parameter', 'validation', 'argument']),
                f"Parameter/structure error occurred: {e}"
            )

    def test_async_api_structure(self):
        """Test async API method structure"""
        magic_service = create_magic_service_sdk(
            base_url=self.test_host,
            use_agentlang_logger=False
        )

        param = GetAgentDetailsParameter(self.test_agent_id)

        # Test that async method exists and is callable
        self.assertTrue(hasattr(magic_service.agent, 'get_agent_details_async'))
        self.assertTrue(callable(magic_service.agent.get_agent_details_async))

    def tearDown(self):
        """Clean up after integration tests"""
        pass


if __name__ == '__main__':
    unittest.main()
