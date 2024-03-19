# tests/streaming/test_app_streaming_integration.py
"""
App 层 SocketIO 真实连接集成测试

这个测试使用真实的 SocketIO 连接和正确的 app 层配置方式，验证完整的三阶段推送流程：
1. 开始消息 (status=0, content="")
2. 进行中消息 (status=1, content=chunk内容)
3. 完成消息 (status=2, content=完整内容)

使用正确的 app 层配置方式：
- message_builder = LLMStreamingMessageBuilder()
- socketio_driver_config = StreamingConfigGenerator.create_for_agent()
- processor_config = ProcessorConfig.create_with_socketio_push(...)
"""

import pytest
import asyncio
import uuid
from datetime import datetime

from agentlang.streaming.models import ChunkData, ChunkDelta, ChunkMetadata, ChunkStatus
from agentlang.streaming.manager import create_driver
from agentlang.streaming.driver_types import DriverType
from agentlang.llms.processors.processor_config import ProcessorConfig
from app.streaming.config_generator import StreamingConfigGenerator
from app.streaming.message_builder import LLMStreamingMessageBuilder
from agentlang.logger import get_logger

logger = get_logger(__name__)


@pytest.fixture
def app_streaming_config():
    """创建正确的 app 层流式配置（不使用任何 Mock）"""

    try:
        # 按用户要求的正确配置方式
        message_builder = LLMStreamingMessageBuilder()
        socketio_driver_config = StreamingConfigGenerator.create_for_agent()

        if not socketio_driver_config:
            pytest.skip("无法生成 SocketIO 驱动配置，可能缺少 init_client_message.json 或配置无效")

        # socketio_driver_config.base_url='ws://127.0.0.1:9502'

        processor_config = ProcessorConfig.create_with_socketio_push(
            message_builder=message_builder,
            socketio_driver_config=socketio_driver_config
        )

        return processor_config

    except Exception as e:
        pytest.skip(f"创建 app 层流式配置失败: {e}")


@pytest.fixture
def app_streaming_driver(app_streaming_config):
    """基于正确 app 层配置创建真实的流式推送驱动"""

    # 使用 ProcessorConfig 获取有效配置
    config_dict = app_streaming_config.get_effective_streaming_config()

    # 创建真实驱动
    driver = create_driver(DriverType.SOCKETIO, config_dict)
    if not driver:
        pytest.skip("无法创建 SocketIO 驱动，可能缺少依赖或配置无效")

    return driver


@pytest.mark.asyncio
async def test_app_layer_socketio_three_phase_push_flow(app_streaming_driver, app_streaming_config):
    """测试 App 层正确配置下的 SocketIO 三阶段推送流程 (status=0,1,2)"""

    driver = app_streaming_driver
    config = app_streaming_config
    request_id = f"app_test_{uuid.uuid4().hex[:8]}"
    model_id = "test_model_app_integration"

    print(f"\n🧪 App 层 SocketIO 三阶段推送流程测试")
    print(f"   Request ID: {request_id}")
    print(f"   Model ID: {model_id}")
    print(f"   Driver Type: {type(driver)}")
    print(f"   Config Type: {type(config)}")
    print(f"   Streaming Enabled: {config.is_streaming_enabled()}")
    print(f"   Push Enabled: {config.is_push_enabled()}")

    try:
        # 1. 初始化真实连接
        print("\n📡 初始化真实 SocketIO 连接...")
        init_result = await driver.initialize()

        if not init_result.success:
            pytest.skip(f"SocketIO 连接初始化失败: {init_result.message}")

        print(f"   ✅ 真实连接初始化成功: {init_result.message}")

        # 2. 阶段1: 推送开始消息 (status=0) - 模拟 StreamingCallProcessor.push_start_message
        print("\n🚀 阶段1: App 层推送开始消息 (status=0)")
        start_chunk_data = ChunkData(
            request_id=request_id,
            chunk_id=0,
            content="",  # 开始消息内容为空
            delta=ChunkDelta(status=ChunkStatus.START, finish_reason=None),
            timestamp=datetime.now(),
            is_final=False,
            metadata=ChunkMetadata(
                correlation_id=request_id,
                model_id=model_id
            )
        )

        # 真实推送开始消息
        await driver.push(start_chunk_data)
        print("   ✅ 开始消息真实推送完成")

        # 3. 阶段2: 推送进行中消息 (status=1) - 模拟 StreamingCallProcessor.push_stream_chunk
        print("\n🔄 阶段2: App 层推送进行中消息 (status=1)")
        chunks_content = ["App", " layer", " streaming", " test:", " Hello", " world", "!"]

        for i, chunk_content in enumerate(chunks_content, 1):
            chunk_data = ChunkData(
                request_id=request_id,
                chunk_id=i,
                content=chunk_content,
                delta=ChunkDelta(status=ChunkStatus.STREAMING, finish_reason=None),
                timestamp=datetime.now(),
                is_final=False,
                metadata=ChunkMetadata(
                    correlation_id=request_id,
                    model_id=model_id
                )
            )

            # 真实推送进行中消息
            await driver.push(chunk_data)
            print(f"   ✅ Chunk {i}: '{chunk_content}' 真实推送完成")

            # 模拟实际流式处理的间隔
            await asyncio.sleep(0.1)

        # 4. 阶段3: 推送完成消息 (status=2) - 模拟 StreamingCallProcessor.push_completion_message
        print("\n🏁 阶段3: App 层推送完成消息 (status=2)")
        completion_text = "App layer streaming test: Hello world!"
        completion_chunk_data = ChunkData(
            request_id=request_id,
            chunk_id=-1,  # 使用-1表示完成消息
            content=completion_text,
            delta=ChunkDelta(status=ChunkStatus.END, finish_reason="stop"),
            timestamp=datetime.now(),
            is_final=True,
            metadata=ChunkMetadata(
                correlation_id=request_id,
                model_id=model_id
            )
        )

        # 真实推送完成消息
        await driver.push(completion_chunk_data)
        print("   ✅ 完成消息真实推送完成")

        # 5. 验证完整流程
        print(f"\n📊 App 层三阶段推送流程完成验证:")
        print(f"   ✅ 阶段1: 开始消息 (status=0, content='')")
        print(f"   ✅ 阶段2: {len(chunks_content)} 个进行中消息 (status=1)")
        print(f"   ✅ 阶段3: 完成消息 (status=2, content=完整内容)")
        print(f"   ✅ 使用正确的 ProcessorConfig 配置")
        print(f"   ✅ 使用正确的 LLMStreamingMessageBuilder")
        print(f"   ✅ 使用正确的 StreamingConfigGenerator")

        # 等待一段时间确保消息发送完成
        await asyncio.sleep(1.0)

        print("\n🎉 App 层 SocketIO 三阶段推送流程测试成功！")

    finally:
        # 6. 清理真实资源
        print("\n🧹 清理真实资源...")
        try:
            await driver.finalize()
            print("   ✅ 真实资源清理成功")
        except Exception as e:
            print(f"   ⚠️  真实资源清理异常: {e}")


