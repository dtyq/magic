"""
测试 LLMFactory.call_with_tool_support 方法
包括流式和非流式调用模式的全面测试
"""

import os
import pytest
from typing import Dict, Any, List, Optional

# 环境变量已通过 conftest.py 自动加载

from openai.types.chat import ChatCompletion
from openai.types.chat.chat_completion_message_tool_call import ChatCompletionMessageToolCall

from agentlang.llms.factory import LLMFactory, LLMClientConfig
from agentlang.llms.processors import ProcessorConfig
from agentlang.interface.context import AgentContextInterface


class MockAgentContext:
    """Mock Agent Context for testing"""

    def __init__(self, user_id: str = "test_user", dynamic_model_id: Optional[str] = None):
        self._user_id = user_id
        self._dynamic_model_id = dynamic_model_id

    def get_user_id(self) -> str:
        return self._user_id

    def has_dynamic_model_id(self) -> bool:
        return self._dynamic_model_id is not None

    def get_dynamic_model_id(self) -> Optional[str]:
        return self._dynamic_model_id


# 全局测试配置和fixture

@pytest.fixture(scope="session")
def test_config():
    """测试配置fixture - 会话级别"""
    # 检查Magic API环境变量
    magic_api_key = os.getenv("MAGIC_API_KEY")
    magic_api_base_url = os.getenv("MAGIC_API_BASE_URL", "https://api.openai.com/v1")

    if not magic_api_key:
        pytest.skip(
            "MAGIC_API_KEY 环境变量未设置。请设置以下环境变量：\n"
            "- MAGIC_API_KEY: Magic API密钥\n"
            "- MAGIC_API_BASE_URL: Magic API基础URL（可选）"
        )

    # 通过 LLMClientConfig 直接配置Magic模型
    max_config = LLMClientConfig(
        model_id="max",
        api_key=magic_api_key,
        api_base_url=magic_api_base_url,
        name=os.getenv("MAGIC_MAX_MODEL", "max"),
        provider="openai",
        temperature=0.7,
        max_output_tokens=64000,
        max_context_tokens=128000,
        supports_tool_use=True,
        type="llm"
    )

    auto_config = LLMClientConfig(
        model_id="auto",
        api_key=magic_api_key,
        api_base_url=magic_api_base_url,
        name=os.getenv("MAGIC_AUTO_MODEL", "gpt-4o-mini"),
        provider="openai",
        temperature=0.7,
        max_output_tokens=16000,
        max_context_tokens=128000,
        supports_tool_use=True,
        type="llm"
    )

    # 将配置注册到 LLMFactory
    LLMFactory._configs["max"] = max_config
    LLMFactory._configs["auto"] = auto_config

    # 定义可测试的Magic模型
    available_models = [
        ("max", "Magic Max Model"),
        ("auto", "Magic Auto Model")
    ]

    # 使用第一个模型进行测试（max）
    test_model_id, test_model_name = available_models[0]

    print(f"\n使用模型进行测试: {test_model_name} ({test_model_id})")
    print(f"Magic API Base URL: {magic_api_base_url}")
    print(f"可用的测试模型: {', '.join([f'{name} ({model_id})' for model_id, name in available_models])}")
    print(f"Max模型配置: {max_config.name} @ {max_config.api_base_url}")
    print(f"Auto模型配置: {auto_config.name} @ {auto_config.api_base_url}")

    # 准备测试数据
    simple_messages = [
        {"role": "user", "content": "请简单回答：你好，请说'测试成功'"}
    ]

    multi_turn_messages = [
        {"role": "user", "content": "我想了解天气情况"},
        {"role": "assistant", "content": "我可以帮您获取天气信息。请告诉我您想了解哪个城市的天气？"},
        {"role": "user", "content": "北京的天气如何？"}
    ]

    tool_call_messages = [
        {"role": "user", "content": "请帮我查询当前时间"}
    ]

    test_tools = [
        {
            "type": "function",
            "function": {
                "name": "get_current_time",
                "description": "获取当前时间",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "时区，如 'Asia/Shanghai'",
                            "default": "Asia/Shanghai"
                        }
                    }
                }
            }
        }
    ]

    return {
        "test_model_id": test_model_id,
        "test_model_name": test_model_name,
        "all_test_models": available_models,
        "simple_messages": simple_messages,
        "multi_turn_messages": multi_turn_messages,
        "tool_call_messages": tool_call_messages,
        "test_tools": test_tools,
        "magic_api_base_url": magic_api_base_url
    }

