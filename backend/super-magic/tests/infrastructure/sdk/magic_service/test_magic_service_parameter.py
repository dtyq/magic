"""
Tests for Magic Service Parameters

Real unit tests for Magic Service parameter classes.
"""

import unittest

from app.infrastructure.sdk.magic_service.parameter.get_agent_details_parameter import GetAgentDetailsParameter


class TestGetAgentDetailsParameter(unittest.TestCase):
    """Test cases for GetAgentDetailsParameter"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_agent_id = "SMA-68b55b991fdc63-21929374"

    def test_parameter_initialization_default(self):
        """Test parameter initialization with default values"""
        param = GetAgentDetailsParameter(self.test_agent_id)

        self.assertEqual(param.get_agent_id(), self.test_agent_id)
        self.assertTrue(param.get_with_prompt_string())

    def test_parameter_initialization_custom(self):
        """Test parameter initialization with custom values"""
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=False
        )

        self.assertEqual(param.get_agent_id(), self.test_agent_id)
        self.assertFalse(param.get_with_prompt_string())

    def test_to_body_method(self):
        """Test to_body method returns empty dict for GET request"""
        param = GetAgentDetailsParameter(self.test_agent_id)
        body = param.to_body()

        self.assertIsInstance(body, dict)
        self.assertEqual(len(body), 0)

    def test_to_query_params_with_prompt_string_true(self):
        """Test to_query_params when with_prompt_string is True"""
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=True
        )

        query_params = param.to_query_params()

        self.assertIsInstance(query_params, dict)
        self.assertEqual(query_params.get('with_prompt_string'), 'true')

    def test_to_query_params_with_prompt_string_false(self):
        """Test to_query_params when with_prompt_string is False"""
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=False
        )

        query_params = param.to_query_params()

        self.assertIsInstance(query_params, dict)
        self.assertNotIn('with_prompt_string', query_params)

    def test_validation_success(self):
        """Test successful validation with valid parameters"""
        param = GetAgentDetailsParameter(self.test_agent_id)

        # Should not raise any exception
        try:
            param.validate()
        except Exception as e:
            # Skip if validation fails due to missing auth config
            if "Access token is required" in str(e):
                self.skipTest("Auth configuration not available for validation")
            else:
                raise

    def test_validation_missing_agent_id(self):
        """Test validation failure with missing agent_id"""
        with self.assertRaises(ValueError) as context:
            param = GetAgentDetailsParameter("")
            param.validate()

        self.assertIn("Agent ID is required", str(context.exception))

    def test_validation_invalid_agent_id_type(self):
        """Test validation failure with invalid agent_id type"""
        with self.assertRaises(ValueError) as context:
            param = GetAgentDetailsParameter(123)  # Should be string
            param.validate()

        self.assertIn("Agent ID must be a string", str(context.exception))

    def test_validation_invalid_with_prompt_string_type(self):
        """Test validation failure with invalid with_prompt_string type"""
        param = GetAgentDetailsParameter(self.test_agent_id)
        param.with_prompt_string = "invalid"  # Should be boolean

        with self.assertRaises(ValueError) as context:
            param.validate()

        self.assertIn("with_prompt_string must be a boolean", str(context.exception))

    def test_to_options_get_request(self):
        """Test to_options method for GET request"""
        param = GetAgentDetailsParameter(
            agent_id=self.test_agent_id,
            with_prompt_string=True
        )

        options = param.to_options('GET')

        self.assertIsInstance(options, dict)
        self.assertIn('headers', options)
        self.assertIn('params', options)
        self.assertEqual(options['params']['with_prompt_string'], 'true')

    def test_to_options_post_request(self):
        """Test to_options method for POST request"""
        param = GetAgentDetailsParameter(self.test_agent_id)

        options = param.to_options('POST')

        self.assertIsInstance(options, dict)
        self.assertIn('headers', options)
        # Should not have 'params' for POST request, but may have 'json' if body data exists

    def test_auth_loading(self):
        """Test authentication loading from config"""
        param = GetAgentDetailsParameter(self.test_agent_id)

        # Test that auth properties exist (may be None if config not available)
        self.assertTrue(hasattr(param, 'token'))
        self.assertTrue(hasattr(param, 'user_id'))

        # Test auth config methods exist
        self.assertTrue(hasattr(param, 'get_access_token'))
        self.assertTrue(hasattr(param, 'get_user_id'))
        self.assertTrue(hasattr(param, 'set_auth_config'))

    def test_request_id_handling(self):
        """Test request ID handling"""
        param = GetAgentDetailsParameter(self.test_agent_id)
        test_request_id = "test-request-123"

        # Set request ID
        result = param.set_request_id(test_request_id)

        # Should return self for method chaining
        self.assertEqual(result, param)

        # Should be able to retrieve request ID
        self.assertEqual(param.get_request_id(), test_request_id)

    def test_headers_generation(self):
        """Test headers generation includes basic headers"""
        param = GetAgentDetailsParameter(self.test_agent_id)
        headers = param.to_headers()

        self.assertIsInstance(headers, dict)
        self.assertEqual(headers.get('Accept'), '*/*')
        self.assertEqual(headers.get('Connection'), 'keep-alive')

        # Auth headers may or may not be present depending on config availability

    def tearDown(self):
        """Clean up after tests"""
        pass


if __name__ == '__main__':
    unittest.main()
