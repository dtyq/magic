# -*- coding: utf-8 -*-
"""
回滚执行器 - 基础设施层

统一处理checkpoint的完整回滚，包括：
- 工作区文件回滚
- 确保回滚操作的原子性和一致性
"""

import shutil
import json
import asyncio
from pathlib import Path
from typing import List, Optional, Tuple
from datetime import datetime
from app.core.entity.checkpoint import FileSnapshot, FileOperation, CheckpointInfo, FileType
from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
from app.infrastructure.checkpoint.storage import CheckpointStorage
from app.infrastructure.checkpoint.chat_history_snapshot_manager import ChatHistorySnapshotManager
from app.utils.async_file_utils import (
    async_copy2, async_rmtree, async_mkdir, async_unlink, async_rmdir, async_write_json
)
from app.core.exceptions import RollbackException, ErrorCode
from app.path_manager import PathManager

from agentlang.logger import get_logger

logger = get_logger(__name__)


class RollbackExecutor:
    """回滚执行器 - 处理工作区文件回滚"""

    def __init__(self):
        """初始化回滚执行器（启用文件快照合并优化）"""
        self.metadata_manager = CheckpointMetadataManager()
        self.storage = CheckpointStorage()
        self.chat_history_snapshot_manager = ChatHistorySnapshotManager()

        logger.info("RollbackExecutor初始化完成，合并优化已启用")

    async def start_rollback(self, target_checkpoint_id: str) -> bool:
        """
        开始回滚操作，只恢复文件状态

        Args:
            target_checkpoint_id: 目标检查点ID，不能为None

        Returns:
            bool: 回滚是否成功
        """
        try:
            # 验证参数
            if target_checkpoint_id is None:
                raise ValueError("target_checkpoint_id不能为None")

            # 验证目标checkpoint是否存在
            manifest = await self.metadata_manager.load_checkpoint_manifest()
            if not manifest or target_checkpoint_id not in manifest.checkpoints:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND,
                                       f"目标checkpoint不存在: {target_checkpoint_id}")

            logger.info(f"开始回滚到检查点: {target_checkpoint_id}")

            # 获取当前checkpoint状态
            current_checkpoint_id = await self.metadata_manager.get_current_checkpoint()
            if current_checkpoint_id is None:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND,
                                       "无法获取当前checkpoint状态，系统可能未正确初始化")

            # 如果当前checkpoint和目标checkpoint相同，无需回滚
            if current_checkpoint_id == target_checkpoint_id:
                logger.info(f"当前checkpoint与目标checkpoint相同，无需回滚: {target_checkpoint_id}")
                return True

            # 执行工作区文件回滚
            workspace_rollback_success = await self._execute_workspace_rollback(current_checkpoint_id, target_checkpoint_id)
            if not workspace_rollback_success:
                logger.error("工作区文件回滚失败")
                return False

            # 执行聊天历史回滚
            history_rollback_success = await self._execute_chat_history_rollback(current_checkpoint_id, target_checkpoint_id)
            if not history_rollback_success:
                logger.error("聊天历史回滚失败，但工作区回滚已成功")
                # 注意：这里可以根据需求决定是否要回滚工作区更改
                # 为了保持原子性，可能需要撤销工作区更改，但这里选择继续
                logger.warning("继续完成回滚，但聊天历史可能不一致")

            # 更新当前checkpoint状态
            await self.metadata_manager.update_current_checkpoint(target_checkpoint_id)
            logger.info(f"当前checkpoint状态已更新: {target_checkpoint_id}")

            logger.info(f"回滚完成，当前checkpoint: {target_checkpoint_id}")
            return True

        except Exception as e:
            logger.error(f"开始回滚时发生错误: {e}")
            return False

    async def _execute_workspace_rollback(self, current_checkpoint_id: Optional[str], target_checkpoint_id: str) -> bool:
        """执行工作区文件回滚

        Args:
            current_checkpoint_id: 当前checkpoint ID
            target_checkpoint_id: 目标checkpoint ID，不能为None

        Returns:
            bool: 回滚是否成功
        """
        try:
            # 使用metadata_manager获取checkpoint范围和方向
            direction, checkpoints_to_process = await self.metadata_manager.get_checkpoints_between_in_checkpoint_manifest(
                current_checkpoint_id, target_checkpoint_id
            )

            logger.info(f"回滚方向: {direction}, 需要处理的checkpoint: {checkpoints_to_process}")

            if direction == "none":
                logger.info("当前checkpoint与目标checkpoint相同，无需回滚")
                return True
            elif direction == "backward":
                return await self._execute_backward_workspace_rollback(checkpoints_to_process)
            elif direction == "forward":
                return await self._execute_forward_workspace_rollback(checkpoints_to_process)
            else:
                logger.error(f"未知的回滚方向: {direction}")
                return False

        except Exception as e:
            logger.error(f"执行工作区回滚失败: {e}")
            return False

    async def _merge_file_snapshots_for_rollback(self, checkpoint_ids: List[str], is_forward: bool) -> List[Tuple[str, FileSnapshot]]:
        """
        合并多个checkpoint的文件快照，去除重复操作

        Args:
            checkpoint_ids: checkpoint ID列表
            is_forward: True=正向回滚(保留最晚), False=反向回滚(保留最早)

        Returns:
            List[Tuple[str, FileSnapshot]]: [(checkpoint_id, file_snapshot), ...]
        """
        file_operations = {}  # {file_path: (checkpoint_id, file_snapshot)}

        # 根据回滚方向确定处理顺序
        processing_order = checkpoint_ids if is_forward else reversed(checkpoint_ids)

        logger.info(f"开始合并文件快照，回滚方向：{'正向' if is_forward else '反向'}，checkpoint数量：{len(checkpoint_ids)}")

        processed_checkpoints = 0
        total_snapshots = 0

        for checkpoint_id in processing_order:
            checkpoint_info = await self.metadata_manager.load_checkpoint_info(checkpoint_id)
            if not checkpoint_info:
                logger.warning(f"跳过无效的checkpoint: {checkpoint_id}")
                continue

            processed_checkpoints += 1
            checkpoint_snapshot_count = len(checkpoint_info.file_snapshots)
            total_snapshots += checkpoint_snapshot_count

            logger.debug(f"处理checkpoint {checkpoint_id}，包含 {checkpoint_snapshot_count} 个文件快照")

            for file_snapshot in checkpoint_info.file_snapshots:
                file_path = file_snapshot.file_path

                # 由于处理顺序已通过reversed()调整，直接覆盖即可达到预期效果：
                # - 反向回滚：从新到旧处理，最后保留最早的操作
                # - 正向回滚：从旧到新处理，最后保留最晚的操作
                file_operations[file_path] = (checkpoint_id, file_snapshot)
                logger.debug(f"{'正向' if is_forward else '反向'}回滚更新文件操作: {file_path} -> {file_snapshot.operation.value}")

        merged_operations = list(file_operations.values())

        logger.info(f"文件快照合并完成：")
        logger.info(f"  - 处理checkpoint数量: {processed_checkpoints}")
        logger.info(f"  - 原始快照总数: {total_snapshots}")
        logger.info(f"  - 合并后快照数量: {len(merged_operations)}")
        logger.info(f"  - 优化比率: {((total_snapshots - len(merged_operations)) / total_snapshots * 100):.1f}%" if total_snapshots > 0 else "  - 优化比率: 0%")

        return merged_operations

    async def _validate_merge_logic(self, checkpoint_ids: List[str], is_forward: bool) -> bool:
        """
        验证合并逻辑的正确性（用于调试）

        Args:
            checkpoint_ids: checkpoint ID列表
            is_forward: 回滚方向

        Returns:
            bool: 验证是否通过
        """
        try:
            merged_operations = await self._merge_file_snapshots_for_rollback(checkpoint_ids, is_forward)

            # 检查是否有重复的文件路径
            file_paths = [file_snapshot.file_path for _, file_snapshot in merged_operations]
            unique_file_paths = set(file_paths)

            if len(file_paths) != len(unique_file_paths):
                logger.error("合并逻辑错误：存在重复的文件路径")
                return False

            logger.debug(f"合并逻辑验证通过，处理了{len(unique_file_paths)}个唯一文件")
            return True

        except Exception as e:
            logger.error(f"合并逻辑验证失败: {e}")
            return False

    async def _execute_backward_workspace_rollback(self, checkpoint_ids: List[str]) -> bool:
        """执行反向工作区回滚（带合并优化）

        Args:
            checkpoint_ids: 需要回滚的checkpoint ID列表

        Returns:
            bool: 回滚是否成功
        """
        try:
            logger.info(f"开始执行反向回滚（带合并优化），checkpoint数量: {len(checkpoint_ids)}")

            # 使用合并优化
            merged_operations = await self._merge_file_snapshots_for_rollback(checkpoint_ids, is_forward=False)

            # 处理合并后的文件操作
            success_count = 0
            for checkpoint_id, file_snapshot in merged_operations:
                success = await self._restore_from_initial_content(checkpoint_id, file_snapshot)
                if success:
                    success_count += 1
                else:
                    logger.error(f"从initial_content恢复文件失败: {file_snapshot.file_path}")
                    return False

            logger.info(f"反向回滚完成（合并优化），成功处理了{success_count}个文件操作")
            return True

        except Exception as e:
            logger.error(f"执行反向工作区回滚失败: {e}")
            return False

    async def _execute_forward_workspace_rollback(self, checkpoint_ids: List[str]) -> bool:
        """执行正向工作区回滚（带合并优化）

        Args:
            checkpoint_ids: 需要应用的checkpoint ID列表

        Returns:
            bool: 回滚是否成功
        """
        try:
            logger.info(f"开始执行正向回滚（带合并优化），checkpoint数量: {len(checkpoint_ids)}")

            # 使用合并优化
            merged_operations = await self._merge_file_snapshots_for_rollback(checkpoint_ids, is_forward=True)

            # 处理合并后的文件操作
            success_count = 0
            for checkpoint_id, file_snapshot in merged_operations:
                success = await self._restore_from_latest_content(checkpoint_id, file_snapshot)
                if success:
                    success_count += 1
                else:
                    logger.error(f"从latest_content恢复文件失败: {file_snapshot.file_path}")
                    return False

            logger.info(f"正向回滚完成（合并优化），成功处理了{success_count}个文件操作")
            return True

        except Exception as e:
            logger.error(f"执行正向工作区回滚失败: {e}")
            return False

    async def _restore_from_initial_content(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """从initial_content恢复文件（反向回滚，operation感知）"""
        try:
            logger.info(f"执行反向回滚（initial_content）: {file_snapshot.file_path}, operation={file_snapshot.operation.value}")

            # 使用新的operation感知恢复逻辑（反向回滚）
            return await self._restore_file_by_operation(checkpoint_id, file_snapshot, is_forward=False)

        except Exception as e:
            logger.error(f"从initial_content恢复文件失败: {e}")
            return False

    async def _restore_from_latest_content(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """从latest_content恢复文件（正向回滚，operation感知）"""
        try:
            logger.info(f"执行正向回滚（latest_content）: {file_snapshot.file_path}, operation={file_snapshot.operation.value}")

            # 使用新的operation感知恢复逻辑（正向回滚）
            return await self._restore_file_by_operation(checkpoint_id, file_snapshot, is_forward=True)

        except Exception as e:
            logger.error(f"从latest_content恢复文件失败: {e}")
            return False

    def _calculate_path_hash(self, file_path: str) -> str:
        """计算文件路径hash"""
        import hashlib
        return hashlib.md5(file_path.encode('utf-8')).hexdigest()

    async def _execute_chat_history_rollback(self, current_checkpoint_id: str, target_checkpoint_id: str) -> bool:
        """
        执行聊天历史回滚

        与 _execute_workspace_rollback 保持一致的结构：
        - 获取 checkpoints_between 确定回滚方向和需要处理的 checkpoint 列表
        - backward: 使用 checkpoints_to_process[0] 的 initial 快照
        - forward: 使用 checkpoints_to_process[-1] 的 latest 快照

        Args:
            current_checkpoint_id: 当前checkpoint ID
            target_checkpoint_id: 目标checkpoint ID，不能为None

        Returns:
            bool: 回滚是否成功
        """
        try:
            # 使用 metadata_manager 获取 checkpoint 范围和方向
            direction, checkpoints_to_process = await self.metadata_manager.get_checkpoints_between_in_checkpoint_manifest(
                current_checkpoint_id, target_checkpoint_id
            )

            logger.info(f"聊天历史回滚方向: {direction}, 需要处理的checkpoint: {checkpoints_to_process}")

            if direction == "none":
                logger.info("当前checkpoint与目标checkpoint相同，无需回滚聊天历史")
                return True
            elif direction == "backward":
                return await self._execute_backward_chat_history_rollback(checkpoints_to_process)
            elif direction == "forward":
                return await self._execute_forward_chat_history_rollback(checkpoints_to_process)
            else:
                logger.error(f"未知的回滚方向: {direction}")
                return False

        except Exception as e:
            logger.error(f"执行聊天历史回滚失败: {e}", exc_info=True)
            return False

    async def _execute_backward_chat_history_rollback(self, checkpoints_to_process: List[str]) -> bool:
        """
        执行反向聊天历史回滚

        使用 checkpoints_to_process[0] 的 initial 快照恢复到目标状态
        （checkpoints_to_process[0] 的 initial 代表 target 执行后的状态）

        Args:
            checkpoints_to_process: 需要处理的 checkpoint ID 列表

        Returns:
            bool: 恢复是否成功
        """
        try:
            if not checkpoints_to_process:
                logger.warning("没有需要处理的checkpoint，跳过聊天历史回滚")
                return True

            # 使用第一个 checkpoint 的 initial 快照（代表 target 执行后的状态）
            first_checkpoint_id = checkpoints_to_process[0]
            logger.info(f"执行反向聊天历史回滚，使用 checkpoint {first_checkpoint_id} 的 initial 快照")

            snapshot_dir = self.storage.get_initial_chat_history_snapshots_dir(first_checkpoint_id)

            if not snapshot_dir.exists():
                logger.warning(f"checkpoint {first_checkpoint_id} 没有 initial 聊天历史快照，跳过历史回滚")
                return True

            success = await self.chat_history_snapshot_manager.restore_from_initial_chat_history(snapshot_dir)
            if success:
                logger.info(f"反向聊天历史回滚成功，已恢复到 checkpoint {first_checkpoint_id} 的 initial 状态")
            else:
                logger.error(f"反向聊天历史回滚失败: {first_checkpoint_id}")
            return success

        except Exception as e:
            logger.error(f"反向聊天历史回滚失败: {e}")
            return False

    async def _execute_forward_chat_history_rollback(self, checkpoints_to_process: List[str]) -> bool:
        """
        执行正向聊天历史回滚

        使用 checkpoints_to_process[-1] 的 latest 快照恢复到目标状态
        （checkpoints_to_process[-1] 就是 target，其 latest 代表 target 执行后的状态）

        Args:
            checkpoints_to_process: 需要处理的 checkpoint ID 列表

        Returns:
            bool: 恢复是否成功
        """
        try:
            if not checkpoints_to_process:
                logger.warning("没有需要处理的checkpoint，跳过聊天历史回滚")
                return True

            # 使用最后一个 checkpoint 的 latest 快照（就是 target 的 latest）
            last_checkpoint_id = checkpoints_to_process[-1]
            logger.info(f"执行正向聊天历史回滚，使用 checkpoint {last_checkpoint_id} 的 latest 快照")

            snapshot_dir = self.storage.get_latest_chat_history_snapshots_dir(last_checkpoint_id)

            if not snapshot_dir.exists():
                logger.warning(f"checkpoint {last_checkpoint_id} 没有 latest 聊天历史快照，跳过历史回滚")
                return True

            success = await self.chat_history_snapshot_manager.restore_from_latest_chat_history(snapshot_dir)
            if success:
                logger.info(f"正向聊天历史回滚成功，已恢复到 checkpoint {last_checkpoint_id} 的 latest 状态")
            else:
                logger.error(f"正向聊天历史回滚失败: {last_checkpoint_id}")
            return success

        except Exception as e:
            logger.error(f"正向聊天历史回滚失败: {e}")
            return False

    async def commit_rollback(self) -> bool:
        """
        提交回滚操作，清理当前checkpoint之后的所有checkpoint

        Returns:
            bool: 提交是否成功
        """
        try:
            # 获取当前checkpoint
            current_checkpoint_id = await self.metadata_manager.get_current_checkpoint()
            if current_checkpoint_id is None:
                logger.warning("无法获取当前checkpoint，跳过清理操作")
                return True

            logger.info(f"开始清理checkpoint {current_checkpoint_id} 之后的所有checkpoint")

            # 获取需要清理的checkpoint列表
            manifest = await self.metadata_manager.load_checkpoint_manifest()
            if not manifest:
                logger.warning("无法加载checkpoint清单，跳过清理操作")
                return True

            # 找到当前checkpoint在清单中的位置
            checkpoint_ids = list(manifest.checkpoints.keys()) if hasattr(manifest.checkpoints, 'keys') else manifest.checkpoints
            try:
                current_index = checkpoint_ids.index(current_checkpoint_id)
            except ValueError:
                logger.error(f"当前checkpoint {current_checkpoint_id} 不在清单中")
                return False

            # 获取需要删除的checkpoint（当前checkpoint之后的所有checkpoint）
            checkpoints_to_delete = checkpoint_ids[current_index + 1:]

            if not checkpoints_to_delete:
                logger.info("没有需要清理的checkpoint")
                return True

            logger.info(f"将删除以下checkpoint: {checkpoints_to_delete}")

            # 删除checkpoint数据和元数据
            for checkpoint_id in checkpoints_to_delete:
                # 删除checkpoint存储数据
                checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
                if checkpoint_dir.exists():
                    await async_rmtree(checkpoint_dir)
                    logger.info(f"已删除checkpoint存储目录: {checkpoint_id}")

                # 从清单中移除
                if hasattr(manifest.checkpoints, 'keys'):
                    if checkpoint_id in manifest.checkpoints:
                        del manifest.checkpoints[checkpoint_id]
                        logger.info(f"已从清单中移除checkpoint: {checkpoint_id}")
                else:
                    if checkpoint_id in manifest.checkpoints:
                        manifest.checkpoints.remove(checkpoint_id)
                        logger.info(f"已从清单中移除checkpoint: {checkpoint_id}")

            # 保存更新后的清单
            manifest.updated_time = datetime.now()
            manifest_file = self.storage.get_checkpoint_manifest_file_path()
            await async_write_json(manifest_file, manifest.model_dump(), ensure_ascii=False, indent=2, default=str)

            logger.info(f"成功清理了 {len(checkpoints_to_delete)} 个checkpoint")

            return True

        except Exception as e:
            logger.error(f"提交回滚操作失败: {e}")
            return False

    async def undo_rollback(self, latest_checkpoint_id: str) -> bool:
        """
        执行撤回回滚操作

        这是对 start_rollback 的封装，专门用于撤回回滚场景，
        提供更清晰的语义和更详细的日志记录。

        Args:
            latest_checkpoint_id: 最新的 checkpoint ID，不能为None

        Returns:
            bool: 撤回回滚是否成功
        """
        try:
            logger.info(f"开始执行撤回回滚到最新checkpoint: {latest_checkpoint_id}")


            # 验证前置条件
            await self._validate_undo_rollback_preconditions(latest_checkpoint_id)

            # 获取当前checkpoint状态
            current_checkpoint_id = await self.metadata_manager.get_current_checkpoint()

            # 检查是否需要撤回回滚
            if current_checkpoint_id == latest_checkpoint_id:
                logger.info(f"当前checkpoint与最新checkpoint相同，无需撤回回滚: {latest_checkpoint_id}")
                return True

            logger.info(f"撤回回滚：从 {current_checkpoint_id} 到 {latest_checkpoint_id}")

            # 调用现有的 start_rollback 方法执行实际的回滚操作
            success = await self.start_rollback(latest_checkpoint_id)

            if success:
                logger.info(f"撤回回滚执行成功: {latest_checkpoint_id}")
            else:
                logger.error(f"撤回回滚执行失败: {latest_checkpoint_id}")

            return success

        except Exception as e:
            logger.error(f"撤回回滚执行时发生错误: {e}")
            return False

    async def _validate_undo_rollback_preconditions(self, latest_checkpoint_id: str) -> None:
        """
        验证撤回回滚的前置条件

        Args:
            latest_checkpoint_id: 最新的 checkpoint ID

        Raises:
            RollbackException: 当前置条件不满足时抛出
        """
        try:
            # 验证目标checkpoint是否存在
            manifest = await self.metadata_manager.load_checkpoint_manifest()
            if not manifest or latest_checkpoint_id not in manifest.checkpoints:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND,
                                       f"目标checkpoint不存在: {latest_checkpoint_id}")

            # 验证目标checkpoint确实是最新的
            if manifest.checkpoints[-1] != latest_checkpoint_id:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR,
                                       f"指定的checkpoint不是最新的: {latest_checkpoint_id}")

            # 验证当前checkpoint状态
            current_checkpoint_id = await self.metadata_manager.get_current_checkpoint()
            if not current_checkpoint_id:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND,
                                       "当前checkpoint状态未设置")

            logger.info(f"撤回回滚前置条件验证通过: {current_checkpoint_id} -> {latest_checkpoint_id}")

        except RollbackException:
            raise
        except Exception as e:
            logger.error(f"验证撤回回滚前置条件失败: {e}")
            raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, f"前置条件验证失败: {str(e)}")

    async def _restore_file_by_operation(self, checkpoint_id: str, file_snapshot: FileSnapshot,
                                  is_forward: bool) -> bool:
        """根据operation类型和回滚方向智能恢复文件

        Args:
            checkpoint_id: checkpoint ID
            file_snapshot: 文件快照信息
            is_forward: True=正向回滚(应用操作), False=反向回滚(撤销操作)

        Returns:
            bool: 恢复是否成功
        """
        operation = file_snapshot.operation
        file_path = file_snapshot.file_path
        rollback_direction = "正向" if is_forward else "反向"

        logger.info(f"开始operation感知恢复: {file_path}, operation={operation.value}, 回滚方向={rollback_direction}")

        try:
            if is_forward:
                # 正向回滚：应用操作的结果
                if operation == FileOperation.CREATED:
                    return await self._restore_created_file_forward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.UPDATED:
                    return await self._restore_updated_file_forward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.DELETED:
                    return await self._restore_deleted_file_forward(checkpoint_id, file_snapshot)
            else:
                # 反向回滚：撤销操作的结果
                if operation == FileOperation.CREATED:
                    return await self._restore_created_file_backward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.UPDATED:
                    return await self._restore_updated_file_backward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.DELETED:
                    return await self._restore_deleted_file_backward(checkpoint_id, file_snapshot)

            logger.error(f"未知的文件操作类型: {operation}")
            return False

        except Exception as e:
            logger.error(f"operation感知恢复失败 {file_path}: {e}")
            return False

    async def _restore_created_file_forward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """CREATED操作的正向回滚：创建文件（应用创建操作）"""
        try:
            target_path = Path(file_snapshot.file_path)

            # 根据文件类型选择创建方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从latest_content恢复
                path_hash = self._calculate_path_hash(file_snapshot.file_path)
                latest_content_path = self.storage.get_latest_content_file_path(checkpoint_id, path_hash)

                if not latest_content_path.exists():
                    logger.warning(f"CREATED操作的latest_content不存在，跳过文件恢复: {file_snapshot.file_path}")
                    return True

                # 确保目标目录存在
                await async_mkdir(target_path.parent, parents=True, exist_ok=True)

                # 复制latest_content到目标位置
                await async_copy2(latest_content_path, target_path)
                logger.info(f"CREATED操作正向回滚成功，创建文件: {file_snapshot.file_path}")

            elif file_snapshot.file_type == FileType.DIRECTORY:
                # 目录：直接创建目录
                await async_mkdir(target_path, parents=True, exist_ok=True)
                logger.info(f"CREATED操作正向回滚成功，创建目录: {file_snapshot.file_path}")

            else:
                logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                return False

            return True

        except Exception as e:
            logger.error(f"CREATED操作正向回滚失败: {e}")
            return False

    async def _restore_created_file_backward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """CREATED操作的反向回滚：删除文件（撤销创建操作）"""
        try:
            target_path = Path(file_snapshot.file_path)

            if target_path.exists():
                # 根据文件类型选择删除方法
                if file_snapshot.file_type == FileType.FILE:
                    await async_unlink(target_path)  # 删除文件
                    logger.info(f"CREATED操作反向回滚成功，删除文件: {file_snapshot.file_path}")
                elif file_snapshot.file_type == FileType.DIRECTORY:
                    # 检查目录是否为空
                    if any(target_path.iterdir()):
                        # 非空目录，使用 rmtree
                        await async_rmtree(target_path)
                        logger.info(f"CREATED操作反向回滚成功，删除非空目录: {file_snapshot.file_path}")
                    else:
                        # 空目录，使用 rmdir
                        await async_rmdir(target_path)
                        logger.info(f"CREATED操作反向回滚成功，删除空目录: {file_snapshot.file_path}")
                else:
                    logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                    return False
            else:
                logger.info(f"CREATED操作反向回滚，路径已不存在: {file_snapshot.file_path}")

            return True

        except Exception as e:
            logger.error(f"CREATED操作反向回滚失败: {e}")
            return False

    async def _restore_updated_file_forward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """UPDATED操作的正向回滚：恢复到更新后状态"""
        try:
            target_path = Path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从latest_content恢复
                path_hash = self._calculate_path_hash(file_snapshot.file_path)
                latest_content_path = self.storage.get_latest_content_file_path(checkpoint_id, path_hash)

                if not latest_content_path.exists():
                    logger.warning(f"UPDATED操作的latest_content不存在，跳过文件恢复: {file_snapshot.file_path}")
                    return True

                # 确保目标目录存在
                await async_mkdir(target_path.parent, parents=True, exist_ok=True)

                # 复制latest_content到目标位置
                await async_copy2(latest_content_path, target_path)
                logger.info(f"UPDATED操作正向回滚成功，恢复到更新后状态: {file_snapshot.file_path}")

            elif file_snapshot.file_type == FileType.DIRECTORY:
                # 目录：UPDATED操作对目录无意义，确保目录存在即可
                await async_mkdir(target_path, parents=True, exist_ok=True)
                logger.info(f"UPDATED操作正向回滚成功，确保目录存在: {file_snapshot.file_path}")

            else:
                logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                return False

            return True

        except Exception as e:
            logger.error(f"UPDATED操作正向回滚失败: {e}")
            return False

    async def _restore_updated_file_backward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """UPDATED操作的反向回滚：恢复到更新前状态"""
        try:
            target_path = Path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从initial_content恢复
                path_hash = self._calculate_path_hash(file_snapshot.file_path)
                initial_content_path = self.storage.get_initial_content_file_path(checkpoint_id, path_hash)

                if not initial_content_path.exists():
                    logger.error(f"UPDATED操作的initial_content不存在: {file_snapshot.file_path}")
                    return False

                # 确保目标目录存在
                await async_mkdir(target_path.parent, parents=True, exist_ok=True)

                # 复制initial_content到目标位置
                await async_copy2(initial_content_path, target_path)
                logger.info(f"UPDATED操作反向回滚成功，恢复到更新前状态: {file_snapshot.file_path}")

            elif file_snapshot.file_type == FileType.DIRECTORY:
                # 目录：UPDATED操作对目录无意义，确保目录存在即可
                await async_mkdir(target_path, parents=True, exist_ok=True)
                logger.info(f"UPDATED操作反向回滚成功，确保目录存在: {file_snapshot.file_path}")

            else:
                logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                return False

            return True

        except Exception as e:
            logger.error(f"UPDATED操作反向回滚失败: {e}")
            return False

    async def _restore_deleted_file_forward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """DELETED操作的正向回滚：删除文件（应用删除操作）"""
        try:
            target_path = Path(file_snapshot.file_path)

            if target_path.exists():
                # 根据文件类型选择删除方法
                if file_snapshot.file_type == FileType.FILE:
                    await async_unlink(target_path)
                    logger.info(f"DELETED操作正向回滚成功，删除文件: {file_snapshot.file_path}")
                elif file_snapshot.file_type == FileType.DIRECTORY:
                    # 检查目录是否为空
                    if any(target_path.iterdir()):
                        # 非空目录，使用 rmtree
                        await async_rmtree(target_path)
                        logger.info(f"DELETED操作正向回滚成功，删除非空目录: {file_snapshot.file_path}")
                    else:
                        # 空目录，使用 rmdir
                        await async_rmdir(target_path)
                        logger.info(f"DELETED操作正向回滚成功，删除空目录: {file_snapshot.file_path}")
                else:
                    logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                    return False
            else:
                logger.info(f"DELETED操作正向回滚，路径已不存在: {file_snapshot.file_path}")

            return True

        except Exception as e:
            logger.error(f"DELETED操作正向回滚失败: {e}")
            return False

    async def _restore_deleted_file_backward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """DELETED操作的反向回滚：恢复文件（撤销删除操作）"""
        try:
            target_path = Path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从initial_content恢复
                path_hash = self._calculate_path_hash(file_snapshot.file_path)
                initial_content_path = self.storage.get_initial_content_file_path(checkpoint_id, path_hash)

                if not initial_content_path.exists():
                    logger.error(f"DELETED操作的initial_content不存在: {file_snapshot.file_path}")
                    return False

                # 确保目标目录存在
                await async_mkdir(target_path.parent, parents=True, exist_ok=True)

                # 复制initial_content到目标位置
                await async_copy2(initial_content_path, target_path)
                logger.info(f"DELETED操作反向回滚成功，恢复文件: {file_snapshot.file_path}")

            elif file_snapshot.file_type == FileType.DIRECTORY:
                # 目录：直接重新创建目录
                await async_mkdir(target_path, parents=True, exist_ok=True)
                logger.info(f"DELETED操作反向回滚成功，恢复目录: {file_snapshot.file_path}")

            else:
                logger.error(f"未知的文件类型: {file_snapshot.file_type}")
                return False

            return True

        except Exception as e:
            logger.error(f"DELETED操作反向回滚失败: {e}")
            return False

    async def get_files_for_version_creation(self, current_checkpoint_id: Optional[str], target_checkpoint_id: str) -> List[str]:
        """
        获取需要创建版本的文件路径列表

        Args:
            current_checkpoint_id: 当前checkpoint ID
            target_checkpoint_id: 目标checkpoint ID

        Returns:
            List[str]: 需要创建版本的文件路径列表
            - 正向回滚：排除DELETE操作的文件（这些文件会被删除）
            - 反向回滚：排除CREATE操作的文件（这些文件会被删除）
        """
        try:
            logger.info(f"开始获取需要创建版本的文件列表: {current_checkpoint_id} -> {target_checkpoint_id}")

            # 使用现有的metadata_manager获取checkpoint范围和方向
            direction, checkpoints_to_process = await self.metadata_manager.get_checkpoints_between_in_checkpoint_manifest(
                current_checkpoint_id, target_checkpoint_id
            )

            if direction == "none":
                logger.info("当前checkpoint与目标checkpoint相同，无文件需要创建版本")
                return []

            # 获取合并后的文件操作
            merged_operations = await self._merge_file_snapshots_for_rollback(
                checkpoints_to_process,
                is_forward=(direction == "forward")
            )

            # 根据回滚方向和操作类型过滤文件
            files_for_version = []
            for checkpoint_id, file_snapshot in merged_operations:
                should_create_version = False

                if direction == "forward":
                    # 正向回滚：DELETE 操作的文件不需要版本（会被删除）
                    should_create_version = file_snapshot.operation != FileOperation.DELETED
                elif direction == "backward":
                    # 反向回滚：CREATE 操作的文件不需要版本（会被删除）
                    should_create_version = file_snapshot.operation != FileOperation.CREATED

                if should_create_version:
                    files_for_version.append(file_snapshot.file_path)
                    logger.debug(f"添加文件到版本创建列表: {file_snapshot.file_path} (operation: {file_snapshot.operation.value}, direction: {direction})")
                else:
                    logger.debug(f"跳过文件: {file_snapshot.file_path} (operation: {file_snapshot.operation.value}, direction: {direction})")

            logger.info(f"获取到需要创建版本的文件数量: {len(files_for_version)}")
            return files_for_version

        except Exception as e:
            logger.error(f"获取需要创建版本的文件列表失败: {e}")
            return []

    def _validate_files_for_version_creation(self, file_paths: List[str]) -> bool:
        """
        验证文件列表的有效性

        Args:
            file_paths: 文件路径列表

        Returns:
            bool: 是否有效
        """
        if not file_paths:
            return True

        valid_count = 0
        for file_path in file_paths:
            if isinstance(file_path, str) and file_path.strip():
                valid_count += 1
            else:
                logger.warning(f"发现无效的文件路径: {file_path}")

        logger.debug(f"文件路径验证结果: {valid_count}/{len(file_paths)} 个有效")
        return valid_count == len(file_paths)
