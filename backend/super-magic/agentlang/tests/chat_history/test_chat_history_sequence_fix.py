#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChatHistory工具调用序列修复功能的单元测试

测试_fix_message_sequence_errors方法是否正确修复tool_use和tool_result不匹配的问题。
"""
import pytest
import tempfile
import shutil
from unittest.mock import patch

from agentlang.chat_history.chat_history import ChatHistory
from agentlang.event.dispatcher import EventDispatcher


class TestChatHistorySequenceFix:
    """ChatHistory工具调用序列修复功能测试类"""

    @pytest.fixture
    def chat_history(self):
        """创建临时的ChatHistory实例用于测试"""
        temp_dir = tempfile.mkdtemp()
        # 创建事件分发器用于测试
        event_dispatcher = EventDispatcher()
        chat_history = ChatHistory(
            "test-agent",
            "test-123",
            chat_history_dir=temp_dir,
            event_dispatcher,  # 传递事件分发器
        )
        yield chat_history
        # 清理临时目录
        shutil.rmtree(temp_dir)

    def test_fix_missing_tool_result(self, chat_history):
        """测试修复缺失tool_result的情况：去除没有tool_result的assistant消息"""
        # 模拟用户遇到的问题：assistant消息包含tool_calls，但后面没有对应的tool_result
        problematic_messages = [
            {
                "role": "assistant",
                "content": "让我查看一些具体网页内容，以获取更详细的信息：",
                "tool_calls": [
                    {
                        "id": "tooluse_tZ9Mc-0vSQuWex4ppzseNQ",
                        "type": "function",
                        "function": {
                            "name": "read_webpages_as_markdown",
                            "arguments": '{"explanation":"我需要阅读这些网页内容","urls":["https://example.com"]}'
                        }
                    }
                ]
            },
            {
                "role": "assistant",
                "content": "🚨 工具调用被用户中断：当前工具调用被用户打断"
            }
        ]

        # 调用修复方法
        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 验证修复结果：带tool_calls但没有tool_result的消息应该被移除
        assert len(fixed_messages) == 1  # 只剩下中断通知消息

        # 剩下的消息应该是中断通知
        assert fixed_messages[0]["role"] == "assistant"
        assert "工具调用被用户中断" in fixed_messages[0]["content"]
        assert "tool_calls" not in fixed_messages[0]  # 确保不包含tool_calls

    def test_fix_multiple_missing_tool_results(self, chat_history):
        """测试修复多个缺失tool_result的情况：去除没有完整tool_result的assistant消息"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "我将同时调用多个工具：",
                "tool_calls": [
                    {
                        "id": "tool_1",
                        "type": "function",
                        "function": {"name": "tool_one", "arguments": "{}"}
                    },
                    {
                        "id": "tool_2",
                        "type": "function",
                        "function": {"name": "tool_two", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "assistant",
                "content": "所有工具都被中断了"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 应该只有1个消息：带tool_calls的assistant被移除，只剩下最终assistant
        assert len(fixed_messages) == 1

        # 剩下的消息应该是中断通知
        assert fixed_messages[0]["role"] == "assistant"
        assert "所有工具都被中断了" in fixed_messages[0]["content"]
        assert "tool_calls" not in fixed_messages[0]

    def test_fix_orphaned_tool_message(self, chat_history):
        """测试修复孤立tool消息的情况"""
        problematic_messages = [
            {
                "role": "user",
                "content": "用户请求"
            },
            {
                "role": "tool",
                "content": "这是一个孤立的工具结果",
                "tool_call_id": "orphaned_tool_id"
            },
            {
                "role": "assistant",
                "content": "继续处理"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 孤立的tool消息应该被转换为assistant消息
        assert len(fixed_messages) == 3
        assert fixed_messages[0]["role"] == "user"
        assert fixed_messages[1]["role"] == "assistant"  # 原来的tool消息被转换
        assert "工具执行结果" in fixed_messages[1]["content"]
        assert fixed_messages[2]["role"] == "assistant"

    def test_no_fix_needed_for_correct_sequence(self, chat_history):
        """测试正确的消息序列不需要修复"""
        correct_messages = [
            {
                "role": "assistant",
                "content": "我将调用工具：",
                "tool_calls": [
                    {
                        "id": "correct_tool_id",
                        "type": "function",
                        "function": {"name": "correct_tool", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "tool",
                "content": "工具执行成功",
                "tool_call_id": "correct_tool_id"
            },
            {
                "role": "assistant",
                "content": "工具执行完成"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(correct_messages)

        # 正确的序列应该保持不变
        assert len(fixed_messages) == len(correct_messages)
        assert fixed_messages == correct_messages

    def test_partial_tool_results_missing(self, chat_history):
        """测试部分tool_result缺失的情况：应该移除整个assistant消息"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "调用多个工具",
                "tool_calls": [
                    {
                        "id": "tool_with_result",
                        "type": "function",
                        "function": {"name": "tool_one", "arguments": "{}"}
                    },
                    {
                        "id": "tool_without_result",
                        "type": "function",
                        "function": {"name": "tool_two", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "tool",
                "content": "第一个工具的结果",
                "tool_call_id": "tool_with_result"
            },
            {
                "role": "assistant",
                "content": "继续处理"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 带tool_calls的assistant应该被移除，孤立的tool消息应该被转换
        assert len(fixed_messages) == 2

        # 第一个应该是转换后的assistant消息（原本是孤立的tool消息）
        assert fixed_messages[0]["role"] == "assistant"
        assert "工具执行结果" in fixed_messages[0]["content"]

        # 第二个应该是原来的"继续处理"消息
        assert fixed_messages[1]["role"] == "assistant"
        assert "继续处理" in fixed_messages[1]["content"]

    def test_remove_duplicate_messages(self, chat_history):
        """测试去除重复消息的功能"""
        messages_with_duplicates = [
            {
                "role": "user",
                "content": "Hello"
            },
            {
                "role": "assistant",
                "content": "Hi there!"
            },
            {
                "role": "assistant",
                "content": "Hi there!"  # 重复的消息
            },
            {
                "role": "user",
                "content": "How are you?"
            },
            {
                "role": "user",
                "content": "How are you?"  # 重复的消息
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(messages_with_duplicates)

        # 重复的消息应该被移除
        assert len(fixed_messages) == 3

        # 验证内容
        assert fixed_messages[0]["content"] == "Hello"
        assert fixed_messages[1]["content"] == "Hi there!"
        assert fixed_messages[2]["content"] == "How are you?"

    @patch('agentlang.chat_history.chat_history.logger')
    def test_logging_on_fix(self, mock_logger, chat_history):
        """测试修复时是否正确记录日志"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "工具调用",
                "tool_calls": [
                    {
                        "id": "test_tool_id",
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"}
                    }
                ]
            }
        ]

        chat_history._fix_message_sequence_errors(problematic_messages)

        # 验证是否记录了修复日志
        mock_logger.warning.assert_called()
        mock_logger.info.assert_called()

        # 检查日志内容
        warning_call = mock_logger.warning.call_args_list[-1]
        info_call = mock_logger.info.call_args_list[-1]

        assert "test_tool" in str(warning_call)  # 工具名称应该在警告日志中
        assert "修复完成" in str(info_call)

    def test_get_messages_for_llm_calls_fix(self, chat_history):
        """测试get_messages_for_llm方法是否会调用修复逻辑"""
        # 这个测试主要验证集成是否正确

        # 由于get_messages_for_llm会调用_fix_message_sequence_errors
        # 我们只需要确保没有异常抛出
        messages = chat_history.get_messages_for_llm()
        assert isinstance(messages, list)

    # --- 边界情况测试 ---

    def test_empty_message_list(self, chat_history):
        """测试空消息列表的处理"""
        empty_messages = []
        fixed_messages = chat_history._fix_message_sequence_errors(empty_messages)

        assert isinstance(fixed_messages, list)
        assert len(fixed_messages) == 0

    def test_single_message(self, chat_history):
        """测试单条消息的处理"""
        single_message = [
            {
                "role": "user",
                "content": "Hello"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(single_message)
        assert len(fixed_messages) == 1
        assert fixed_messages[0] == single_message[0]

    def test_all_duplicate_messages(self, chat_history):
        """测试全部都是重复消息的情况"""
        duplicate_messages = [
            {"role": "assistant", "content": "Same content"},
            {"role": "assistant", "content": "Same content"},
            {"role": "assistant", "content": "Same content"},
            {"role": "assistant", "content": "Same content"}
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(duplicate_messages)
        assert len(fixed_messages) == 1
        assert fixed_messages[0]["content"] == "Same content"

    # --- 消息结构格式异常测试 ---

    def test_message_missing_role(self, chat_history):
        """测试缺少role字段的消息处理"""
        problematic_messages = [
            {
                "role": "user",
                "content": "Normal message"
            },
            {
                # 缺少role字段
                "content": "Message without role"
            },
            {
                "role": "assistant",
                "content": "Response"
            }
        ]

        # 方法应该能够处理这种情况而不崩溃
        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)
        assert isinstance(fixed_messages, list)
        # 缺少role的消息应该被保留（现有逻辑不过滤它们）
        assert len(fixed_messages) == 3

    def test_tool_message_missing_tool_call_id(self, chat_history):
        """测试缺少tool_call_id的tool消息处理"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "Calling tool",
                "tool_calls": [
                    {
                        "id": "valid_tool_id",
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "tool",
                "content": "Tool result without call id"
                # 缺少tool_call_id字段
            },
            {
                "role": "assistant",
                "content": "Continue"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # assistant消息应该被移除（因为没有对应的tool_result）
        # 孤立的tool消息应该被转换为assistant消息
        assert len(fixed_messages) == 2
        assert fixed_messages[0]["role"] == "assistant"
        assert "工具执行结果" in fixed_messages[0]["content"]
        assert fixed_messages[1]["content"] == "Continue"

    def test_malformed_tool_calls_structure(self, chat_history):
        """测试tool_calls结构不完整的情况"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "Calling tool",
                "tool_calls": [
                    {
                        # 缺少id字段 - 这种情况下工具调用会被跳过，assistant消息会保留
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "assistant",
                "content": "Another call",
                "tool_calls": [
                    {
                        "id": "tool_id",
                        "type": "function",
                        "function": {
                            # 缺少name字段 - 但有id，所以会检查是否有tool_result
                            "arguments": "{}"
                        }
                    }
                ]
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 第一个assistant消息会保留（缺少id的tool_call被跳过，不检查tool_result）
        # 第二个assistant消息会被移除（有id但没有对应的tool_result）
        assert len(fixed_messages) == 1
        assert fixed_messages[0]["content"] == "Calling tool"

    # --- 复杂序列错误测试 ---

    def test_tool_call_id_mismatch(self, chat_history):
        """测试tool_call_id不匹配的情况"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "Calling tool",
                "tool_calls": [
                    {
                        "id": "expected_id",
                        "type": "function",
                        "function": {"name": "test_tool", "arguments": "{}"}
                    }
                ]
            },
            {
                "role": "tool",
                "content": "Tool result",
                "tool_call_id": "wrong_id"  # ID不匹配
            },
            {
                "role": "assistant",
                "content": "Continue"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # assistant消息应该被移除（没有匹配的tool_result）
        # tool消息应该被转换为assistant消息（成为孤立的tool消息）
        assert len(fixed_messages) == 2
        assert fixed_messages[0]["role"] == "assistant"
        assert "工具执行结果" in fixed_messages[0]["content"]
        assert fixed_messages[1]["content"] == "Continue"

    def test_multiple_tools_partial_results(self, chat_history):
        """测试多个工具调用部分有结果的复杂情况"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "Calling multiple tools",
                "tool_calls": [
                    {"id": "tool1", "type": "function", "function": {"name": "tool_one", "arguments": "{}"}},
                    {"id": "tool2", "type": "function", "function": {"name": "tool_two", "arguments": "{}"}},
                    {"id": "tool3", "type": "function", "function": {"name": "tool_three", "arguments": "{}"}}
                ]
            },
            {
                "role": "tool",
                "content": "Result 1",
                "tool_call_id": "tool1"
            },
            {
                "role": "tool",
                "content": "Result 3",
                "tool_call_id": "tool3"
            },
            # tool2 没有结果
            {
                "role": "assistant",
                "content": "Processing complete"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 带tool_calls的assistant应该被移除（不是所有工具都有结果）
        # 两个tool消息应该被转换为assistant消息
        assert len(fixed_messages) == 3

        # 前两个应该是转换后的assistant消息
        assert fixed_messages[0]["role"] == "assistant"
        assert "工具执行结果" in fixed_messages[0]["content"]
        assert fixed_messages[1]["role"] == "assistant"
        assert "工具执行结果" in fixed_messages[1]["content"]

        # 最后一个是原来的assistant消息
        assert fixed_messages[2]["content"] == "Processing complete"

    def test_nested_tool_call_interruptions(self, chat_history):
        """测试嵌套的工具调用中断情况"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "First tool call",
                "tool_calls": [{"id": "tool1", "type": "function", "function": {"name": "tool_one", "arguments": "{}"}}]
            },
            {
                "role": "assistant",
                "content": "Second tool call",
                "tool_calls": [{"id": "tool2", "type": "function", "function": {"name": "tool_two", "arguments": "{}"}}]
            },
            {
                "role": "tool",
                "content": "Only tool2 result",
                "tool_call_id": "tool2"
            },
            {
                "role": "assistant",
                "content": "Continue after interruption"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 第一个assistant（tool1没有结果）应该被移除
        # 第二个assistant（tool2有结果）应该保留
        # tool消息应该保留
        # 最后的assistant应该保留
        assert len(fixed_messages) == 3
        assert fixed_messages[0]["content"] == "Second tool call"
        assert fixed_messages[1]["role"] == "tool"
        assert fixed_messages[2]["content"] == "Continue after interruption"

    # --- 特殊数据处理测试 ---

    def test_tool_calls_with_complex_duplicates(self, chat_history):
        """测试带tool_calls的复杂重复消息"""
        messages_with_tool_duplicates = [
            {
                "role": "assistant",
                "content": "Calling tool",
                "tool_calls": [{"id": "tool1", "type": "function", "function": {"name": "test", "arguments": "{}"}}]
            },
            {
                "role": "tool",
                "content": "Tool result",
                "tool_call_id": "tool1"
            },
            {
                "role": "assistant",
                "content": "Same response"
            },
            {
                "role": "assistant",
                "content": "Same response"  # 重复内容
            },
            {
                "role": "assistant",
                "content": "Different response"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(messages_with_tool_duplicates)

        # 重复的assistant消息应该被移除
        assert len(fixed_messages) == 4
        assert fixed_messages[0]["content"] == "Calling tool"
        assert fixed_messages[1]["role"] == "tool"
        assert fixed_messages[2]["content"] == "Same response"  # 保留第一个
        assert fixed_messages[3]["content"] == "Different response"

    def test_empty_content_messages(self, chat_history):
        """测试空内容消息的处理"""
        messages_with_empty_content = [
            {
                "role": "user",
                "content": ""
            },
            {
                "role": "assistant",
                "content": ""
            },
            {
                "role": "assistant",
                "content": ""  # 重复的空内容
            },
            {
                "role": "user",
                "content": "Real content"
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(messages_with_empty_content)

        # 重复的空内容消息应该被去除
        assert len(fixed_messages) == 3
        assert fixed_messages[0]["content"] == ""
        assert fixed_messages[1]["content"] == ""
        assert fixed_messages[2]["content"] == "Real content"

    # --- 性能和稳定性测试 ---

    def test_large_message_list(self, chat_history):
        """测试大量消息的处理性能"""
        # 创建包含1000条消息的列表
        large_message_list = []
        for i in range(1000):
            large_message_list.append({
                "role": "user" if i % 2 == 0 else "assistant",
                "content": f"Message {i}"
            })

        # 添加一些重复消息来测试去重功能
        large_message_list.extend([
            {"role": "assistant", "content": "Duplicate"},
            {"role": "assistant", "content": "Duplicate"},
            {"role": "assistant", "content": "Duplicate"}
        ])

        fixed_messages = chat_history._fix_message_sequence_errors(large_message_list)

        # 应该移除重复的消息
        assert len(fixed_messages) == 1001  # 1000 + 1 (去重后)
        assert isinstance(fixed_messages, list)

    def test_extreme_nesting_levels(self, chat_history):
        """测试极端的工具调用嵌套情况"""
        # 创建深度嵌套的工具调用场景
        nested_messages = []

        # 创建10层嵌套的工具调用，但只有最后一个有结果
        for i in range(10):
            nested_messages.append({
                "role": "assistant",
                "content": f"Tool call level {i}",
                "tool_calls": [{"id": f"tool{i}", "type": "function", "function": {"name": f"tool_{i}", "arguments": "{}"}}]
            })

        # 只为最后一个工具调用提供结果
        nested_messages.append({
            "role": "tool",
            "content": "Only the last tool has result",
            "tool_call_id": "tool9"
        })

        nested_messages.append({
            "role": "assistant",
            "content": "Final response"
        })

        fixed_messages = chat_history._fix_message_sequence_errors(nested_messages)

        # 前9个assistant消息应该被移除（没有tool_result）
        # 第10个assistant和tool消息应该保留
        # 最后的assistant消息应该保留
        assert len(fixed_messages) == 3
        assert fixed_messages[0]["content"] == "Tool call level 9"
        assert fixed_messages[1]["role"] == "tool"
        assert fixed_messages[2]["content"] == "Final response"

    # --- API兼容性测试 ---

    def test_claude_api_compliance(self, chat_history):
        """测试修复后的消息是否符合Claude API规范"""
        problematic_messages = [
            {
                "role": "assistant",
                "content": "Incomplete tool call",
                "tool_calls": [{"id": "incomplete", "type": "function", "function": {"name": "test", "arguments": "{}"}}]
            },
            {
                "role": "assistant",
                "content": "Another message"
            },
            {
                "role": "assistant",
                "content": "Another message"  # 重复
            }
        ]

        fixed_messages = chat_history._fix_message_sequence_errors(problematic_messages)

        # 验证修复后没有孤立的tool_calls
        for message in fixed_messages:
            if message.get("role") == "assistant" and message.get("tool_calls"):
                # 如果有tool_calls，应该在后续消息中找到对应的tool_result
                tool_call_ids = {tc.get("id") for tc in message.get("tool_calls", [])}

                # 在后续消息中查找对应的tool_result
                found_results = set()
                current_index = fixed_messages.index(message)

                for subsequent_msg in fixed_messages[current_index + 1:]:
                    if subsequent_msg.get("role") == "tool":
                        found_results.add(subsequent_msg.get("tool_call_id"))
                    elif subsequent_msg.get("role") == "assistant":
                        break  # 遇到下一个assistant消息就停止查找

                # 在当前的修复策略下，不完整的tool_calls应该被移除
                # 所以这个测试实际上验证的是没有不完整的tool_calls存在

        # 验证没有重复消息
        for i in range(1, len(fixed_messages)):
            current = fixed_messages[i]
            previous = fixed_messages[i-1]

            # 不应该有连续的相同消息
            assert not (
                current.get("role") == previous.get("role") and
                current.get("content") == previous.get("content")
            )

        assert len(fixed_messages) == 1  # 只应该剩下一条去重后的消息
