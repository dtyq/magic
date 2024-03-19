"""
Tests for SDK Base Abstract Classes

Real unit tests for abstract base classes including AbstractApi, AbstractParameter, and AbstractResult.
"""

import unittest
from typing import Dict, Any
import httpx

from app.infrastructure.sdk.base.sdk_base import SdkBase
from app.infrastructure.sdk.base.abstract_api import AbstractApi
from app.infrastructure.sdk.base.abstract_parameter import AbstractParameter
from app.infrastructure.sdk.base.abstract_result import AbstractResult


class ConcreteParameter(AbstractParameter):
    """Concrete implementation of AbstractParameter for testing"""

    def __init__(self, test_data: Dict[str, Any] = None):
        super().__init__()
        self.test_data = test_data or {}

    def validate(self) -> None:
        """Validate parameter data"""
        if self.test_data.get('invalid'):
            raise ValueError("Parameter is invalid")

    def to_options(self, method: str) -> Dict[str, Any]:
        """Convert parameter to request options"""
        options = {'headers': {'Content-Type': 'application/json'}}

        if method.upper() == 'GET':
            if self.test_data:
                options['params'] = self.test_data
        else:
            if self.test_data:
                options['json'] = self.test_data

        return options


class ConcreteApi(AbstractApi):
    """Concrete implementation of AbstractApi for testing"""

    def test_endpoint(self, parameter: ConcreteParameter) -> Dict[str, Any]:
        """Test endpoint method"""
        return self.request_by_parameter(parameter, 'GET', '/test')

    async def test_endpoint_async(self, parameter: ConcreteParameter) -> Dict[str, Any]:
        """Test async endpoint method"""
        return await self.request_by_parameter_async(parameter, 'POST', '/test')


class ConcreteResult(AbstractResult):
    """Concrete implementation of AbstractResult for testing"""

    def __init__(self, data: Dict[str, Any]):
        super().__init__(data)

    def get_test_value(self) -> str:
        """Get test value from result data"""
        return self.get('test', '')

    def is_success(self) -> bool:
        """Check if result indicates success"""
        return self.get('success', False)


class TestAbstractParameter(unittest.TestCase):
    """Test cases for AbstractParameter base class"""

    def test_concrete_parameter_validation_success(self):
        """Test successful parameter validation"""
        param = ConcreteParameter({'key': 'value'})

        # Should not raise exception
        param.validate()

    def test_concrete_parameter_validation_failure(self):
        """Test parameter validation failure"""
        param = ConcreteParameter({'invalid': True})

        with self.assertRaises(ValueError):
            param.validate()

    def test_parameter_to_options_get_method(self):
        """Test parameter to_options for GET request"""
        test_data = {'param1': 'value1', 'param2': 'value2'}
        param = ConcreteParameter(test_data)

        options = param.to_options('GET')

        self.assertIn('headers', options)
        self.assertIn('params', options)
        self.assertEqual(options['params'], test_data)
        self.assertEqual(options['headers']['Content-Type'], 'application/json')

    def test_parameter_to_options_post_method(self):
        """Test parameter to_options for POST request"""
        test_data = {'data': 'test_value'}
        param = ConcreteParameter(test_data)

        options = param.to_options('POST')

        self.assertIn('headers', options)
        self.assertIn('json', options)
        self.assertEqual(options['json'], test_data)

    def test_parameter_to_options_empty_data(self):
        """Test parameter to_options with empty data"""
        param = ConcreteParameter({})

        get_options = param.to_options('GET')
        post_options = param.to_options('POST')

        self.assertIn('headers', get_options)
        self.assertNotIn('params', get_options)

        self.assertIn('headers', post_options)
        self.assertNotIn('json', post_options)


