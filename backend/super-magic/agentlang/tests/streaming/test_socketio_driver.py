# agentlang/tests/streaming/test_socketio_driver.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from agentlang.streaming.models import ChunkData, ChunkDelta, StreamingResult
from agentlang.streaming.drivers.socketio.config import SocketIODriverConfig
from agentlang.streaming.message_builder import MessageBuilderInterface


# 模拟 SocketIODriver（避免导入 socketio 依赖）
@pytest.fixture
def mock_socketio_driver():
    """创建模拟的 SocketIODriver"""
    with patch('agentlang.streaming.drivers.socketio.driver.SOCKETIO_AVAILABLE', True):
        from agentlang.streaming.drivers.socketio.driver import SocketIODriver

        # 创建带有默认配置的驱动
        config = SocketIODriverConfig.create_default()
        driver = SocketIODriver(config)
        driver.sio_client = AsyncMock()
        driver.sio_client.connected = True
        return driver


class TestMessageBuilder(MessageBuilderInterface):
    """测试用的消息构建器"""

    async def build_message(self, chunk_data: ChunkData) -> dict:
        return {
            "test_request_id": chunk_data.request_id,
            "test_content": chunk_data.content or "empty"
        }


class BrokenMessageBuilder(MessageBuilderInterface):
    """会抛异常的消息构建器"""

    async def build_message(self, chunk_data: ChunkData) -> dict:
        raise Exception("Builder error")


@pytest.mark.asyncio
async def test_socketio_driver_without_message_builder(mock_socketio_driver):
    """测试没有消息构建器时的行为"""
    driver = mock_socketio_driver

    # 确保没有设置消息构建器（通过配置）
    driver.config.message_builder = None
    driver.config.message_builder_class = None

    chunk_data = ChunkData(
        request_id="test-req",
        chunk_id=1,
        content="test content",
        delta=ChunkDelta(),
        timestamp=datetime.now()
    )

    # 调用 _build_message 应该返回 None 并记录警告
    with patch('agentlang.streaming.drivers.socketio.driver.logger') as mock_logger:
        result = await driver._build_message(chunk_data)

        # 应该返回 None
        assert result is None

        # 应该记录警告日志
        mock_logger.warning.assert_called_once_with(
            "No message builder configured for request test-req, skipping push"
        )


@pytest.mark.asyncio
async def test_socketio_driver_with_message_builder(mock_socketio_driver):
    """测试有消息构建器时的行为"""
    driver = mock_socketio_driver

    # 设置消息构建器（通过配置）
    driver.config.message_builder = TestMessageBuilder()

    chunk_data = ChunkData(
        request_id="test-req",
        chunk_id=1,
        content="test content",
        delta=ChunkDelta(),
        timestamp=datetime.now()
    )

    # 调用 _build_message 应该返回构建的消息
    result = await driver._build_message(chunk_data)

    # 应该返回构建的消息
    assert result is not None
    assert result["test_request_id"] == "test-req"
    assert result["test_content"] == "test content"


@pytest.mark.asyncio
async def test_socketio_driver_message_builder_exception(mock_socketio_driver):
    """测试消息构建器抛异常时的行为"""
    driver = mock_socketio_driver

    # 创建会抛异常的消息构建器
    driver.config.message_builder = BrokenMessageBuilder()

    chunk_data = ChunkData(
        request_id="test-req",
        chunk_id=1,
        content="test content",
        delta=ChunkDelta(),
        timestamp=datetime.now()
    )

    # 调用 _build_message 应该返回 None 并记录警告
    with patch('agentlang.streaming.drivers.socketio.driver.logger') as mock_logger:
        result = await driver._build_message(chunk_data)

        # 应该返回 None
        assert result is None

        # 应该记录警告日志
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args[0][0]
        assert "Message builder failed for request test-req" in call_args
        assert "skipping push" in call_args


@pytest.mark.asyncio
async def test_socketio_driver_async_push_no_message_builder(mock_socketio_driver):
    """测试异步推送时没有消息构建器的行为"""
    driver = mock_socketio_driver
    driver.config.message_builder = None
    driver.config.message_builder_class = None

    chunk_data = ChunkData(
        request_id="test-req",
        chunk_id=1,
        content="test content",
        delta=ChunkDelta(),
        timestamp=datetime.now()
    )

    # 模拟连接状态
    driver.sio_client.connected = True

    # 调用异步推送
    await driver._async_push(chunk_data)

    # 不应该调用 emit 方法
    driver.sio_client.emit.assert_not_called()


def test_socketio_driver_config_invalid_message_builder():
    """测试在构造函数中传入无效消息构建器"""
    with patch('agentlang.streaming.drivers.socketio.driver.SOCKETIO_AVAILABLE', True):
        from agentlang.streaming.drivers.socketio.driver import SocketIODriver

        # 创建包含无效消息构建器的配置
        config = SocketIODriverConfig.create_default()
        config.enabled = True
        config.message_builder = "invalid_builder"  # 字符串而不是 MessageBuilderInterface

        # 创建驱动
        driver = SocketIODriver(config)

        # 消息构建器应该是 None（因为无效的构建器被忽略）
        assert driver.config.get_message_builder() is None
