#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test enhanced from_response compatibility with model_id and model_name

This test verifies that from_response now preserves model_id and model_name
when present in the input, providing extra robustness.
"""
import pytest
from agentlang.llms.token_usage.models import TokenUsage


class TestFromResponseEnhancement:
    """Test from_response enhancement for model info preservation"""

    def test_from_response_preserves_model_info_with_standard_format(self):
        """
        Test that from_response now preserves model_id and model_name
        when parsing standard format data
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "claude-3.7-sonnet",
            "model_name": "Claude 3.7 Sonnet"
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        assert token_usage.model_id == "claude-3.7-sonnet"
        assert token_usage.model_name == "Claude 3.7 Sonnet"

    def test_from_response_without_model_info_still_works(self):
        """
        Test that from_response still works when model_id and model_name
        are not present (backward compatibility)
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        assert token_usage.model_id is None
        assert token_usage.model_name is None

    def test_from_response_with_openai_format_no_model_info(self):
        """
        Test that from_response correctly parses OpenAI format
        (model info not typically present in OpenAI response)
        """
        openai_data = {
            "prompt_tokens": 100,
            "completion_tokens": 200,
            "total_tokens": 300
        }

        token_usage = TokenUsage.from_response(openai_data)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        assert token_usage.model_id is None
        assert token_usage.model_name is None

    def test_from_response_with_openai_format_plus_model_info(self):
        """
        Test that from_response can handle OpenAI format with
        additional model_id and model_name fields
        """
        data = {
            "prompt_tokens": 100,
            "completion_tokens": 200,
            "total_tokens": 300,
            "model_id": "gpt-4",
            "model_name": "GPT-4"
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        # Model info should be preserved
        assert token_usage.model_id == "gpt-4"
        assert token_usage.model_name == "GPT-4"

    def test_from_response_preserves_only_model_id(self):
        """
        Test that from_response preserves model_id even if model_name is missing
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "claude-3.7-sonnet"
            # model_name is missing
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        assert token_usage.model_id == "claude-3.7-sonnet"
        assert token_usage.model_name is None

    def test_from_response_preserves_only_model_name(self):
        """
        Test that from_response preserves model_name even if model_id is missing
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_name": "Claude 3.7 Sonnet"
            # model_id is missing
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        assert token_usage.model_id is None
        assert token_usage.model_name == "Claude 3.7 Sonnet"

    def test_from_response_with_empty_string_model_info(self):
        """
        Test that from_response handles empty string model_id/model_name
        (should not override with empty values)
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "",  # Empty string
            "model_name": ""  # Empty string
        }

        token_usage = TokenUsage.from_response(data)

        assert token_usage.input_tokens == 100
        # Empty strings are falsy, so they won't be set
        # This is intentional - we don't want to override with empty values
        assert token_usage.model_id is None or token_usage.model_id == ""
        assert token_usage.model_name is None or token_usage.model_name == ""

    def test_from_response_non_dict_input_still_works(self):
        """
        Test that from_response still works with non-dict input
        (e.g., response objects with attributes)
        """
        # Simulate an object with attributes (like actual API responses)
        class MockUsageResponse:
            def __init__(self):
                self.input_tokens = 100
                self.output_tokens = 200
                self.total_tokens = 300

        mock_response = MockUsageResponse()
        token_usage = TokenUsage.from_response(mock_response)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        # Model info won't be present in non-dict objects
        assert token_usage.model_id is None
        assert token_usage.model_name is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