class TestAbstractApi(unittest.TestCase):
    """Test cases for AbstractApi base class"""

    def setUp(self):
        """Set up test fixtures"""
        self.config = {
            'sdk_name': 'test_api',
            'base_url': 'https://httpbin.org',
            'timeout': 30
        }
        self.sdk_base = SdkBase(self.config)
        self.api = ConcreteApi(self.sdk_base)

    def test_api_initialization(self):
        """Test API initialization with SdkBase"""
        self.assertEqual(self.api.sdk_base, self.sdk_base)
        # Logger is accessed through sdk_base
        logger = self.api.sdk_base.get_logger()
        self.assertIsNotNone(logger)

    def test_api_parameter_validation_before_request(self):
        """Test that API validates parameters before making requests"""
        invalid_param = ConcreteParameter({'invalid': True})

        with self.assertRaises(ValueError):
            self.api.test_endpoint(invalid_param)

    def test_api_request_structure(self):
        """Test API request structure and error handling"""
        param = ConcreteParameter({'test': 'data'})

        try:
            # This will likely fail due to endpoint not existing
            result = self.api.test_endpoint(param)
        except Exception as e:
            # Should be a network/HTTP error, not parameter error
            error_msg = str(e).lower()
            self.assertFalse(
                'parameter' in error_msg or 'validation' in error_msg,
                "Should not be parameter validation error"
            )

    def test_api_async_method_exists(self):
        """Test that async API methods exist and are callable"""
        self.assertTrue(hasattr(self.api, 'test_endpoint_async'))
        self.assertTrue(callable(self.api.test_endpoint_async))

    def test_api_logger_access(self):
        """Test API logger access and usage"""
        logger = self.api.sdk_base.get_logger()

        # Should not raise errors
        logger.info("Test API log message")
        logger.error("Test API error message")

    def tearDown(self):
        """Clean up after tests"""
        self.sdk_base.close()


class TestAbstractResult(unittest.TestCase):
    """Test cases for AbstractResult base class"""

    def test_result_initialization(self):
        """Test result initialization with data"""
        test_data = {'success': True, 'test': 'value', 'count': 42}
        result = ConcreteResult(test_data)

        self.assertEqual(result.get_raw_data(), test_data)

    def test_result_data_access(self):
        """Test result data access methods"""
        test_data = {'success': True, 'test': 'hello world', 'items': [1, 2, 3]}
        result = ConcreteResult(test_data)

        # Test custom methods
        self.assertEqual(result.get_test_value(), 'hello world')
        self.assertTrue(result.is_success())

        # Test direct data access
        self.assertEqual(result['items'], [1, 2, 3])
        self.assertEqual(result.get('items'), [1, 2, 3])

    def test_result_with_empty_data(self):
        """Test result with empty data"""
        result = ConcreteResult({})

        self.assertEqual(result.get_test_value(), '')
        self.assertFalse(result.is_success())

    def test_result_with_none_values(self):
        """Test result with None values"""
        test_data = {'success': None, 'test': None}
        result = ConcreteResult(test_data)

        self.assertIsNone(result['success'])
        self.assertIsNone(result['test'])
        self.assertIsNone(result.get('success'))
        self.assertIsNone(result.get('test'))


class TestAbstractClassesIntegration(unittest.TestCase):
    """Integration tests for abstract classes working together"""

    def setUp(self):
        """Set up integration test fixtures"""
        self.config = {
            'sdk_name': 'integration_test',
            'base_url': 'https://httpbin.org',
            'timeout': 30
        }

    def test_full_abstract_workflow(self):
        """Test complete workflow using abstract classes"""
        # Step 1: Create SDK base
        sdk_base = SdkBase(self.config)

        # Step 2: Create API instance
        api = ConcreteApi(sdk_base)

        # Step 3: Create parameter
        param = ConcreteParameter({'test_key': 'test_value'})

        # Step 4: Validate parameter structure
        param.validate()  # Should not raise

        # Step 5: Check options generation
        options = param.to_options('GET')
        self.assertIn('headers', options)
        self.assertIn('params', options)

        # Step 6: Test result creation
        mock_response_data = {'success': True, 'test': 'integration_result'}
        result = ConcreteResult(mock_response_data)

        self.assertTrue(result.is_success())
        self.assertEqual(result.get_test_value(), 'integration_result')

        # Clean up
        sdk_base.close()

    def test_parameter_api_interaction(self):
        """Test parameter and API interaction"""
        sdk_base = SdkBase(self.config)
        api = ConcreteApi(sdk_base)

        # Test with valid parameter
        valid_param = ConcreteParameter({'data': 'test'})

        try:
            # This will likely fail due to endpoint, but should validate parameter first
            api.test_endpoint(valid_param)
        except Exception as e:
            # Should be HTTP/network error, not validation error
            error_msg = str(e).lower()
            self.assertFalse(
                'invalid' in error_msg and 'parameter' in error_msg,
                "Should not be parameter validation error"
            )

        # Clean up
        sdk_base.close()

    def test_error_handling_chain(self):
        """Test error handling through the abstract class chain"""
        sdk_base = SdkBase(self.config)
        api = ConcreteApi(sdk_base)

        # Test parameter validation error
        invalid_param = ConcreteParameter({'invalid': True})

        with self.assertRaises(ValueError) as context:
            api.test_endpoint(invalid_param)

        self.assertEqual(str(context.exception), "Parameter is invalid")

        # Clean up
        sdk_base.close()


if __name__ == '__main__':
    unittest.main()
