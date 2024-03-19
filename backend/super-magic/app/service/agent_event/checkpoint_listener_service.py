# -*- coding: utf-8 -*-
"""
Checkpoint事件监听服务

这个模块负责监听代理运行和文件操作事件，自动创建checkpoint和保存文件快照。
"""

from agentlang.event.event import Event, EventType
from agentlang.event.data import BeforeMainAgentRunEventData, ChatHistoryChangedEventData
from app.core.entity.event.file_event import FileEventData
from app.core.context.agent_context import AgentContext
from app.service.checkpoint_service import CheckpointService
from app.service.agent_event.base_listener_service import BaseListenerService
from app.utils.checkpoint_utils import CheckpointUtils
from app.core.entity.checkpoint import FileOperation
from app.infrastructure.checkpoint.chat_history_snapshot_manager import ChatHistorySnapshotManager
from app.infrastructure.checkpoint.storage import CheckpointStorage
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointListenerService:
    """Checkpoint事件监听服务"""

    @staticmethod
    def register_standard_listeners(agent_context: AgentContext) -> None:
        """注册checkpoint相关的事件监听器"""
        event_listeners = {
            EventType.BEFORE_MAIN_AGENT_RUN: CheckpointListenerService._handle_before_main_agent_run,
            # BEFORE事件监听器（保存initial_content）
            EventType.BEFORE_FILE_CREATED: CheckpointListenerService._handle_before_file_created,
            EventType.BEFORE_FILE_UPDATED: CheckpointListenerService._handle_before_file_updated,
            EventType.BEFORE_FILE_DELETED: CheckpointListenerService._handle_before_file_deleted,
            # AFTER事件监听器（保存latest_content）
            EventType.FILE_CREATED: CheckpointListenerService._handle_file_created,
            EventType.FILE_UPDATED: CheckpointListenerService._handle_file_updated,
            EventType.FILE_DELETED: CheckpointListenerService._handle_file_deleted,
            # 聊天历史变更事件监听器
            EventType.CHAT_HISTORY_CHANGED: CheckpointListenerService._handle_chat_history_changed,
        }

        BaseListenerService.register_listeners(agent_context, event_listeners)
        logger.info("已注册checkpoint事件监听器")

    @staticmethod
    async def _handle_before_main_agent_run(event: Event[BeforeMainAgentRunEventData]) -> None:
        """处理主代理运行前事件，创建checkpoint"""
        try:
            agent_context = event.data.agent_context

            # 创建checkpoint
            checkpoint_service = CheckpointService()
            await checkpoint_service.initialize()

            # 检查是否需要创建checkpoint
            if not await CheckpointUtils.should_create_checkpoint(agent_context):
                logger.info("不需要创建checkpoint，跳过")
                return

            # 获取消息ID
            message_id = CheckpointUtils.get_current_checkpoint_context(agent_context)
            checkpoint_info = await checkpoint_service.create_checkpoint(message_id)

            # 在 checkpoint 创建后，保存 initial chat_history 快照
            await CheckpointListenerService._save_initial_chat_history_snapshot(message_id)

            # 将checkpoint信息存储到代理上下文中供后续使用
            CheckpointUtils.set_current_checkpoint(agent_context, checkpoint_info)

            logger.info(f"为消息创建checkpoint: {message_id}")

        except Exception as e:
            logger.error(f"创建checkpoint失败: {e}")

    @staticmethod
    async def _save_initial_chat_history_snapshot(checkpoint_id: str) -> None:
        """
        保存 initial chat_history 快照（在 checkpoint 创建时调用）

        Args:
            checkpoint_id: checkpoint ID
        """
        try:
            logger.info(f"开始保存 initial chat_history 快照: {checkpoint_id}")

            storage = CheckpointStorage()
            chat_history_manager = ChatHistorySnapshotManager()

            # 获取 initial chat_history 快照目录
            initial_snapshot_dir = storage.get_initial_chat_history_snapshots_dir(checkpoint_id)

            # 创建 initial 聊天历史快照
            success = await chat_history_manager.create_initial_chat_history_snapshot(initial_snapshot_dir)

            if success:
                logger.info(f"成功保存 initial chat_history 快照到 checkpoint {checkpoint_id}")
            else:
                logger.error(f"保存 initial chat_history 快照到 checkpoint {checkpoint_id} 失败")

        except Exception as e:
            logger.error(f"保存 initial chat_history 快照失败: {e}", exc_info=True)

    @staticmethod
    async def _handle_before_file_created(event: Event[FileEventData]) -> None:
        """处理文件创建前事件"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过文件快照")
                return

            # 记录文件创建操作（文件创建前不需要保存内容，回滚时直接删除即可）
            checkpoint_service = CheckpointService()
            await checkpoint_service.save_initial_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.CREATED)

            logger.info(f"记录文件创建前操作: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件创建前事件失败: {e}")

    @staticmethod
    async def _handle_before_file_updated(event: Event[FileEventData]) -> None:
        """处理文件更新前事件，保存修改前的内容"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过文件快照")
                return

            # 检查同一个checkpoint下是否已经有该文件的快照（避免重复快照）
            checkpoint_service = CheckpointService()
            if await checkpoint_service.has_file_snapshot(current_checkpoint, event.data.filepath):
                logger.info(f"文件已有快照，跳过重复保存: {event.data.filepath}")
                return

            # 保存修改前的文件内容（仅第一次）
            await checkpoint_service.save_initial_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.UPDATED)

            logger.info(f"保存文件首次更新快照: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件更新前事件失败: {e}")

    @staticmethod
    async def _handle_before_file_deleted(event: Event[FileEventData]) -> None:
        """处理文件删除前事件，保存删除前的内容"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过文件快照")
                return

            # 保存删除前的文件内容
            checkpoint_service = CheckpointService()
            await checkpoint_service.save_initial_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.DELETED)

            logger.info(f"保存文件删除前快照: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件删除前事件失败: {e}")

    @staticmethod
    async def _handle_file_created(event: Event[FileEventData]) -> None:
        """处理文件创建后事件，保存最新状态"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过最新文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过最新文件快照")
                return

            # 保存文件创建后的最新状态
            checkpoint_service = CheckpointService()
            await checkpoint_service.save_latest_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.CREATED)

            logger.info(f"保存文件创建后的最新快照: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件创建后事件失败: {e}")

    @staticmethod
    async def _handle_file_updated(event: Event[FileEventData]) -> None:
        """处理文件更新后事件，保存最新状态"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过最新文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过最新文件快照")
                return

            # 保存文件更新后的最新状态
            checkpoint_service = CheckpointService()
            await checkpoint_service.save_latest_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.UPDATED)

            logger.info(f"保存文件更新后的最新快照: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件更新后事件失败: {e}")

    @staticmethod
    async def _handle_file_deleted(event: Event[FileEventData]) -> None:
        """处理文件删除后事件，保存最新状态"""
        try:
            # 获取代理上下文
            tool_context = event.data.tool_context
            agent_context = tool_context.get_extension_typed("agent_context", AgentContext)

            if not agent_context:
                logger.error("无法获取代理上下文，跳过最新文件快照处理")
                return

            # 获取当前checkpoint
            current_checkpoint = CheckpointUtils.get_current_checkpoint(agent_context)
            if not current_checkpoint:
                logger.info("当前没有活跃的checkpoint，跳过最新文件快照")
                return

            # 保存文件删除后的最新状态（记录文件已删除）
            checkpoint_service = CheckpointService()
            await checkpoint_service.save_latest_file_snapshot(current_checkpoint, event.data.filepath, FileOperation.DELETED)

            logger.info(f"保存文件删除后的最新快照: {event.data.filepath}")

        except Exception as e:
            logger.error(f"处理文件删除后事件失败: {e}")

    @staticmethod
    async def _handle_chat_history_changed(event: Event[ChatHistoryChangedEventData]) -> None:
        """处理聊天历史变更事件，自动备份 latest 快照到当前checkpoint"""
        try:
            event_data = event.data
            logger.info(f"处理聊天历史变更事件: agent={event_data.agent_name}, file={event_data.file_path}")

            # 获取当前checkpoint ID
            current_checkpoint_id = await CheckpointUtils.get_current_checkpoint_position()

            if not current_checkpoint_id:
                logger.info("当前没有活跃的checkpoint，跳过聊天历史备份")
                return

            logger.info(f"当前checkpoint: {current_checkpoint_id}")

            storage = CheckpointStorage()
            chat_history_manager = ChatHistorySnapshotManager()

            # 获取 latest chat_history 快照目录
            latest_snapshot_dir = storage.get_latest_chat_history_snapshots_dir(current_checkpoint_id)

            # 创建 latest 聊天历史快照
            success = await chat_history_manager.create_latest_chat_history_snapshot(latest_snapshot_dir)

            if success:
                logger.info(f"成功备份 latest chat_history 到 checkpoint {current_checkpoint_id}")
            else:
                logger.error(f"备份 latest chat_history 到 checkpoint {current_checkpoint_id} 失败")

        except Exception as e:
            logger.error(f"处理聊天历史变更事件失败: {e}", exc_info=True)
