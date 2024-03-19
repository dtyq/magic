#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test tokens_count method with additional messages after token_usage

This test verifies that tokens_count correctly calculates tokens for
ToolMessage and UserMessage that are added after a message with token_usage.
"""
import pytest
import tempfile
import shutil

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.chat_history.chat_history_models import (
    UserMessage,
    AssistantMessage,
    ToolMessage,
)
from agentlang.llms.token_usage.models import TokenUsage
from agentlang.event.dispatcher import EventDispatcher


class TestTokensCountWithAdditionalMessages:
    """Test tokens_count with additional messages after token_usage"""

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
    async def test_tokens_count_with_tool_message_after_token_usage(self, chat_history):
        """
        Test that tokens_count includes ToolMessage tokens when added after
        a message with token_usage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add tool message after (this should be included in token count)
        await chat_history.append_tool_message(
            content="Tool result with some content",
            tool_call_id="call_123",
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens (300) + tool message tokens
        # Tool message tokens = content tokens + tool_call_id tokens + 4 (base structure)
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Verify it includes the tool message by checking it's significantly more
        # Actual token count may vary, but should be at least base + some tokens
        assert total_tokens >= 300 + 5, "Should include tool message tokens"

    @pytest.mark.asyncio
    async def test_tokens_count_with_user_message_after_token_usage(self, chat_history):
        """
        Test that tokens_count includes UserMessage tokens when added after
        a message with token_usage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add user message after (this should be included in token count)
        await chat_history.append_user_message(
            content="User message with some content that should be counted",
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens (300) + user message tokens
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Verify it includes the user message
        # Actual token count may vary, but should be at least base + some tokens
        assert total_tokens >= 300 + 5, "Should include user message tokens"

    @pytest.mark.asyncio
    async def test_tokens_count_with_multiple_additional_messages(self, chat_history):
        """
        Test that tokens_count includes multiple additional messages
        (ToolMessage and UserMessage) after token_usage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add tool message
        await chat_history.append_tool_message(
            content="Tool result content",
            tool_call_id="call_123",
        )

        # Add user message
        await chat_history.append_user_message(
            content="User message content",
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens + tool message tokens + user message tokens
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Actual token count may vary, but should be at least base + tokens from both messages
        assert total_tokens >= 300 + 10, "Should include both additional messages"

    @pytest.mark.asyncio
    async def test_tokens_count_with_large_tool_message(self, chat_history):
        """
        Test that tokens_count correctly calculates tokens for large ToolMessage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add large tool message (simulating read_file result)
        large_content = "This is a very large tool result. " * 100
        await chat_history.append_tool_message(
            content=large_content,
            tool_call_id="call_read_file_123",
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens + large tool message tokens
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Large content should add significant tokens
        assert total_tokens >= 300 + 100, "Should include large tool message tokens"

    @pytest.mark.asyncio
    async def test_tokens_count_with_large_user_message(self, chat_history):
        """
        Test that tokens_count correctly calculates tokens for large UserMessage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add large user message
        large_content = "This is a very large user message with lots of content. " * 100
        await chat_history.append_user_message(
            content=large_content,
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens + large user message tokens
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Large content should add significant tokens
        assert total_tokens >= 300 + 100, "Should include large user message tokens"

    @pytest.mark.asyncio
    async def test_tokens_count_no_additional_messages(self, chat_history):
        """
        Test that tokens_count returns base tokens when there are no
        additional messages after token_usage
        """
        # Add assistant message with token_usage (this is the last message)
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should return base tokens only
        assert total_tokens == 300, "Should return base tokens when no additional messages"

    @pytest.mark.asyncio
    async def test_tokens_count_no_token_usage_fallback(self, chat_history):
        """
        Test that tokens_count falls back to calculating all messages when
        no message has token_usage
        """
        # Add messages without token_usage
        await chat_history.append_user_message(content="User message 1")
        await chat_history.append_assistant_message(content="Assistant message 1")
        await chat_history.append_tool_message(
            content="Tool result",
            tool_call_id="call_123",
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should calculate all messages
        assert total_tokens > 0, "Should calculate tokens for all messages"
        # Should be at least the sum of all message tokens
        assert total_tokens >= 20, "Should include tokens from all messages"

    @pytest.mark.asyncio
    async def test_tokens_count_with_tool_calls_in_additional_message(self, chat_history):
        """
        Test that tokens_count correctly calculates tokens for AssistantMessage
        with tool_calls that is added after token_usage
        """
        # Add assistant message with token_usage
        token_usage = TokenUsage(
            input_tokens=100,
            output_tokens=200,
            total_tokens=300,
        )
        await chat_history.append_assistant_message(
            content="Test assistant message",
            token_usage=token_usage,
        )

        # Add assistant message with tool_calls (no token_usage)
        from agentlang.chat_history.chat_history_models import ToolCall, FunctionCall
        tool_call = ToolCall(
            id="call_456",
            type="function",
            function=FunctionCall(
                name="read_file",
                arguments='{"path": "test.txt"}',
            ),
        )
        await chat_history.append_assistant_message(
            content="",
            tool_calls_data=[tool_call],
        )

        # Calculate tokens
        total_tokens = await chat_history.tokens_count()

        # Should include base tokens + assistant message with tool_calls tokens
        assert total_tokens > 300, "Total tokens should be greater than base tokens"
        # Tool calls should add tokens for name and arguments
        assert total_tokens >= 300 + 10, "Should include tool_calls tokens"

    @pytest.mark.asyncio
    async def test_calculate_message_tokens_tool_message(self, chat_history):
        """
        Test that _calculate_message_tokens correctly calculates tokens for ToolMessage
        """
        tool_msg = ToolMessage(
            content="Tool result content",
            tool_call_id="call_123",
        )

        tokens = chat_history._calculate_message_tokens(tool_msg)

        # Should include content tokens + tool_call_id tokens + 4 (base structure)
        assert tokens > 0, "Should calculate tokens for ToolMessage"
        assert tokens >= 10, "Should include content and tool_call_id tokens"

    @pytest.mark.asyncio
    async def test_calculate_message_tokens_user_message(self, chat_history):
        """
        Test that _calculate_message_tokens correctly calculates tokens for UserMessage
        """
        user_msg = UserMessage(
            content="User message content",
        )

        tokens = chat_history._calculate_message_tokens(user_msg)

        # Should include content tokens + 4 (base structure)
        assert tokens > 0, "Should calculate tokens for UserMessage"
        assert tokens >= 5, "Should include content tokens"

    @pytest.mark.asyncio
    async def test_calculate_message_tokens_assistant_with_tool_calls(self, chat_history):
        """
        Test that _calculate_message_tokens correctly calculates tokens for
        AssistantMessage with tool_calls
        """
        from agentlang.chat_history.chat_history_models import ToolCall, FunctionCall
        tool_call = ToolCall(
            id="call_789",
            type="function",
            function=FunctionCall(
                name="read_file",
                arguments='{"path": "test.txt", "encoding": "utf-8"}',
            ),
        )
        assistant_msg = AssistantMessage(
            content="I'll read the file",
            tool_calls=[tool_call],
        )

        tokens = chat_history._calculate_message_tokens(assistant_msg)

        # Should include content tokens + tool_calls tokens + 4 (base structure)
        assert tokens > 0, "Should calculate tokens for AssistantMessage with tool_calls"
        assert tokens >= 15, "Should include content and tool_calls tokens"
