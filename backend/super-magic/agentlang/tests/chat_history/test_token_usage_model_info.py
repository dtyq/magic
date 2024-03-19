#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test token_usage model_id and model_name persistence in chat history

This test verifies that model_id and model_name are correctly preserved
when saving and loading chat history from files.
"""
import pytest
import tempfile
import shutil
import json
from pathlib import Path

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import AssistantMessage
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.event.dispatcher import EventDispatcher


class TestTokenUsageModelInfo:
    """Test token_usage model_id and model_name persistence"""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def chat_history(self, temp_dir):
        """Create ChatHistory instance for testing"""
        event_dispatcher = EventDispatcher()
        chat_history = ChatHistory(
            "test-agent",
            "test-123",
            chat_history_dir=temp_dir,
            event_dispatcher=event_dispatcher,
        )
        return chat_history

    @pytest.mark.asyncio
    async def test_token_usage_with_model_info_persistence(self, chat_history):
        """
        Test that token_usage with model_id and model_name is correctly
        saved to file and loaded back
        """
        # Create TokenUsage with model_id and model_name
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
            model_id="claude-3.7-sonnet",
            model_name="Claude 3.7 Sonnet"
        )

        # Add assistant message with token_usage
        await chat_history.append_assistant_message(
            content="Test response",
            token_usage=token_usage
        )

        # Verify message was added correctly
        assert len(chat_history.messages) == 1
        msg = chat_history.messages[0]
        assert isinstance(msg, AssistantMessage)
        assert msg.token_usage is not None
        assert msg.token_usage.model_id == "claude-3.7-sonnet"
        assert msg.token_usage.model_name == "Claude 3.7 Sonnet"
        assert msg.token_usage.input_tokens == 100
        assert msg.token_usage.output_tokens == 200
        assert msg.token_usage.total_tokens == 300

        # Save chat history
        await chat_history.save()

        # Verify file was created
        assert chat_history.exists()

        # Load raw JSON to verify data was saved correctly
        with open(chat_history._history_file_path, 'r', encoding='utf-8') as f:
            saved_data = json.load(f)

        assert len(saved_data) == 1
        assert saved_data[0]["role"] == "assistant"
        assert "token_usage" in saved_data[0]
        token_usage_data = saved_data[0]["token_usage"]
        assert token_usage_data["model_id"] == "claude-3.7-sonnet"
        assert token_usage_data["model_name"] == "Claude 3.7 Sonnet"
        assert token_usage_data["input_tokens"] == 100
        assert token_usage_data["output_tokens"] == 200
        assert token_usage_data["total_tokens"] == 300

        # Create new ChatHistory instance to load from file
        event_dispatcher = EventDispatcher()
        loaded_chat_history = ChatHistory(
            "test-agent",
            "test-123",
            chat_history_dir=chat_history.chat_history_dir,
            event_dispatcher=event_dispatcher,
        )

        # Verify loaded data
        assert len(loaded_chat_history.messages) == 1
        loaded_msg = loaded_chat_history.messages[0]
        assert isinstance(loaded_msg, AssistantMessage)
        assert loaded_msg.token_usage is not None

        # This is the key test - model_id and model_name should be preserved
        assert loaded_msg.token_usage.model_id == "claude-3.7-sonnet", \
            "model_id should be preserved after loading from file"
        assert loaded_msg.token_usage.model_name == "Claude 3.7 Sonnet", \
            "model_name should be preserved after loading from file"
        assert loaded_msg.token_usage.input_tokens == 100
        assert loaded_msg.token_usage.output_tokens == 200
        assert loaded_msg.token_usage.total_tokens == 300

    @pytest.mark.asyncio
    async def test_multiple_messages_with_different_models(self, chat_history):
        """
        Test multiple messages with different model_id and model_name
        to ensure each message preserves its own model info
        """
        # Add message with first model
        token_usage1 = TokenUsage(
            input_tokens=50,
            output_tokens=100,
            total_tokens=150,
            model_id="claude-3.7-sonnet",
            model_name="Claude 3.7 Sonnet"
        )
        await chat_history.append_assistant_message(
            content="Response from Claude",
            token_usage=token_usage1
        )

        # Add message with second model
        token_usage2 = TokenUsage(
            input_tokens=80,
            output_tokens=120,
            total_tokens=200,
            model_id="gpt-4",
            model_name="GPT-4"
        )
        await chat_history.append_assistant_message(
            content="Response from GPT-4",
            token_usage=token_usage2
        )

        # Add message with auto model
        token_usage3 = TokenUsage(
            input_tokens=60,
            output_tokens=90,
            total_tokens=150,
            model_id="auto",
            model_name="auto"
        )
        await chat_history.append_assistant_message(
            content="Response from auto model",
            token_usage=token_usage3
        )

        # Save and reload
        await chat_history.save()

        event_dispatcher = EventDispatcher()
        loaded_chat_history = ChatHistory(
            "test-agent",
            "test-123",
            chat_history_dir=chat_history.chat_history_dir,
            event_dispatcher=event_dispatcher,
        )

        # Verify all messages preserved their model info
        assert len(loaded_chat_history.messages) == 3

        msg1 = loaded_chat_history.messages[0]
        assert msg1.token_usage.model_id == "claude-3.7-sonnet"
        assert msg1.token_usage.model_name == "Claude 3.7 Sonnet"
        assert msg1.token_usage.total_tokens == 150

        msg2 = loaded_chat_history.messages[1]
        assert msg2.token_usage.model_id == "gpt-4"
        assert msg2.token_usage.model_name == "GPT-4"
        assert msg2.token_usage.total_tokens == 200

        msg3 = loaded_chat_history.messages[2]
        assert msg3.token_usage.model_id == "auto"
        assert msg3.token_usage.model_name == "auto"
        assert msg3.token_usage.total_tokens == 150

    @pytest.mark.asyncio
    async def test_token_usage_without_model_info(self, chat_history):
        """
        Test that token_usage without model_id and model_name
        (e.g., from old data or estimated tokens) still works
        """
        # Create TokenUsage without model_id and model_name
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300
        )

        await chat_history.append_assistant_message(
            content="Test response",
            token_usage=token_usage
        )

        await chat_history.save()

        # Reload
        event_dispatcher = EventDispatcher()
        loaded_chat_history = ChatHistory(
            "test-agent",
            "test-123",
            chat_history_dir=chat_history.chat_history_dir,
            event_dispatcher=event_dispatcher,
        )

        # Verify data is preserved (model_id and model_name should be None)
        assert len(loaded_chat_history.messages) == 1
        loaded_msg = loaded_chat_history.messages[0]
        assert loaded_msg.token_usage is not None
        assert loaded_msg.token_usage.model_id is None
        assert loaded_msg.token_usage.model_name is None
        assert loaded_msg.token_usage.input_tokens == 100
        assert loaded_msg.token_usage.output_tokens == 200
        assert loaded_msg.token_usage.total_tokens == 300

    def test_token_usage_from_dict_preserves_model_info(self):
        """
        Test that TokenUsage.from_dict() correctly preserves model_id and model_name
        """
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "claude-3.7-sonnet",
            "model_name": "Claude 3.7 Sonnet"
        }

        token_usage = TokenUsage.from_dict(data)

        assert token_usage.input_tokens == 100
        assert token_usage.output_tokens == 200
        assert token_usage.total_tokens == 300
        assert token_usage.model_id == "claude-3.7-sonnet"
        assert token_usage.model_name == "Claude 3.7 Sonnet"

    def test_token_usage_from_response_does_not_preserve_model_info(self):
        """
        Test that TokenUsage.from_response() does NOT preserve model_id and model_name
        This demonstrates the bug that was fixed
        """
        # Simulate data as if it came from chat history file
        data = {
            "input_tokens": 100,
            "output_tokens": 200,
            "total_tokens": 300,
            "model_id": "claude-3.7-sonnet",
            "model_name": "Claude 3.7 Sonnet"
        }

        # Using from_response (the old buggy way)
        token_usage_from_response = TokenUsage.from_response(data)

        # from_response treats the data as API response format
        # and doesn't preserve model_id and model_name
        assert token_usage_from_response.input_tokens == 100
        assert token_usage_from_response.output_tokens == 200
        assert token_usage_from_response.total_tokens == 300
        # These will be None because from_response doesn't set them
        assert token_usage_from_response.model_id is None
        assert token_usage_from_response.model_name is None

        # Using from_dict (the correct way after fix)
        token_usage_from_dict = TokenUsage.from_dict(data)

        # from_dict correctly preserves all fields
        assert token_usage_from_dict.input_tokens == 100
        assert token_usage_from_dict.output_tokens == 200
        assert token_usage_from_dict.total_tokens == 300
        assert token_usage_from_dict.model_id == "claude-3.7-sonnet"
        assert token_usage_from_dict.model_name == "Claude 3.7 Sonnet"

    def test_assistant_message_from_dict_preserves_model_info(self):
        """
        Test that AssistantMessage.from_dict() correctly preserves
        token_usage model_id and model_name after the fix
        """
        data = {
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

        msg = AssistantMessage.from_dict(data)

        assert msg.content == "Test response"
        assert msg.token_usage is not None
        assert msg.token_usage.input_tokens == 100
        assert msg.token_usage.output_tokens == 200
        assert msg.token_usage.total_tokens == 300
        # After the fix, these should be preserved
        assert msg.token_usage.model_id == "claude-3.7-sonnet"
        assert msg.token_usage.model_name == "Claude 3.7 Sonnet"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