@pytest.fixture(autouse=True)
def setup_and_teardown():
    """每个测试前后的设置和清理"""
    # 测试前：只清理客户端缓存，保留配置
    LLMFactory._clients.clear()

    yield  # 执行测试

    # 测试后：只清理客户端缓存，保留配置
    LLMFactory._clients.clear()


class TestCallWithToolSupport:
    """测试 LLMFactory.call_with_tool_support 方法 - 流式和非流式调用模式"""

    async def _call_llm_with_cleanup_wait(self, *args, **kwargs):
        """调用LLM并在异常时等待异步清理完成"""
        try:
            return await LLMFactory.call_with_tool_support(*args, **kwargs)
        except Exception as e:
            # 等待一下确保所有异步日志写入操作完成
            import asyncio
            await asyncio.sleep(0.1)
            # 重新抛出异常以保持测试行为
            raise

    @pytest.mark.asyncio
    async def test_non_stream_simple_call(self, test_config):
        """测试非流式模式 - 简单调用"""
        print("\n=== 测试非流式模式 - 简单调用 ===")

        response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_config["simple_messages"],
            processor_config=ProcessorConfig.create_default()  # 明确使用非流式模式
        )

        # 验证响应
        assert isinstance(response, ChatCompletion)
        assert response.choices is not None
        assert len(response.choices) > 0
        assert response.choices[0].message is not None
        assert response.choices[0].message.content is not None

        print(f"响应内容: {response.choices[0].message.content}")
        print(f"结束原因: {response.choices[0].finish_reason}")
        print(f"使用token: {response.usage}")

        # 验证内容包含预期的回复
        assert "测试成功" in response.choices[0].message.content

    @pytest.mark.asyncio
    async def test_non_stream_multi_turn_conversation(self, test_config):
        """测试非流式模式 - 多轮对话"""
        print("\n=== 测试非流式模式 - 多轮对话 ===")

        response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_config["multi_turn_messages"],
            processor_config=ProcessorConfig.create_default()  # 明确使用非流式模式
        )

        # 验证响应
        assert isinstance(response, ChatCompletion)
        assert response.choices is not None
        assert len(response.choices) > 0
        assert response.choices[0].message is not None
        assert response.choices[0].message.content is not None

        print(f"多轮对话响应: {response.choices[0].message.content}")
        print(f"结束原因: {response.choices[0].finish_reason}")
        print(f"使用token: {response.usage}")

        # 验证内容与天气相关
        content_lower = response.choices[0].message.content.lower()
        assert any(keyword in content_lower for keyword in ["北京", "天气", "weather", "beijing"]), \
            f"响应内容应该与天气相关，实际内容: {response.choices[0].message.content}"

    @pytest.mark.asyncio
    async def test_non_stream_with_tools(self, test_config):
        """测试非流式模式 - 工具调用"""
        print("\n=== 测试非流式模式 - 工具调用 ===")

        response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_config["tool_call_messages"],
            tools=test_config["test_tools"],
            processor_config=ProcessorConfig.create_default()  # 明确使用非流式模式
        )

        # 验证响应
        assert isinstance(response, ChatCompletion)
        assert response.choices is not None
        assert len(response.choices) > 0
        assert response.choices[0].message is not None

        print(f"工具调用响应: {response.choices[0].message}")
        print(f"结束原因: {response.choices[0].finish_reason}")
        print(f"使用token: {response.usage}")

        # 检查是否有工具调用
        if response.choices[0].message.tool_calls:
            print("=== 工具调用详情 ===")
            for i, tool_call in enumerate(response.choices[0].message.tool_calls):
                print(f"工具调用 {i+1}:")
                print(f"  ID: {tool_call.id}")
                print(f"  函数名: {tool_call.function.name}")
                print(f"  参数: {tool_call.function.arguments}")

                # 验证工具调用
                assert tool_call.function.name == "get_current_time"
                assert tool_call.function.arguments is not None

            # 验证结束原因应该是 tool_calls
            assert response.choices[0].finish_reason == "tool_calls"
        else:
            # 如果没有工具调用，应该在内容中提到时间相关内容
            assert response.choices[0].message.content is not None
            content_lower = response.choices[0].message.content.lower()
            assert any(keyword in content_lower for keyword in ["时间", "time", "现在", "当前"]), \
                f"响应内容应该与时间相关，实际内容: {response.choices[0].message.content}"

    @pytest.mark.asyncio
    async def test_non_stream_with_agent_context(self, test_config):
        """测试非流式模式 - 带Agent上下文"""
        print("\n=== 测试非流式模式 - 带Agent上下文 ===")

        agent_context = MockAgentContext(user_id="test_user_123")

        response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_config["simple_messages"],
            agent_context=agent_context,
            processor_config=ProcessorConfig.create_default()  # 明确使用非流式模式
        )

        # 验证响应
        assert isinstance(response, ChatCompletion)
        assert response.choices is not None
        assert len(response.choices) > 0
        assert response.choices[0].message is not None
        assert response.choices[0].message.content is not None

        print(f"带上下文响应: {response.choices[0].message.content}")
        print(f"结束原因: {response.choices[0].finish_reason}")
        print(f"使用token: {response.usage}")

    @pytest.mark.asyncio
    async def test_compare_stream_vs_non_stream(self, test_config):
        """对比测试：流式 vs 非流式模式"""
        print("\n=== 对比测试：流式 vs 非流式模式 ===")

        test_messages = [
            {"role": "user", "content": "请说一句话：'流式和非流式测试'"}
        ]

        # 测试非流式模式
        print("--- 非流式模式 ---")
        non_stream_response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_messages,
            processor_config=ProcessorConfig.create_default()
        )

        print(f"非流式响应: {non_stream_response.choices[0].message.content}")
        print(f"非流式token使用: {non_stream_response.usage}")

        # 测试流式模式
        print("--- 流式模式 ---")
        stream_response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_messages,
            processor_config=ProcessorConfig.create_streaming_only()
        )

        print(f"流式响应: {stream_response.choices[0].message.content}")
        print(f"流式token使用: {stream_response.usage}")

        # 验证两种模式都返回了有效响应
        assert isinstance(non_stream_response, ChatCompletion)
        assert isinstance(stream_response, ChatCompletion)

        assert non_stream_response.choices[0].message.content is not None
        assert stream_response.choices[0].message.content is not None

        # 验证都包含预期内容
        assert "流式和非流式测试" in non_stream_response.choices[0].message.content
        assert "流式和非流式测试" in stream_response.choices[0].message.content

        print("=== 对比测试完成 ===")

    @pytest.mark.asyncio
    async def test_stream_mode_with_tools(self, test_config):
        """测试流式模式 - 工具调用"""
        print("\n=== 测试流式模式 - 工具调用 ===")

        response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=test_config["tool_call_messages"],
            tools=test_config["test_tools"],
            processor_config=ProcessorConfig.create_streaming_only()  # 使用流式模式
        )

        # 验证响应
        assert isinstance(response, ChatCompletion)
        assert response.choices is not None
        assert len(response.choices) > 0
        assert response.choices[0].message is not None

        print(f"流式工具调用响应: {response.choices[0].message}")
        print(f"结束原因: {response.choices[0].finish_reason}")
        print(f"使用token: {response.usage}")

        # 检查是否有工具调用
        if response.choices[0].message.tool_calls:
            print("=== 流式工具调用详情 ===")
            for i, tool_call in enumerate(response.choices[0].message.tool_calls):
                print(f"工具调用 {i+1}:")
                print(f"  ID: {tool_call.id}")
                print(f"  函数名: {tool_call.function.name}")
                print(f"  参数: {tool_call.function.arguments}")

                # 验证工具调用
                assert tool_call.function.name == "get_current_time"
                assert tool_call.function.arguments is not None

            # 验证结束原因应该是 tool_calls
            assert response.choices[0].finish_reason == "tool_calls"

    @pytest.mark.asyncio
    async def test_all_magic_models(self, test_config):
        """测试所有Magic模型（max 和 auto）"""
        print("\n=== 测试所有Magic模型 ===")

        test_messages = [
            {"role": "user", "content": "请简单回答：Hello，请说'Magic模型测试'"}
        ]

        for model_id, model_name in test_config["all_test_models"]:
            print(f"\n--- 测试模型: {model_name} ({model_id}) ---")

            try:
                # 测试非流式调用
                print(f"测试 {model_id} 非流式调用...")
                non_stream_response = await LLMFactory.call_with_tool_support(
                    model_id=model_id,
                    messages=test_messages,
                    processor_config=ProcessorConfig.create_default()
                )

                # 验证非流式响应
                assert isinstance(non_stream_response, ChatCompletion)
                assert non_stream_response.choices is not None
                assert len(non_stream_response.choices) > 0
                assert non_stream_response.choices[0].message.content is not None

                print(f"✓ {model_id} 非流式调用成功")
                print(f"  响应: {non_stream_response.choices[0].message.content}")
                print(f"  Token使用: {non_stream_response.usage}")

                # 测试流式调用
                print(f"测试 {model_id} 流式调用...")
                stream_response = await LLMFactory.call_with_tool_support(
                    model_id=model_id,
                    messages=test_messages,
                    processor_config=ProcessorConfig.create_streaming_only()
                )

                # 验证流式响应
                assert isinstance(stream_response, ChatCompletion)
                assert stream_response.choices is not None
                assert len(stream_response.choices) > 0
                assert stream_response.choices[0].message.content is not None

                print(f"✓ {model_id} 流式调用成功")
                print(f"  响应: {stream_response.choices[0].message.content}")
                print(f"  Token使用: {stream_response.usage}")

                # 验证内容包含预期回复
                assert "Magic模型测试" in non_stream_response.choices[0].message.content
                assert "Magic模型测试" in stream_response.choices[0].message.content

            except Exception as e:
                print(f"✗ {model_id} 测试失败: {e}")
                # 重新抛出异常以让测试失败
                raise

        print("\n=== 所有Magic模型测试完成 ===")

    @pytest.mark.asyncio
    async def test_magic_models_with_tools(self, test_config):
        """测试Magic模型的工具调用功能"""
        print("\n=== 测试Magic模型工具调用 ===")

        tool_messages = [
            {"role": "user", "content": "请使用工具获取当前北京时间"}
        ]

        for model_id, model_name in test_config["all_test_models"]:
            print(f"\n--- 测试 {model_name} ({model_id}) 工具调用 ---")

            try:
                response = await LLMFactory.call_with_tool_support(
                    model_id=model_id,
                    messages=tool_messages,
                    tools=test_config["test_tools"],
                    processor_config=ProcessorConfig.create_streaming_only()  # 使用流式模式测试工具调用
                )

                # 验证响应
                assert isinstance(response, ChatCompletion)
                assert response.choices[0].message is not None

                print(f"✓ {model_id} 工具调用成功")
                print(f"  结束原因: {response.choices[0].finish_reason}")
                print(f"  Token使用: {response.usage}")

                # 检查工具调用或内容响应
                if response.choices[0].message.tool_calls:
                    print("  工具调用详情:")
                    for i, tool_call in enumerate(response.choices[0].message.tool_calls):
                        print(f"    工具 {i+1}: {tool_call.function.name}({tool_call.function.arguments})")
                        # 验证工具调用
                        assert tool_call.function.name == "get_current_time"

                    # 验证结束原因
                    assert response.choices[0].finish_reason == "tool_calls"
                elif response.choices[0].message.content:
                    print(f"  内容响应: {response.choices[0].message.content}")
                    # 验证内容与时间相关
                    content_lower = response.choices[0].message.content.lower()
                    assert any(keyword in content_lower for keyword in ["时间", "time", "北京", "beijing"]), \
                        f"响应内容应该与时间相关，实际内容: {response.choices[0].message.content}"

            except Exception as e:
                print(f"✗ {model_id} 工具调用测试失败: {e}")
                raise

        print("\n=== Magic模型工具调用测试完成 ===")

    @pytest.mark.asyncio
    async def test_multi_turn_tool_conversation(self, test_config):
        """测试完整的多轮工具调用对话流程"""
        print("\n=== 测试多轮工具调用对话流程 ===")

        # 第一轮：用户提问，期待模型返回工具调用
        initial_messages = [
            {"role": "user", "content": "请帮我查询当前北京时间，我需要知道具体时间"}
        ]

        print("--- 第一轮：用户提问，期待工具调用 ---")
        first_response = await self._call_llm_with_cleanup_wait(
            model_id=test_config["test_model_id"],
            messages=initial_messages,
            tools=test_config["test_tools"],
            processor_config=ProcessorConfig.create_default()  # 先测试非流式
        )

        # 验证第一轮响应包含工具调用
        assert isinstance(first_response, ChatCompletion)
        assert first_response.choices[0].message is not None

        print(f"第一轮响应: {first_response.choices[0].message}")
        print(f"结束原因: {first_response.choices[0].finish_reason}")

        # 检查是否有工具调用
        if first_response.choices[0].message.tool_calls:
            print("✓ 模型返回了工具调用")
            tool_call = first_response.choices[0].message.tool_calls[0]
            print(f"工具调用: {tool_call.function.name}({tool_call.function.arguments})")

            # 验证工具调用
            assert tool_call.function.name == "get_current_time"
            assert first_response.choices[0].finish_reason == "tool_calls"

            # 模拟执行工具，返回当前时间
            import json
            from datetime import datetime

            # 解析工具参数
            try:
                tool_args = json.loads(tool_call.function.arguments)
                timezone = tool_args.get("timezone", "Asia/Shanghai")
            except:
                timezone = "Asia/Shanghai"

            # 模拟工具执行结果
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tool_result = f"当前{timezone}时区的时间是: {current_time}"

            print(f"工具执行结果: {tool_result}")

            # 构建第二轮对话消息，包含工具调用结果
            second_messages = initial_messages + [
                # 添加助手的工具调用消息
                {
                    "role": "assistant",
                    "content": first_response.choices[0].message.content,
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        }
                    ]
                },
                # 添加工具执行结果
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                }
            ]

            print("--- 第二轮：发送工具结果，期待最终回复 ---")
            print(f"第二轮消息数量: {len(second_messages)}")

            # 第二轮：发送工具结果，期待模型基于结果给出最终回复
            final_response = await LLMFactory.call_with_tool_support(
                model_id=test_config["test_model_id"],
                messages=second_messages,
                tools=test_config["test_tools"],
                processor_config=ProcessorConfig.create_default()
            )

            # 验证最终响应
            assert isinstance(final_response, ChatCompletion)
            assert final_response.choices[0].message is not None
            assert final_response.choices[0].message.content is not None

            print(f"最终响应: {final_response.choices[0].message.content}")
            print(f"最终结束原因: {final_response.choices[0].finish_reason}")
            print(f"Token使用情况: {final_response.usage}")

            # 验证最终响应包含时间信息
            final_content = final_response.choices[0].message.content.lower()
            assert any(keyword in final_content for keyword in ["时间", "time", current_time.split()[0], current_time.split()[1][:5]]), \
                f"最终回复应该包含时间信息，实际内容: {final_response.choices[0].message.content}"

            # 验证最终响应是正常结束，不是工具调用
            assert final_response.choices[0].finish_reason in ["stop", "length"], \
                f"最终响应应该正常结束，不应该再次调用工具，实际结束原因: {final_response.choices[0].finish_reason}"

            print("✓ 多轮工具调用对话流程测试成功")

        else:
            # 如果模型没有返回工具调用，则验证内容回复
            assert first_response.choices[0].message.content is not None
            content_lower = first_response.choices[0].message.content.lower()
            assert any(keyword in content_lower for keyword in ["时间", "time", "北京", "beijing"]), \
                f"如果没有工具调用，响应内容应该与时间相关，实际内容: {first_response.choices[0].message.content}"
            print("⚠️  模型直接回复了内容而不是调用工具")

        print("=== 多轮工具调用对话流程测试完成 ===")

    @pytest.mark.asyncio
    async def test_multi_turn_tool_conversation_stream(self, test_config):
        """测试流式模式下的完整多轮工具调用对话流程"""
        print("\n=== 测试流式模式多轮工具调用对话 ===")

        # 复用相同的测试逻辑，但使用流式模式
        initial_messages = [
            {"role": "user", "content": "请帮我查询当前上海时间，我想知道现在几点了"}
        ]

        print("--- 流式第一轮：用户提问，期待工具调用 ---")
        first_response = await LLMFactory.call_with_tool_support(
            model_id=test_config["test_model_id"],
            messages=initial_messages,
            tools=test_config["test_tools"],
            processor_config=ProcessorConfig.create_streaming_only()  # 使用流式模式
        )

        # 验证第一轮响应
        assert isinstance(first_response, ChatCompletion)
        assert first_response.choices[0].message is not None

        print(f"流式第一轮响应: {first_response.choices[0].message}")
        print(f"流式结束原因: {first_response.choices[0].finish_reason}")

        if first_response.choices[0].message.tool_calls:
            print("✓ 流式模式下模型返回了工具调用")
            tool_call = first_response.choices[0].message.tool_calls[0]

            # 模拟工具执行
            import json
            from datetime import datetime

            try:
                tool_args = json.loads(tool_call.function.arguments)
                timezone = tool_args.get("timezone", "Asia/Shanghai")
            except:
                timezone = "Asia/Shanghai"

            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tool_result = f"当前{timezone}时区的时间是: {current_time}"

            # 构建第二轮消息
            second_messages = initial_messages + [
                {
                    "role": "assistant",
                    "content": first_response.choices[0].message.content,
                    "tool_calls": [
                        {
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.function.name,
                                "arguments": tool_call.function.arguments
                            }
                        }
                    ]
                },
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                }
            ]

            print("--- 流式第二轮：发送工具结果，期待最终回复 ---")
            final_response = await LLMFactory.call_with_tool_support(
                model_id=test_config["test_model_id"],
                messages=second_messages,
                tools=test_config["test_tools"],
                processor_config=ProcessorConfig.create_streaming_only()  # 继续使用流式模式
            )

            # 验证最终响应
            assert isinstance(final_response, ChatCompletion)
            assert final_response.choices[0].message is not None
            assert final_response.choices[0].message.content is not None

            print(f"流式最终响应: {final_response.choices[0].message.content}")
            print(f"流式最终结束原因: {final_response.choices[0].finish_reason}")

            # 验证包含时间信息
            final_content = final_response.choices[0].message.content.lower()
            assert any(keyword in final_content for keyword in ["时间", "time", "上海", "shanghai", current_time.split()[1][:5]]), \
                f"流式最终回复应该包含时间信息，实际内容: {final_response.choices[0].message.content}"

            print("✓ 流式模式多轮工具调用对话测试成功")
        else:
            print("⚠️  流式模式下模型直接回复了内容而不是调用工具")

        print("=== 流式模式多轮工具调用对话测试完成 ===")