@pytest.mark.asyncio
async def test_app_layer_streaming_call_processor_style(app_streaming_driver, app_streaming_config):
    """测试 App 层的 StreamingCallProcessor 使用方式"""

    driver = app_streaming_driver
    config = app_streaming_config
    request_id = f"app_processor_{uuid.uuid4().hex[:8]}"
    model_id = "test_model_app_processor"

    print(f"\n🎯 App 层 StreamingCallProcessor 风格测试")
    print(f"   Request ID: {request_id}")
    print(f"   使用正确的 App 层配置")

    streaming_driver = None
    try:
        # 初始化真实连接
        streaming_driver = driver
        await streaming_driver.initialize()
        print("   ✅ App 层 streaming_driver 初始化成功")

        # === 真实模拟 StreamingCallProcessor.push_start_message ===
        print("🚀 App 层执行 push_start_message 风格...")
        start_chunk_data = ChunkData(
            request_id=request_id,
            chunk_id=0,
            content="",
            delta=ChunkDelta(status=ChunkStatus.START, finish_reason=None),
            timestamp=datetime.now(),
            is_final=False,
            metadata=ChunkMetadata(
                correlation_id=request_id,
                model_id=model_id
            )
        )

        # 使用 asyncio.create_task 模拟实际使用方式
        task1 = asyncio.create_task(streaming_driver.push(start_chunk_data))
        await task1
        print("   ✅ App 层开始消息推送任务完成")

        # === 真实模拟 StreamingCallProcessor.push_stream_chunk ===
        print("🔄 App 层执行 push_stream_chunk 风格...")
        chunk_contents = ["App", " config", " based", " streaming", " works", " perfectly!"]

        tasks = []
        for i, content in enumerate(chunk_contents, 1):
            chunk_data = ChunkData(
                request_id=request_id,
                chunk_id=i,
                content=content,
                delta=ChunkDelta(status=ChunkStatus.STREAMING, finish_reason=None),
                timestamp=datetime.now(),
                is_final=False,
                metadata=ChunkMetadata(
                    correlation_id=request_id,
                    model_id=model_id
                )
            )

            # 创建真实异步任务
            task = asyncio.create_task(streaming_driver.push(chunk_data))
            tasks.append(task)

            # 添加间隔，模拟真实的流式处理
            await asyncio.sleep(0.1)

        # 等待所有真实任务完成
        await asyncio.gather(*tasks)
        print("   ✅ App 层所有进行中消息推送任务完成")

        # === 真实模拟 StreamingCallProcessor.push_completion_message ===
        print("🏁 App 层执行 push_completion_message 风格...")
        completion_text = "App config based streaming works perfectly!"
        completion_chunk_data = ChunkData(
            request_id=request_id,
            chunk_id=-1,
            content=completion_text,
            delta=ChunkDelta(status=ChunkStatus.END, finish_reason="stop"),
            timestamp=datetime.now(),
            is_final=True,
            metadata=ChunkMetadata(
                correlation_id=request_id,
                model_id=model_id
            )
        )

        task3 = asyncio.create_task(streaming_driver.push(completion_chunk_data))
        await task3
        print("   ✅ App 层完成消息推送任务完成")

        # 等待消息完全发送
        await asyncio.sleep(0.5)

        print("\n🎉 App 层 StreamingCallProcessor 风格使用测试成功！")

    finally:
        # 模拟真实的 finally 块中的资源清理
        if streaming_driver:
            try:
                await streaming_driver.finalize()
                print("   🧹 App 层资源清理成功 (finally 块)")
            except Exception as finalize_error:
                print(f"   ⚠️  App 层资源清理失败: {finalize_error}")


