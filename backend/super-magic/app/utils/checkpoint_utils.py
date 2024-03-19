# -*- coding: utf-8 -*-
"""
Checkpoint工具类

这个模块提供checkpoint相关的工具函数，包括：
- 从代理上下文获取checkpoint相关信息
- 判断是否应该创建checkpoint
- 其他checkpoint相关的辅助功能
"""

from typing import Optional
from app.core.context.agent_context import AgentContext
from app.service.checkpoint_service import CheckpointService
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointUtils:
    """Checkpoint工具类"""

    @staticmethod
    def get_current_checkpoint_context(agent_context: AgentContext) -> Optional[str]:
        """从代理上下文获取当前checkpoint上下文信息"""
        try:
            chat_message = agent_context.get_chat_client_message()
            message_id = chat_message.message_id if chat_message else None

            return message_id

        except Exception as e:
            logger.error(f"获取checkpoint上下文失败: {e}")
            return None

    @staticmethod
    async def should_create_checkpoint(agent_context: AgentContext) -> bool:
        """判断是否应该创建checkpoint"""
        try:
            message_id = CheckpointUtils.get_current_checkpoint_context(agent_context)
            if not message_id:
                logger.error("无法获取消息ID，跳过checkpoint创建")
                return False

            # 检查checkpoint是否已存在
            checkpoint_service = CheckpointService()
            existing_checkpoint = await checkpoint_service.checkpoint_exists(message_id)

            should_create = not existing_checkpoint
            if should_create:
                logger.info(f"需要创建checkpoint: {message_id}")
            else:
                logger.info(f"已存在checkpoint，跳过创建: {message_id}")

            return should_create

        except Exception as e:
            logger.error(f"判断是否创建checkpoint失败: {e}")
            return False

    @staticmethod
    def set_current_message_id(agent_context: AgentContext, message_id: str) -> None:
        """设置当前消息ID到代理上下文"""
        try:
            agent_context.shared_context.update_field("current_message_id", message_id, str)
            logger.debug(f"设置当前消息ID: {message_id}")
        except Exception as e:
            logger.error(f"设置当前消息ID失败: {e}")

    @staticmethod
    def get_current_checkpoint(agent_context: AgentContext) -> Optional:
        """获取当前活跃的checkpoint"""
        try:
            if agent_context.shared_context.has_field("current_checkpoint"):
                return agent_context.shared_context.get_field("current_checkpoint")
            return None
        except Exception as e:
            logger.error(f"获取当前checkpoint失败: {e}")
            return None

    @staticmethod
    def set_current_checkpoint(agent_context: AgentContext, checkpoint_info) -> None:
        """设置当前活跃的checkpoint"""
        try:
            from app.core.entity.checkpoint import CheckpointInfo
            agent_context.shared_context.update_field("current_checkpoint", checkpoint_info, CheckpointInfo)
            logger.debug(f"设置当前checkpoint: {checkpoint_info.checkpoint_id}")
        except Exception as e:
            logger.error(f"设置当前checkpoint失败: {e}")

    @staticmethod
    async def get_current_checkpoint_position() -> Optional[str]:
        """获取当前checkpoint位置"""
        try:
            from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
            metadata_manager = CheckpointMetadataManager()
            return await metadata_manager.get_current_checkpoint()
        except Exception as e:
            logger.error(f"获取当前checkpoint位置失败: {e}")
            return None

    @staticmethod
    async def set_current_checkpoint_position(checkpoint_id: Optional[str]) -> bool:
        """设置当前checkpoint位置"""
        try:
            from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
            metadata_manager = CheckpointMetadataManager()
            return await metadata_manager.update_current_checkpoint(checkpoint_id)
        except Exception as e:
            logger.error(f"设置当前checkpoint位置失败: {e}")
            return False

    @staticmethod
    async def clear_current_checkpoint_position() -> bool:
        """清空当前checkpoint位置"""
        try:
            from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
            metadata_manager = CheckpointMetadataManager()
            return await metadata_manager.update_current_checkpoint(None)
        except Exception as e:
            logger.error(f"清空当前checkpoint位置失败: {e}")
            return False
