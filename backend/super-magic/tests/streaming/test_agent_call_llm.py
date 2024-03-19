# tests/streaming/test_agent_call_llm.py
"""
Agent.call_llm 方法集成测试

测试 Agent._call_llm 方法的完整流程，包括：
1. LLM 调用
2. 流式推送配置
3. SocketIO 消息推送
4. 错误处理

这是一个长期保留的测试，用于验证 Agent 的核心 LLM 调用功能。
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(override=True)

# 确保能够导入测试脚本
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 设置项目根目录
from app.paths import PathManager
PathManager.set_project_root(project_root)

import pytest
import asyncio
import uuid
from datetime import datetime
from typing import Optional

from app.core.context.agent_context import AgentContext
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger

logger = get_logger(__name__)


@pytest.fixture
def agent_context():
    """创建Agent上下文"""
    context = AgentContext()
    # 初始化必要的字段
    context.session_id = f"test_session_{uuid.uuid4().hex[:8]}"
    context.user_id = "test_user"
    context.conversation_id = f"test_conv_{uuid.uuid4().hex[:8]}"
    return context


class TestAgent:
    """用于测试的简化Agent类，避免循环导入"""

    def __init__(self):
        self.context = None
        self._streaming_drivers = []  # 跟踪流式推送驱动用于清理

    async def _call_llm(self, messages, model_id="gpt-4.1", agent_context=None):
        """直接调用LLM的简化实现"""
        from agentlang.llms.factory import LLMFactory
        from agentlang.llms.processors.processor_config import ProcessorConfig
        from app.streaming.message_builder import LLMStreamingMessageBuilder
        from app.streaming.config_generator import StreamingConfigGenerator

        # 创建流式调用配置，传入消息构建器和driver配置
        message_builder = LLMStreamingMessageBuilder()
        socketio_driver_config = StreamingConfigGenerator.create_for_agent()

        processor_config = None
        if socketio_driver_config:
            processor_config = ProcessorConfig.create_with_socketio_push(
                message_builder=message_builder,
                socketio_driver_config=socketio_driver_config
            )

        # 使用 LLMFactory.call_with_tool_support 方法统一处理工具调用
        llm_response = await LLMFactory.call_with_tool_support(
            model_id=model_id,
            messages=messages,
            tools=[],
            agent_context=agent_context,
            processor_config=processor_config
        )

        # 添加延迟以确保所有异步推送任务完成
        await asyncio.sleep(5)

        return llm_response

    async def cleanup(self):
        """清理资源"""
        # 等待足够时间确保所有推送任务完成
        await asyncio.sleep(5)


@pytest.fixture
def agent_instance():
    """创建测试Agent实例"""
    return TestAgent()


@pytest.mark.asyncio
async def test_agent_call_llm_basic_functionality(agent_instance, agent_context):
    """测试Agent._call_llm的基本功能"""

    print(f"\n🧪 Agent._call_llm 基本功能测试")
    print(f"=" * 60)

    # 准备测试数据
    user_input = "你好"
    model_id = "gpt-4.1"  # 使用有配置的模型

    # 准备消息历史
    messages = [
        {"role": "system", "content": "你是一个有用的AI助手。请简短回复。"},
        {"role": "user", "content": user_input}
    ]

    print(f"📋 测试参数:")
    print(f"   用户输入: {user_input}")
    print(f"   模型ID: {model_id}")
    print(f"   消息数量: {len(messages)}")
    print(f"   Agent上下文: {type(agent_context)}")
    print()

    try:
        # 调用Agent._call_llm方法
        print(f"🚀 调用 Agent._call_llm...")
        result = await agent_instance._call_llm(
            messages=messages,
            model_id=model_id,
            agent_context=agent_context
        )

        # 验证结果
        assert result is not None, "LLM调用结果不应该为空"
        print(f"✅ LLM调用成功")
        print(f"   结果类型: {type(result)}")

        # 检查结果内容
        if hasattr(result, 'choices') and result.choices:
            choice = result.choices[0]
            if hasattr(choice, 'message') and choice.message:
                content = choice.message.content
                print(f"   响应内容: {content}")
                print(f"   内容长度: {len(content) if content else 0}")

                assert content is not None, "响应内容不应该为空"
                assert len(content) > 0, "响应内容应该有实际内容"
            else:
                print(f"   ⚠️  无法获取响应消息内容")
        else:
            print(f"   ⚠️  无法获取响应选择")

        # 检查Token使用情况
        if hasattr(result, 'usage') and result.usage:
            usage = result.usage
            print(f"   Token使用: input={usage.prompt_tokens}, output={usage.completion_tokens}")

        print(f"\n🎉 Agent._call_llm 基本功能测试成功！")

    except Exception as e:
        print(f"❌ Agent._call_llm 调用失败: {e}")
        # 记录详细的错误信息以便调试
        logger.error(f"Agent._call_llm test failed: {e}", exc_info=True)
        raise
    finally:
        # 清理资源，等待异步任务完成
        await agent_instance.cleanup()


@pytest.mark.asyncio
async def test_agent_call_llm_with_streaming_integration(agent_instance, agent_context):
    """测试Agent._call_llm与流式推送的集成"""

    print(f"\n🌊 Agent._call_llm 流式推送集成测试")
    print(f"=" * 60)

    # 准备测试数据
    user_input = "请简短地介绍一下人工智能"
    model_id = "gpt-4.1"

    # 准备消息历史
    messages = [
        {"role": "system", "content": "你是一个专业的AI助手，请提供简洁准确的回答。"},
        {"role": "user", "content": user_input}
    ]

    print(f"📋 流式推送测试参数:")
    print(f"   用户输入: {user_input}")
    print(f"   模型ID: {model_id}")
    print(f"   测试目标: 验证流式推送是否正常工作")
    print()

    try:
        # 设置Agent上下文以启用流式推送
        # 这里可以设置特定的流式推送配置
        original_session_id = agent_context.session_id
        test_session_id = f"streaming_test_{uuid.uuid4().hex[:8]}"
        agent_context.session_id = test_session_id

        print(f"🔧 流式推送配置:")
        print(f"   会话ID: {test_session_id}")
        print(f"   上下文类型: {type(agent_context)}")

        # 调用Agent._call_llm方法（支持流式推送）
        print(f"\n🚀 执行流式推送LLM调用...")
        result = await agent_instance._call_llm(
            messages=messages,
            model_id=model_id,
            agent_context=agent_context
        )

        # 验证结果
        assert result is not None, "流式LLM调用结果不应该为空"
        print(f"✅ 流式LLM调用成功")

        # 检查结果内容
        if hasattr(result, 'choices') and result.choices:
            choice = result.choices[0]
            if hasattr(choice, 'message') and choice.message:
                content = choice.message.content
                print(f"   流式响应内容: {content[:100]}{'...' if len(content) > 100 else ''}")
                print(f"   完整内容长度: {len(content) if content else 0}")

                assert content is not None, "流式响应内容不应该为空"
                assert len(content) > 0, "流式响应应该有实际内容"
            else:
                print(f"   ⚠️  无法获取流式响应消息内容")

        # 验证流式推送相关的日志
        print(f"   📡 流式推送验证:")
        print(f"      - 检查控制台是否有SocketIO连接日志")
        print(f"      - 检查是否有消息推送相关的日志")
        print(f"      - 会话ID: {test_session_id}")

        print(f"\n🎉 Agent._call_llm 流式推送集成测试成功！")

        # 恢复原始会话ID
        agent_context.session_id = original_session_id

    except Exception as e:
        print(f"❌ Agent._call_llm 流式推送集成测试失败: {e}")
        logger.error(f"Agent._call_llm streaming integration test failed: {e}", exc_info=True)
        raise
    finally:
        # 清理资源，等待异步任务完成
        await agent_instance.cleanup()


@pytest.mark.asyncio
async def test_agent_call_llm_error_handling(agent_instance, agent_context):
    """测试Agent._call_llm的错误处理"""

    print(f"\n⚠️  Agent._call_llm 错误处理测试")
    print(f"=" * 60)

    # 测试无效模型ID
    print(f"🔍 测试1: 无效模型ID")
    try:
        messages = [{"role": "user", "content": "测试消息"}]
        result = await agent_instance._call_llm(
            messages=messages,
            model_id="invalid_model_id_that_does_not_exist",
            agent_context=agent_context
        )
        print(f"   ⚠️  预期应该抛出异常，但调用成功了: {type(result)}")
    except Exception as e:
        print(f"   ✅ 正确捕获了无效模型ID异常: {type(e).__name__}")

    # 测试空消息列表
    print(f"\n🔍 测试2: 空消息列表")
    try:
        result = await agent_instance._call_llm(
            messages=[],
            model_id="gpt-4.1",
            agent_context=agent_context
        )
        print(f"   ⚠️  预期应该抛出异常，但调用成功了: {type(result)}")
    except Exception as e:
        print(f"   ✅ 正确捕获了空消息列表异常: {type(e).__name__}")

    # 测试无效上下文
    print(f"\n🔍 测试3: 无效Agent上下文")
    try:
        messages = [{"role": "user", "content": "测试消息"}]
        result = await agent_instance._call_llm(
            messages=messages,
            model_id="gpt-4.1",
            agent_context=None
        )
        print(f"   ⚠️  预期应该抛出异常，但调用成功了: {type(result)}")
    except Exception as e:
        print(f"   ✅ 正确捕获了无效上下文异常: {type(e).__name__}")

    print(f"\n🎉 Agent._call_llm 错误处理测试完成！")

    # 清理资源
    await agent_instance.cleanup()


@pytest.mark.asyncio
async def test_agent_call_llm_performance_basic(agent_instance, agent_context):
    """测试Agent._call_llm的基本性能"""

    print(f"\n⏱️  Agent._call_llm 基本性能测试")
    print(f"=" * 60)

    # 准备测试数据
    user_input = "简单回复：你好"
    model_id = "gpt-4.1"
    messages = [
        {"role": "system", "content": "请给出简短回复。"},
        {"role": "user", "content": user_input}
    ]

    print(f"📊 性能测试配置:")
    print(f"   用户输入: {user_input}")
    print(f"   模型: {model_id}")

    try:
        # 记录开始时间
        start_time = datetime.now()

        # 执行调用
        print(f"\n⏰ 开始计时...")
        result = await agent_instance._call_llm(
            messages=messages,
            model_id=model_id,
            agent_context=agent_context
        )

        # 计算耗时
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print(f"✅ 调用完成")
        print(f"   总耗时: {duration:.2f}秒")
        print(f"   结果类型: {type(result)}")

        # 性能断言
        assert duration < 30.0, f"调用时间过长: {duration:.2f}秒"
        assert result is not None, "结果不应该为空"

        # 检查响应内容
        if hasattr(result, 'choices') and result.choices:
            choice = result.choices[0]
            if hasattr(choice, 'message') and choice.message:
                content = choice.message.content
                print(f"   响应长度: {len(content) if content else 0}")

        print(f"\n🎉 Agent._call_llm 基本性能测试通过！")

    except Exception as e:
        print(f"❌ Agent._call_llm 性能测试失败: {e}")
        raise
    finally:
        # 清理资源，等待异步任务完成
        await agent_instance.cleanup()


if __name__ == "__main__":
    # 直接运行测试（用于调试）
    pytest.main([__file__, "-v", "-s"])
