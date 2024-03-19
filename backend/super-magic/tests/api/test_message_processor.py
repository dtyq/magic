"""
测试 MessageProcessor 动态配置和动态模型处理逻辑

验证MessageProcessor中的_handle_dynamic_config和_handle_dynamic_model_selection方法
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, Optional

from app.api.routes.messages import MessageProcessor
from app.core.entity.message.client_message import ChatClientMessage, ContextType, AgentMode
from agentlang.context.base_agent_context import BaseAgentContext


class MockAgentContext(BaseAgentContext):
    """Mock AgentContext for testing that can pass Pydantic validation"""

    def __init__(self):
        super().__init__()
        self.set_dynamic_model_id = Mock()
        self.set_task_id = Mock()
        self.dispatch_event = AsyncMock()


class TestMessageProcessorDynamicConfig:
    """测试MessageProcessor的动态配置处理逻辑"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.processor = MessageProcessor()

    @pytest.mark.asyncio
    async def test_handle_dynamic_config_none(self):
        """测试处理None的动态配置"""
        # 调用方法，应该正常返回而不执行任何操作
        await self.processor._handle_dynamic_config(None)
        # 没有异常即为成功

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_config_success(self, mock_logger, mock_dynamic_config):
        """测试成功处理动态配置"""
        # 设置mock返回值
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (
            True, "/path/to/config.yaml", []
        )
        mock_dynamic_config.get_model_ids.return_value = ["gpt-4", "claude-3"]

        # 测试数据
        config_data = {
            "models": {
                "gpt-4": {
                    "api_key": "sk-test",
                    "api_base_url": "https://api.openai.com/v1",
                    "name": "gpt-4"
                }
            }
        }

        # 调用方法
        await self.processor._handle_dynamic_config(config_data)

        # 验证调用
        mock_dynamic_config.validate_and_write_dynamic_config.assert_called_once_with(config_data)
        mock_dynamic_config.get_model_ids.assert_called_once()

        # 验证日志
        mock_logger.info.assert_called_with(
            "✅ 已写入动态配置: 2个模型 ['gpt-4', 'claude-3'] -> /path/to/config.yaml"
        )

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_config_success_with_warnings(self, mock_logger, mock_dynamic_config):
        """测试成功处理动态配置但有警告"""
        # 设置mock返回值
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (
            True, "/path/to/config.yaml", ["警告1", "警告2"]
        )
        mock_dynamic_config.get_model_ids.return_value = ["custom-model"]

        # 测试数据
        config_data = {"models": {"custom-model": {"api_key": "test"}}}

        # 调用方法
        await self.processor._handle_dynamic_config(config_data)

        # 验证成功日志
        mock_logger.info.assert_any_call(
            "✅ 已写入动态配置: 1个模型 ['custom-model'] -> /path/to/config.yaml"
        )

        # 验证警告日志
        mock_logger.info.assert_any_call("⚠️  动态配置写入时有警告: 警告1; 警告2")

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_config_success_empty_models(self, mock_logger, mock_dynamic_config):
        """测试成功处理但没有有效模型的动态配置"""
        # 设置mock返回值
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (
            True, "/path/to/config.yaml", []
        )
        mock_dynamic_config.get_model_ids.return_value = []

        # 测试数据
        config_data = {"models": {}}

        # 调用方法
        await self.processor._handle_dynamic_config(config_data)

        # 验证日志
        mock_logger.info.assert_called_with("✅ 已写入空的动态配置 -> /path/to/config.yaml")

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_config_validation_failure(self, mock_logger, mock_dynamic_config):
        """测试动态配置验证失败"""
        # 设置mock返回值
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (
            False, "", ["验证错误1", "验证错误2"]
        )

        # 测试数据
        config_data = {"invalid": "config"}

        # 调用方法
        await self.processor._handle_dynamic_config(config_data)

        # 验证错误日志
        mock_logger.error.assert_called_with("❌ 动态配置验证失败: 验证错误1; 验证错误2")
        mock_logger.info.assert_called_with("🔄 动态配置注入失败，将使用全局配置继续聊天流程")

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_config_exception(self, mock_logger, mock_dynamic_config):
        """测试动态配置处理异常"""
        # 设置mock抛出异常
        mock_dynamic_config.validate_and_write_dynamic_config.side_effect = Exception("测试异常")

        # 测试数据
        config_data = {"models": {"test": "config"}}

        # 调用方法
        await self.processor._handle_dynamic_config(config_data)

        # 验证异常日志
        mock_logger.error.assert_any_call("❌ 动态配置注入异常: 测试异常")
        mock_logger.info.assert_called_with("🔄 动态配置注入失败，将使用全局配置继续聊天流程")


