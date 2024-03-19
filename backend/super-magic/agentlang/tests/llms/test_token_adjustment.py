"""
测试动态 max_tokens 调整
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from agentlang.llms.utils.token_adjuster import (
    get_current_tokens,
    adjust_max_tokens,
    MIN_MAX_TOKENS,
    DEFAULT_SAFETY_BUFFER,
)


class TestTokenAdjustment:
    """测试动态 max_tokens 调整"""

    @pytest.mark.asyncio
    async def test_get_current_tokens_with_chat_history(self):
        """测试从聊天历史获取当前 token 数"""
        # 创建带有 chat_history 属性的 mock agent_context
        agent_context = MagicMock()

        # 创建带有 tokens_count 方法的 mock chat_history
        mock_chat_history = MagicMock()
        mock_chat_history.tokens_count = AsyncMock(return_value=5000)

        # 将 chat_history 设置为 agent_context 的属性
        agent_context.chat_history = mock_chat_history

        current_tokens = await get_current_tokens(agent_context, "test_req")

        # 应该返回实际的 token 数量
        assert current_tokens == 5000

    @pytest.mark.asyncio
    async def test_get_current_tokens_without_chat_history(self):
        """测试当 chat_history 不可用时获取当前 token 数"""
        # 创建没有 chat_history 属性的 mock agent_context
        agent_context = MagicMock()
        # 模拟缺失的 chat_history 属性
        del agent_context.chat_history

        current_tokens = await get_current_tokens(agent_context, "test_req")

        # 当 chat_history 不可用时应该返回 0
        assert current_tokens == 0

    @pytest.mark.asyncio
    async def test_get_current_tokens_without_agent_context(self):
        """测试当 agent_context 为 None 时获取当前 token 数"""
        current_tokens = await get_current_tokens(None, "test_req")

        # 当 agent_context 为 None 时应该返回 0
        assert current_tokens == 0

    def test_adjust_max_tokens_no_adjustment_needed(self):
        """测试不需要调整的情况"""
        requested = 4096
        input_tokens = 1000
        max_context = 8192

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_1"
        )

        # 应该返回请求的值（不需要调整）
        assert adjusted == requested

    def test_adjust_max_tokens_exceeds_context(self):
        """测试当超过上下文窗口时的调整"""
        requested = 8192
        input_tokens = 6000
        max_context = 8192

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_2"
        )

        # 应该被减少以适应上下文窗口
        assert adjusted < requested
        # 应该是可用 token 数减去安全缓冲区
        expected = max_context - input_tokens - DEFAULT_SAFETY_BUFFER
        assert adjusted == expected

    def test_adjust_max_tokens_minimum_enforcement(self):
        """测试最小 max_tokens 的强制执行"""
        requested = 4096
        input_tokens = 7500  # 非常高的输入
        max_context = 8192

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_3"
        )

        # 应该返回最小值
        assert adjusted == MIN_MAX_TOKENS

    def test_adjust_max_tokens_exact_fit(self):
        """测试恰好适合的情况"""
        max_context = 8192
        input_tokens = 4000
        safety_buffer = DEFAULT_SAFETY_BUFFER
        requested = max_context - input_tokens - safety_buffer

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_4"
        )

        # 应该返回请求的值（恰好适合）
        assert adjusted == requested

    def test_adjust_max_tokens_large_context_window(self):
        """测试大上下文窗口模型的调整"""
        # 使用小于 MAX_MAX_TOKENS (65536) 的值来测试
        # 当有足够的上下文空间时不需要调整
        requested = 60000
        input_tokens = 50000
        max_context = 200000  # 例如 Claude 3.5 Sonnet

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_5"
        )

        # 不需要调整（请求的值适合上下文且低于 MAX_MAX_TOKENS）
        assert adjusted == requested

    def test_adjust_max_tokens_very_long_conversation(self):
        """测试非常长的对话历史"""
        requested = 50000  # 请求超过可用空间
        input_tokens = 100000  # 非常长的对话
        max_context = 128000  # 大上下文的 Claude 模型

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_6"
        )

        # 应该调整为可用空间
        expected = max_context - input_tokens - DEFAULT_SAFETY_BUFFER
        assert adjusted == expected
        assert adjusted < requested

    def test_adjust_max_tokens_reasonable_request_with_long_context(self):
        """测试在长上下文中的合理请求不会被不必要地调整"""
        requested = 4096
        input_tokens = 100000  # 非常长的对话
        max_context = 128000  # 大上下文的 Claude 模型

        adjusted = adjust_max_tokens(
            requested_max_tokens=requested,
            current_input_tokens=input_tokens,
            max_context_tokens=max_context,
            request_id="test_req_7"
        )

        # 不应该调整，因为请求的值适合可用空间
        assert adjusted == requested