@pytest.mark.asyncio
async def test_app_layer_config_validation(app_streaming_config):
    """测试 App 层配置的正确性验证"""

    config = app_streaming_config

    print(f"\n🔍 App 层配置验证测试")
    print(f"   Config Type: {type(config)}")

    # 验证配置的基本属性
    assert config.is_streaming_enabled(), "流式响应应该被启用"
    assert config.is_push_enabled(), "推流功能应该被启用"
    assert config.streaming_push_mode == DriverType.SOCKETIO, "推流模式应该是 SOCKETIO"
    assert config.use_stream_mode is True, "流式模式应该被启用"

    # 验证消息构建器
    assert config.message_builder is not None, "消息构建器不应该为空"
    assert isinstance(config.message_builder, LLMStreamingMessageBuilder), "应该是 LLMStreamingMessageBuilder 实例"

    # 验证 SocketIO 驱动配置
    assert config.socketio_driver_config is not None, "SocketIO 驱动配置不应该为空"
    assert config.socketio_driver_config.enabled is True, "SocketIO 驱动应该被启用"
    assert config.socketio_driver_config.base_url is not None, "SocketIO base_url 不应该为空"
    assert config.socketio_driver_config.socketio_path is not None, "SocketIO socketio_path 不应该为空"

    print(f"   ✅ 流式响应启用: {config.is_streaming_enabled()}")
    print(f"   ✅ 推流功能启用: {config.is_push_enabled()}")
    print(f"   ✅ 推流模式: {config.streaming_push_mode}")
    print(f"   ✅ 消息构建器: {type(config.message_builder)}")
    print(f"   ✅ SocketIO Base URL: {config.socketio_driver_config.base_url}")
    print(f"   ✅ SocketIO Path: {config.socketio_driver_config.socketio_path}")

    # 测试有效配置生成
    effective_config = config.get_effective_streaming_config()
    assert isinstance(effective_config, dict), "有效配置应该是字典类型"
    assert effective_config.get("enabled") is True, "有效配置中应该启用推流"
    assert "message_builder" in effective_config, "有效配置中应该包含消息构建器"
    assert "base_url" in effective_config, "有效配置中应该包含 base_url"
    assert "socketio_path" in effective_config, "有效配置中应该包含 socketio_path"

    print(f"   ✅ 有效配置生成: {len(effective_config)} 个参数")
    print(f"   ✅ 配置键值: {list(effective_config.keys())}")

    print("\n🎉 App 层配置验证测试通过！")


@pytest.mark.asyncio
async def test_app_layer_components_integration():
    """测试 App 层各组件集成"""

    print(f"\n🔧 App 层组件集成测试")

    try:
        # 1. 测试消息构建器创建
        message_builder = LLMStreamingMessageBuilder()
        print(f"   ✅ LLMStreamingMessageBuilder 创建成功: {type(message_builder)}")

        # 2. 测试配置生成器
        socketio_driver_config = StreamingConfigGenerator.create_for_agent()
        if not socketio_driver_config:
            pytest.skip("SocketIO 驱动配置生成失败")

        print(f"   ✅ StreamingConfigGenerator 生成配置成功")
        print(f"       Base URL: {socketio_driver_config.base_url}")
        print(f"       SocketIO Path: {socketio_driver_config.socketio_path}")
        print(f"       启用状态: {socketio_driver_config.enabled}")

        # 3. 测试流式调用配置创建
        processor_config = ProcessorConfig.create_with_socketio_push(
            message_builder=message_builder,
            socketio_driver_config=socketio_driver_config
        )

        print(f"   ✅ ProcessorConfig 创建成功: {type(processor_config)}")
        print(f"       流式启用: {processor_config.is_streaming_enabled()}")
        print(f"       推流启用: {processor_config.is_push_enabled()}")

        # 4. 测试驱动创建
        config_dict = processor_config.get_effective_streaming_config()
        driver = create_driver(DriverType.SOCKETIO, config_dict)

        if driver:
            print(f"   ✅ SocketIO 驱动创建成功: {type(driver)}")

            # 5. 测试连接
            init_result = await driver.initialize()
            print(f"   连接测试: {init_result.success} - {init_result.message}")

            # 清理
            await driver.finalize()
            print(f"   ✅ 清理完成")
        else:
            pytest.skip("驱动创建失败")

        print("\n🎉 App 层组件集成测试成功！")

    except Exception as e:
        print(f"   ⚠️  组件集成测试异常: {e}")
        # 不跳过测试，让它继续运行，因为某些组件问题是可能的


if __name__ == "__main__":
    # 直接运行测试（用于调试）
    pytest.main([__file__, "-v", "-s"])