class TestMessageProcessorDynamicModel:
    """测试MessageProcessor的动态模型选择处理逻辑"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.processor = MessageProcessor()

    @pytest.mark.asyncio
    async def test_handle_dynamic_model_selection_none(self):
        """测试处理None的model_id"""
        mock_context = Mock()

        # 调用方法，应该正常返回而不执行任何操作
        await self.processor._handle_dynamic_model_selection(None, mock_context)

        # 验证没有调用agent_context的方法
        assert not mock_context.called

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_model_selection_success(self, mock_logger):
        """测试成功处理动态模型选择"""
        mock_context = Mock()
        model_id = "test-model-123"

        # 调用方法
        await self.processor._handle_dynamic_model_selection(model_id, mock_context)

        # 验证调用
        mock_context.set_dynamic_model_id.assert_called_once_with(model_id)

        # 验证成功日志
        mock_logger.info.assert_called_with(f"✅ 已设置动态模型选择: {model_id}")

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_model_selection_empty_string(self, mock_logger):
        """测试处理空字符串的model_id"""
        mock_context = Mock()

        # 调用方法，空字符串应该被忽略
        await self.processor._handle_dynamic_model_selection("", mock_context)

        # 验证没有调用agent_context的方法
        mock_context.set_dynamic_model_id.assert_not_called()

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_model_selection_whitespace_string(self, mock_logger):
        """测试处理只有空白字符的model_id"""
        mock_context = Mock()

        # 调用方法，空白字符串应该被忽略
        await self.processor._handle_dynamic_model_selection("   ", mock_context)

        # 验证没有调用agent_context的方法
        mock_context.set_dynamic_model_id.assert_not_called()

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.logger')
    async def test_handle_dynamic_model_selection_exception(self, mock_logger):
        """测试动态模型选择处理异常"""
        mock_context = Mock()
        mock_context.set_dynamic_model_id.side_effect = Exception("设置异常")
        model_id = "test-model"

        # 调用方法
        await self.processor._handle_dynamic_model_selection(model_id, mock_context)

        # 验证异常日志
        mock_logger.error.assert_called_with("❌ 动态模型选择设置异常: 设置异常")
        mock_logger.info.assert_called_with("🔄 动态模型选择设置失败，将使用Agent默认模型继续聊天流程")


class TestMessageProcessorHandleChat:
    """测试MessageProcessor的handle_chat方法中的动态配置和模型处理集成"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.processor = MessageProcessor()
        # Mock agent_dispatcher
        self.processor.agent_dispatcher = Mock()
        self.mock_context = MockAgentContext()
        self.processor.agent_dispatcher.agent_context = self.mock_context

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_config')
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_model_selection')
    @patch('app.api.routes.messages.MessageProcessor._dispatch_agent_with_mcp')
    @patch('agentlang.utils.snowflake.Snowflake.create_default')
    async def test_handle_chat_with_dynamic_config_and_model(
        self, mock_snowflake, mock_dispatch, mock_handle_model, mock_handle_config
    ):
        """测试handle_chat方法中同时处理动态配置和动态模型"""
        # Mock snowflake
        mock_snowflake_instance = Mock()
        mock_snowflake_instance.get_id.return_value = 12345
        mock_snowflake.return_value = mock_snowflake_instance

        # 准备测试数据
        dynamic_config = {"models": {"test-model": {"api_key": "test"}}}
        model_id = "test-model"

        message = ChatClientMessage(
            message_id="test-001",
            prompt="Test message with both dynamic config and model",
            dynamic_config=dynamic_config,
            model_id=model_id,
            context_type=ContextType.NORMAL
        )

        # Mock返回值
        mock_handle_config.return_value = None
        mock_handle_model.return_value = None
        mock_dispatch.return_value = None

        # 调用方法
        result = await self.processor.handle_chat(message)

        # 验证调用顺序和参数
        mock_handle_config.assert_called_once_with(dynamic_config)
        mock_handle_model.assert_called_once_with(model_id, self.mock_context)

        # 验证其他必要的调用
        self.mock_context.set_task_id.assert_called_once()
        self.mock_context.dispatch_event.assert_called()

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_config')
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_model_selection')
    @patch('app.api.routes.messages.MessageProcessor._dispatch_agent_with_mcp')
    @patch('agentlang.utils.snowflake.Snowflake.create_default')
    async def test_handle_chat_with_dynamic_config_only(
        self, mock_snowflake, mock_dispatch, mock_handle_model, mock_handle_config
    ):
        """测试handle_chat方法中只处理动态配置"""
        # Mock snowflake
        mock_snowflake_instance = Mock()
        mock_snowflake_instance.get_id.return_value = 12345
        mock_snowflake.return_value = mock_snowflake_instance

        # 准备测试数据
        dynamic_config = {"models": {"test-model": {"api_key": "test"}}}

        message = ChatClientMessage(
            message_id="test-002",
            prompt="Test message with only dynamic config",
            dynamic_config=dynamic_config,
            context_type=ContextType.NORMAL
        )

        # Mock返回值
        mock_handle_config.return_value = None
        mock_handle_model.return_value = None
        mock_dispatch.return_value = None

        # 调用方法
        result = await self.processor.handle_chat(message)

        # 验证调用
        mock_handle_config.assert_called_once_with(dynamic_config)
        mock_handle_model.assert_called_once_with(None, self.mock_context)  # model_id为None

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_config')
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_model_selection')
    @patch('app.api.routes.messages.MessageProcessor._dispatch_agent_with_mcp')
    @patch('agentlang.utils.snowflake.Snowflake.create_default')
    async def test_handle_chat_with_dynamic_model_only(
        self, mock_snowflake, mock_dispatch, mock_handle_model, mock_handle_config
    ):
        """测试handle_chat方法中只处理动态模型"""
        # Mock snowflake
        mock_snowflake_instance = Mock()
        mock_snowflake_instance.get_id.return_value = 12345
        mock_snowflake.return_value = mock_snowflake_instance

        # 准备测试数据
        model_id = "claude-3-sonnet"

        message = ChatClientMessage(
            message_id="test-003",
            prompt="Test message with only dynamic model",
            model_id=model_id,
            context_type=ContextType.NORMAL
        )

        # Mock返回值
        mock_handle_config.return_value = None
        mock_handle_model.return_value = None
        mock_dispatch.return_value = None

        # 调用方法
        result = await self.processor.handle_chat(message)

        # 验证调用
        mock_handle_config.assert_called_once_with(None)  # dynamic_config为None
        mock_handle_model.assert_called_once_with(model_id, self.mock_context)

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_config')
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_model_selection')
    @patch('app.api.routes.messages.MessageProcessor._dispatch_agent_with_mcp')
    @patch('agentlang.utils.snowflake.Snowflake.create_default')
    async def test_handle_chat_without_dynamic_features(
        self, mock_snowflake, mock_dispatch, mock_handle_model, mock_handle_config
    ):
        """测试handle_chat方法中不使用动态功能"""
        # Mock snowflake
        mock_snowflake_instance = Mock()
        mock_snowflake_instance.get_id.return_value = 12345
        mock_snowflake.return_value = mock_snowflake_instance

        # 准备测试数据
        message = ChatClientMessage(
            message_id="test-004",
            prompt="Test message without dynamic features",
            context_type=ContextType.NORMAL
        )

        # Mock返回值
        mock_handle_config.return_value = None
        mock_handle_model.return_value = None
        mock_dispatch.return_value = None

        # 调用方法
        result = await self.processor.handle_chat(message)

        # 验证调用（都应该传递None）
        mock_handle_config.assert_called_once_with(None)
        mock_handle_model.assert_called_once_with(None, self.mock_context)

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_config')
    @patch('app.api.routes.messages.MessageProcessor._handle_dynamic_model_selection')
    @patch('agentlang.utils.snowflake.Snowflake.create_default')
    async def test_handle_chat_dynamic_processing_exception_handling(
        self, mock_snowflake, mock_handle_model, mock_handle_config
    ):
        """测试handle_chat方法中动态处理异常的处理"""
        # Mock snowflake
        mock_snowflake_instance = Mock()
        mock_snowflake_instance.get_id.return_value = 12345
        mock_snowflake.return_value = mock_snowflake_instance

        # 设置mock抛出异常
        mock_handle_config.side_effect = Exception("动态配置处理异常")
        mock_handle_model.return_value = None

        message = ChatClientMessage(
            message_id="test-005",
            prompt="Test exception handling",
            dynamic_config={"test": "config"},
            context_type=ContextType.NORMAL
        )

        # 调用方法，应该不会因为动态配置异常而中断
        with patch('app.api.routes.messages.MessageProcessor._dispatch_agent_with_mcp'):
            result = await self.processor.handle_chat(message)

        # 验证尝试调用了动态配置处理（即使失败）
        mock_handle_config.assert_called_once()

        # 验证仍然尝试处理动态模型（容错设计）
        mock_handle_model.assert_called_once()


