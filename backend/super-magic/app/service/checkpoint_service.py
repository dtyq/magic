# -*- coding: utf-8 -*-
"""
Checkpoint业务服务

这个模块提供checkpoint相关的业务服务，包括：
- 创建checkpoint
- 保存文件快照
- 获取checkpoint信息
- 列出所有checkpoint
- 获取特定checkpoint之后的所有checkpoint
"""

from datetime import datetime
from typing import Optional, List
from app.core.entity.checkpoint import CheckpointInfo, FileOperation, ChatHistorySnapshot, VirtualCheckpoint
from app.infrastructure.checkpoint.storage import CheckpointStorage
from app.infrastructure.checkpoint.file_snapshot_manager import FileSnapshotManager
from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
from app.infrastructure.checkpoint.chat_history_snapshot_manager import ChatHistorySnapshotManager
from app.path_manager import PathManager
from agentlang.config.config import config
from agentlang.logger import get_logger
from app.core.base_service import Base

logger = get_logger(__name__)


class CheckpointService(Base):
    SERVICE_TYPE = "checkpoint"
    """Checkpoint业务服务类"""

    def __init__(self):
        self.storage = CheckpointStorage()
        self.file_snapshot_manager = FileSnapshotManager()
        self.metadata_manager = CheckpointMetadataManager()
        self.chat_history_snapshot_manager = ChatHistorySnapshotManager()

        # 初始化标志
        self._initialized = False

    async def initialize(self) -> None:
        """初始化 checkpoint 系统（在 agent run 中调用）"""
        if self._initialized:
            return
        await self._ensure_checkpoint_system_initialized()
        self._initialized = True

    async def _ensure_checkpoint_system_initialized(self) -> None:
        """内部初始化方法"""
        try:
            manifest = await self.metadata_manager.load_checkpoint_manifest()

            if not manifest:
                # 首次初始化：创建 __INITIAL__ checkpoint 和清单
                await self._create_initial_checkpoint_system()
            elif not manifest.current_checkpoint_id:
                # 修复损坏的清单：设置当前 checkpoint
                await self._repair_checkpoint_manifest(manifest)
            else:
                # 系统已正确初始化
                logger.debug(f"Checkpoint系统已初始化，当前checkpoint: {manifest.current_checkpoint_id}")

        except Exception as e:
            logger.error(f"初始化checkpoint系统失败: {e}")
            raise

    async def _create_initial_checkpoint_system(self) -> None:
        """创建初始的 checkpoint 系统"""
        from datetime import datetime
        from app.core.entity.checkpoint import CheckpointManifest, VirtualCheckpoint
        import json

        logger.info("首次创建checkpoint系统，初始化__INITIAL__")

        # 确保 __INITIAL__ checkpoint 存在
        if not await self.metadata_manager.ensure_initial_checkpoint_created():
            raise Exception("创建__INITIAL__checkpoint失败")

        # 创建初始清单
        manifest = CheckpointManifest(
            checkpoints=[VirtualCheckpoint.INITIAL],
            current_checkpoint_id=VirtualCheckpoint.INITIAL,
            created_time=datetime.now(),
            updated_time=datetime.now()
        )

        # 保存清单
        manifest_file = self.storage.get_checkpoint_manifest_file_path()
        with manifest_file.open('w', encoding='utf-8') as f:
            json.dump(manifest.model_dump(), f, ensure_ascii=False, indent=2, default=str)

        logger.info("Checkpoint系统初始化完成，当前checkpoint: __INITIAL__")

    async def _ensure_clean_state_before_create(self) -> None:
        """在创建新checkpoint之前确保状态是干净的"""
        try:
            logger.info("执行 checkpoint rollback commit 以确保状态干净")

            from app.service.rollback_service import RollbackService
            rollback_service = RollbackService()
            await rollback_service.commit_rollback()

            logger.info("checkpoint rollback commit 执行完成")

        except Exception as e:
            # 记录错误但不抛出异常，避免影响 checkpoint 创建
            logger.error(f"执行 checkpoint rollback commit 时发生错误: {e}")
            logger.error(f"错误详情: {e}", exc_info=True)

    async def _repair_checkpoint_manifest(self, manifest) -> None:
        """修复损坏的 checkpoint 清单"""
        if manifest.checkpoints:
            # 设置为最新的 checkpoint
            latest_checkpoint = manifest.checkpoints[-1]
            logger.info(f"修复checkpoint清单，设置当前checkpoint为: {latest_checkpoint}")
            await self.metadata_manager.update_current_checkpoint(latest_checkpoint)
        else:
            # 清单完全损坏，重新初始化
            logger.warning("checkpoint清单完全损坏，重新初始化")
            await self._create_initial_checkpoint_system()

    async def create_checkpoint(self, message_id: str) -> CheckpointInfo:
        """创建新的checkpoint"""
        try:
            # 在创建新checkpoint之前，执行rollback commit确保状态干净
            await self._ensure_clean_state_before_create()

            # 检查checkpoint是否已存在
            if await self.storage.checkpoint_exists(message_id):
                logger.warning(f"Checkpoint已存在: {message_id}")
                existing_checkpoint = await self.get_checkpoint(message_id)
                if existing_checkpoint:
                    return existing_checkpoint
                else:
                    # 如果获取失败，删除损坏的checkpoint并重新创建
                    await self.storage.delete_checkpoint_directory(message_id)

            # 创建checkpoint目录结构
            await self.storage.create_checkpoint_directory(message_id)

            # 创建checkpoint信息对象
            checkpoint_info = CheckpointInfo(
                checkpoint_id=message_id,
                created_time=datetime.now(),
                file_snapshots=[]
            )

            # 注意：聊天历史快照现在通过事件机制自动处理，不再在创建checkpoint时进行
            # 聊天历史会在每次变更时自动备份到当前checkpoint的chat_history_snapshots目录

            # 保存checkpoint信息
            success = await self.metadata_manager.save_checkpoint_info(checkpoint_info)
            if not success:
                raise Exception("保存checkpoint信息失败")

            # 更新checkpoint清单
            success = await self.metadata_manager.update_checkpoint_manifest(message_id)
            if not success:
                raise Exception("更新checkpoint清单失败")

            # 更新当前checkpoint状态
            from app.utils.checkpoint_utils import CheckpointUtils
            await CheckpointUtils.set_current_checkpoint_position(message_id)
            logger.info(f"更新当前checkpoint状态: {message_id}")

            # 检查并清理超出限制的checkpoint
            cleanup_success = await self.cleanup_old_checkpoints()
            if not cleanup_success:
                logger.warning("清理旧checkpoint失败，但checkpoint创建成功")

            logger.info(f"创建checkpoint成功: {message_id}")
            return checkpoint_info

        except Exception as e:
            logger.error(f"创建checkpoint失败: {e}")
            # 清理可能创建的目录
            await self.storage.delete_checkpoint_directory(message_id)
            raise

    async def save_initial_file_snapshot(self, checkpoint_info: CheckpointInfo, file_path: str, operation: FileOperation) -> None:
        """保存初始化文件快照"""
        try:
            # 创建初始化文件快照
            file_snapshot = await self.file_snapshot_manager.create_initial_file_snapshot(checkpoint_info.checkpoint_id, file_path, operation)

            if file_snapshot:
                # 更新checkpoint信息
                checkpoint_info.file_snapshots.append(file_snapshot)
                success = await self.metadata_manager.save_checkpoint_info(checkpoint_info)

                if success:
                    logger.info(f"保存文件快照成功: {file_path} ({operation.value})")
                else:
                    logger.error(f"更新checkpoint信息失败: {file_path}")
            else:
                logger.warning(f"创建文件快照失败: {file_path}")

        except Exception as e:
            logger.error(f"保存初始化文件快照失败: {e}")

    async def save_latest_file_snapshot(self, checkpoint_info: CheckpointInfo, file_path: str, operation: FileOperation) -> None:
        """保存最新文件快照"""
        try:
            # 创建最新文件快照
            file_snapshot = await self.file_snapshot_manager.create_latest_file_snapshot(checkpoint_info.checkpoint_id, file_path, operation)

            if file_snapshot:
                logger.info(f"保存最新文件快照成功: {file_path} ({operation.value})")
            else:
                logger.warning(f"创建最新文件快照失败: {file_path}")

        except Exception as e:
            logger.error(f"保存最新文件快照失败: {e}")

    async def has_file_snapshot(self, checkpoint_info: CheckpointInfo, file_path: str) -> bool:
        """检查指定文件是否已有快照（避免重复快照）"""
        try:
            # 使用FileSnapshotManager检查快照存在性
            return await self.file_snapshot_manager.has_snapshot_for_file(checkpoint_info.checkpoint_id, file_path)

        except Exception as e:
            logger.error(f"检查文件快照失败 {file_path}: {e}")
            return False

    async def get_checkpoint(self, message_id: str) -> Optional[CheckpointInfo]:
        """获取checkpoint信息"""
        return await self.metadata_manager.load_checkpoint_info(message_id)

    async def checkpoint_exists(self, message_id: str) -> bool:
        """检查checkpoint是否存在"""
        return await self.storage.checkpoint_exists(message_id)

    async def cleanup_old_checkpoints(self, max_checkpoints: Optional[int] = None) -> bool:
        """清理超出数量限制的旧checkpoint"""
        try:
            # 从配置文件读取数量限制
            limit = max_checkpoints or config.get("checkpoint.max_count", 10)

            # 检查是否启用自动清理
            auto_cleanup = config.get("checkpoint.auto_cleanup", True)
            if not auto_cleanup:
                logger.info("自动清理功能已禁用")
                return True

            # 获取所有checkpoint列表（按时间排序）
            manifest = await self.metadata_manager.load_checkpoint_manifest()
            # 保留 limit + 1 个checkpoint，这样可以撤回 limit 个消息
            if not manifest or len(manifest.checkpoints) <= limit + 1:
                return True  # 未超过限制，无需清理

            # 计算需要删除的数量 - 保留 limit + 1 个
            excess_count = len(manifest.checkpoints) - (limit + 1)
            checkpoints_to_delete = manifest.checkpoints[:excess_count]  # 最旧的N个

            logger.info(f"需要清理{excess_count}个旧checkpoint，保留{limit + 1}个checkpoint以支持撤回{limit}个消息: {checkpoints_to_delete}")

            # 获取当前checkpoint状态
            from app.utils.checkpoint_utils import CheckpointUtils
            current_checkpoint_id = await CheckpointUtils.get_current_checkpoint_position()

            # 删除checkpoint目录
            for checkpoint_id in checkpoints_to_delete:
                success = await self.storage.delete_checkpoint_directory(checkpoint_id)
                if not success:
                    logger.error(f"删除checkpoint目录失败: {checkpoint_id}")
                    return False

            # 从清单中移除
            success = await self.metadata_manager.remove_from_manifest(checkpoints_to_delete)
            if not success:
                logger.error("更新checkpoint清单失败")
                return False

            # 如果当前checkpoint被删除，需要更新状态
            if current_checkpoint_id in checkpoints_to_delete:
                # 获取剩余的checkpoint列表
                remaining_manifest = await self.metadata_manager.load_checkpoint_manifest()
                if remaining_manifest and remaining_manifest.checkpoints:
                    # 设置为最新的checkpoint
                    new_current = remaining_manifest.checkpoints[-1]
                    CheckpointUtils.set_current_checkpoint_position(new_current)
                    logger.info(f"当前checkpoint被清理，更新为: {new_current}")

            logger.info(f"清理旧checkpoint完成，删除了{excess_count}个")
            return True

        except Exception as e:
            logger.error(f"清理旧checkpoint失败: {e}")
            return False

    async def get_checkpoint_count(self) -> int:
        """获取当前checkpoint数量"""
        try:
            manifest = await self.metadata_manager.load_checkpoint_manifest()
            return len(manifest.checkpoints) if manifest else 0
        except Exception as e:
            logger.error(f"获取checkpoint数量失败: {e}")
            return 0

    async def can_rollback_to_checkpoint(self, target_message_id: str) -> bool:
        """
        检查是否可以回滚到指定的checkpoint

        Args:
            target_message_id: 目标消息ID

        Returns:
            bool: 是否可以回滚到目标checkpoint
        """
        try:
            previous_checkpoint = await self.metadata_manager.get_previous_checkpoint_in_checkpoint_manifest(target_message_id)

            if previous_checkpoint is None:
                logger.info(f"无法回滚到checkpoint {target_message_id}，因为它是最早的checkpoint")
                return False
            else:
                logger.info(f"可以回滚到checkpoint: {target_message_id}")
                return True

        except Exception as e:
            logger.error(f"检查回滚可行性失败: {e}")
            return False
