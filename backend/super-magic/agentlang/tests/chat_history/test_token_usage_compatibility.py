#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test compatibility issues when switching from from_response to from_dict

This test checks for potential problems that might arise from the fix.
"""
import pytest
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.chat_history.chat_history_models import AssistantMessage


class TestTokenUsageCompatibility:
    """Test compatibility of from_dict vs from_response"""

    def test_standard_format_works_with_both_methods(self):
        """
        Test that standard format (saved by to_dict) works with both methods
        This should always work since to_dict() produces standard format

        After the fix, from_response now also preserves model_id and model_name
        when they exist in the input dict, providing extra robustness.
        """
        # This is the format produced by TokenUsage.to_dict()
        standard_data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "claude-3.7-sonnet",
            "model_name": "Claude 3.7 Sonnet"
        }

        # from_dict works perfectly with standard format
        token_from_dict = TokenUsage.from_dict(standard_data)
        assert token_from_dict.input_tokens == 100
        assert token_from_dict.output_tokens == 200
        assert token_from_dict.total_tokens == 300
        assert token_from_dict.model_id == "claude-3.7-sonnet"
        assert token_from_dict.model_name == "Claude 3.7 Sonnet"

        # from_response now also preserves model_id and model_name (enhanced compatibility)
        token_from_response = TokenUsage.from_response(standard_data)
        assert token_from_response.input_tokens == 100
        assert token_from_response.output_tokens == 200
        assert token_from_response.total_tokens == 300
        # After enhancement, model info is preserved
        assert token_from_response.model_id == "claude-3.7-sonnet"
        assert token_from_response.model_name == "Claude 3.7 Sonnet"

    def test_openai_format_now_works_with_from_dict(self):
        """
        Test that OpenAI API format (prompt_tokens/completion_tokens)
        NOW works correctly with from_dict thanks to smart format detection

        from_dict will automatically detect OpenAI format and delegate to from_response
        """
        # OpenAI API response format
        openai_data = {
            "prompt_tokens": 100,
            "completion_tokens": 200,
            "total_tokens": 300
        }

        # from_dict now intelligently detects OpenAI format and handles it correctly
        token_from_dict = TokenUsage.from_dict(openai_data)
        assert token_from_dict.input_tokens == 100
        assert token_from_dict.output_tokens == 200
        assert token_from_dict.total_tokens == 300

        # from_response also works (as before)
        token_from_response = TokenUsage.from_response(openai_data)
        assert token_from_response.input_tokens == 100
        assert token_from_response.output_tokens == 200
        assert token_from_response.total_tokens == 300

    def test_data_saved_by_to_dict_is_always_standard_format(self):
        """
        Verify that TokenUsage.to_dict() always produces standard format
        This ensures that all saved data can be loaded with from_dict
        """
        # Create TokenUsage with all fields
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
            model_id="test-model",
            model_name="Test Model"
        )

        # Convert to dict (this is what gets saved to file)
        saved_data = token_usage.to_dict()

        # Verify it uses standard field names
        assert "input_tokens" in saved_data
        assert "output_tokens" in saved_data
        assert "total_tokens" in saved_data
        assert saved_data["input_tokens"] == 100
        assert saved_data["output_tokens"] == 200
        assert saved_data["total_tokens"] == 300

        # Verify model info is preserved
        assert "model_id" in saved_data
        assert "model_name" in saved_data
        assert saved_data["model_id"] == "test-model"
        assert saved_data["model_name"] == "Test Model"

        # Verify it does NOT contain OpenAI format fields
        assert "prompt_tokens" not in saved_data
        assert "completion_tokens" not in saved_data

        # Verify from_dict can load it correctly
        loaded = TokenUsage.from_dict(saved_data)
        assert loaded.input_tokens == 100
        assert loaded.output_tokens == 200
        assert loaded.total_tokens == 300
        assert loaded.model_id == "test-model"
        assert loaded.model_name == "Test Model"

    def test_missing_fields_handled_gracefully(self):
        """
        Test that from_dict handles missing fields gracefully
        (important for backward compatibility with old data)
        """
        # Old data without model_id and model_name
        old_data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300
        }

        token_usage = TokenUsage.from_dict(old_data)
        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        assert token_usage.model_id is None
        assert token_usage.model_name is None

        # Even older data with missing total_tokens
        very_old_data = {
            "input_tokens": 100,
            "output_tokens": 200
        }

        token_usage2 = TokenUsage.from_dict(very_old_data)
        assert token_usage2.input_tokens == 100
        assert token_usage2.output_tokens == 200
        assert token_usage2.total_tokens == 0  # Default value

    def test_assistant_message_from_dict_with_standard_format(self):
        """
        Test that AssistantMessage.from_dict works correctly with
        standard format token_usage after the fix
        """
        # Standard format (what's actually saved in chat history files)
        message_data = {
            "role": "assistant",
            "content": "Test response",
            "timestamp": "2024-01-01 12:00:00",
            "token_usage": {
                "input_tokens": 100,
                "output_tokens": 200,
                "total_tokens": 300,
                "model_id": "claude-3.7-sonnet",
                "model_name": "Claude 3.7 Sonnet"
            }
        }

        msg = AssistantMessage.from_dict(message_data)

        assert msg.token_usage is not None
        assert msg.token_usage.input_tokens == 100
        assert msg.token_usage.output_tokens == 200
        assert msg.token_usage.total_tokens == 300
        assert msg.token_usage.model_id == "claude-3.7-sonnet"
        assert msg.token_usage.model_name == "Claude 3.7 Sonnet"

    def test_edge_case_empty_token_usage(self):
        """
        Test edge case where token_usage is empty dict

        Note: Empty dict is technically invalid but from_dict handles it gracefully
        by creating a TokenUsage with all default values (zeros)
        """
        # Empty dict is a valid edge case - creates TokenUsage with defaults
        empty_data = {}
        token_usage = TokenUsage.from_dict(empty_data)

        assert token_usage is not None
        assert token_usage.input_tokens == 0
        assert token_usage.output_tokens == 0
        assert token_usage.total_tokens == 0
        assert token_usage.model_id is None
        assert token_usage.model_name is None

    def test_edge_case_token_usage_with_extra_fields(self):
        """
        Test that extra unknown fields in token_usage don't cause problems
        """
        message_data = {
            "role": "assistant",
            "content": "Test response",
            "timestamp": "2024-01-01 12:00:00",
            "token_usage": {
                "input_tokens": 100,
                "output_tokens": 200,
                "total_tokens": 300,
                "model_id": "test-model",
                "model_name": "Test Model",
                "unknown_field": "should be ignored",
                "another_unknown": 999
            }
        }

        msg = AssistantMessage.from_dict(message_data)

        # Should work fine, extra fields are ignored
        assert msg.token_usage is not None
        assert msg.token_usage.input_tokens == 100
        assert msg.token_usage.output_tokens == 200
        assert msg.token_usage.total_tokens == 300
        assert msg.token_usage.model_id == "test-model"
        assert msg.token_usage.model_name == "Test Model"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