class TestMessageProcessorContainerizedLogic:
    """测试MessageProcessor动态功能的容器化逻辑"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.processor = MessageProcessor()

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_container_logic_success_path(self, mock_logger, mock_dynamic_config):
        """测试容器化逻辑的成功路径"""
        # 设置成功的mock
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (True, "path", [])
        mock_dynamic_config.get_model_ids.return_value = ["model1"]

        mock_context = Mock()

        # 测试数据
        config_data = {"models": {"model1": {"api_key": "test"}}}
        model_id = "model1"

        # 调用容器化的动态处理逻辑
        await self.processor._handle_dynamic_config(config_data)
        await self.processor._handle_dynamic_model_selection(model_id, mock_context)

        # 验证所有调用都成功
        mock_dynamic_config.validate_and_write_dynamic_config.assert_called_once()
        mock_context.set_dynamic_model_id.assert_called_once_with(model_id)

    @pytest.mark.asyncio
    @patch('app.api.routes.messages.dynamic_config')
    @patch('app.api.routes.messages.logger')
    async def test_container_logic_partial_failure(self, mock_logger, mock_dynamic_config):
        """测试容器化逻辑的部分失败路径"""
        # 设置动态配置失败，但动态模型成功
        mock_dynamic_config.validate_and_write_dynamic_config.return_value = (False, "", ["错误"])

        mock_context = Mock()

        # 测试数据
        config_data = {"invalid": "config"}
        model_id = "valid-model"

        # 调用容器化的动态处理逻辑
        await self.processor._handle_dynamic_config(config_data)
        await self.processor._handle_dynamic_model_selection(model_id, mock_context)

        # 验证动态模型仍然成功处理（容错设计）
        mock_context.set_dynamic_model_id.assert_called_once_with(model_id)

        # 验证失败日志
        mock_logger.error.assert_called()


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])
