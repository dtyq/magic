"""
@config syntax processor unit test module

Test the complete functionality of ConfigProcessor, including:
- Configuration item reading functionality
- Default value handling
- Parameter parsing (positional parameters and key-value pair parameters)
- Error handling and edge cases
"""

import unittest
from unittest.mock import patch

from agentlang.agent.processors import ConfigProcessor
from agentlang.config import config


class TestConfigProcessor(unittest.TestCase):
    """@config syntax processor tests"""

    def setUp(self):
        """Set up test environment"""
        self.processor = ConfigProcessor()

    def test_get_syntax_name(self):
        """Test syntax name"""
        self.assertEqual(self.processor.get_syntax_name(), "config")

    def test_get_positional_param_mapping(self):
        """Test positional parameter mapping"""
        mapping = self.processor.get_positional_param_mapping()
        self.assertEqual(mapping, ["key", "default"])

    @patch.object(config, 'get')
    def test_process_existing_config(self, mock_get):
        """Test existing configuration"""
        mock_get.return_value = 'config_value'

        params = {'key': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, 'config_value')
        mock_get.assert_called_once_with('model.temperature', None)

    @patch.object(config, 'get')
    def test_process_positional_params(self, mock_get):
        """Test positional parameters"""
        mock_get.return_value = 'config_value'

        params = {'_pos_0': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, 'config_value')
        mock_get.assert_called_once_with('model.temperature', None)

    @patch.object(config, 'get')
    def test_process_with_default_value(self, mock_get):
        """Test using default value"""
        mock_get.return_value = 'default_value'

        params = {'key': 'nonexistent.config', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    @patch.object(config, 'get')
    def test_process_positional_with_default(self, mock_get):
        """Test positional parameters with default value"""
        mock_get.return_value = 'default_value'

        params = {'_pos_0': 'nonexistent.config', '_pos_1': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'default_value')

    @patch.object(config, 'get')
    def test_process_missing_config_no_default(self, mock_get):
        """Test missing configuration with no default value"""
        mock_get.return_value = None

        params = {'key': 'nonexistent.config'}

        with self.assertRaises(ValueError) as context:
            self.processor.process(params)

        self.assertIn("Configuration nonexistent.config does not exist and no default value provided", str(context.exception))

    def test_process_missing_key_param(self):
        """Test missing key parameter"""
        with self.assertRaises(ValueError) as context:
            self.processor.process({})

        self.assertIn("Missing required parameter: key", str(context.exception))

    @patch.object(config, 'get')
    def test_process_numeric_config(self, mock_get):
        """Test numeric configuration"""
        mock_get.return_value = 0.7

        params = {'key': 'model.temperature'}
        result = self.processor.process(params)
        self.assertEqual(result, '0.7')

    @patch.object(config, 'get')
    def test_process_boolean_config(self, mock_get):
        """Test boolean configuration"""
        mock_get.return_value = True

        params = {'key': 'feature.enabled'}
        result = self.processor.process(params)
        self.assertEqual(result, 'True')

    @patch.object(config, 'get')
    def test_process_list_config(self, mock_get):
        """Test list configuration"""
        mock_get.return_value = ['item1', 'item2', 'item3']

        params = {'key': 'list.items'}
        result = self.processor.process(params)
        self.assertEqual(result, "['item1', 'item2', 'item3']")

    @patch.object(config, 'get')
    def test_process_dict_config(self, mock_get):
        """Test dictionary configuration"""
        mock_get.return_value = {'key1': 'value1', 'key2': 'value2'}

        params = {'key': 'dict.config'}
        result = self.processor.process(params)
        self.assertEqual(result, "{'key1': 'value1', 'key2': 'value2'}")

    @patch.object(config, 'get')
    def test_process_none_config(self, mock_get):
        """Test None configuration value"""
        # When configuration doesn't exist, config.get should return the default value
        def mock_get_side_effect(key, default=None):
            if key == 'null.config':
                return default  # Return the passed default value
            return default

        mock_get.side_effect = mock_get_side_effect

        params = {'key': 'null.config', 'default': 'fallback'}
        result = self.processor.process(params)
        self.assertEqual(result, 'fallback')

    @patch.object(config, 'get')
    def test_process_zero_config(self, mock_get):
        """Test zero value configuration"""
        mock_get.return_value = 0

        params = {'key': 'zero.config'}
        result = self.processor.process(params)
        self.assertEqual(result, '0')

    @patch.object(config, 'get')
    def test_process_empty_string_config(self, mock_get):
        """Test empty string configuration"""
        mock_get.return_value = ''

        params = {'key': 'empty.config'}
        result = self.processor.process(params)
        self.assertEqual(result, '')

    @patch.object(config, 'get')
    def test_process_nested_config_key(self, mock_get):
        """Test nested configuration key"""
        mock_get.return_value = 'nested_value'

        params = {'key': 'app.database.host'}
        result = self.processor.process(params)
        self.assertEqual(result, 'nested_value')
        mock_get.assert_called_once_with('app.database.host', None)

    @patch.object(config, 'get')
    def test_process_config_override_default(self, mock_get):
        """Test configuration value overrides default value"""
        mock_get.return_value = 'actual_config_value'

        params = {'key': 'existing.config', 'default': 'default_value'}
        result = self.processor.process(params)
        self.assertEqual(result, 'actual_config_value')  # Should use config value, not default value


if __name__ == '__main__':
    unittest.main()
