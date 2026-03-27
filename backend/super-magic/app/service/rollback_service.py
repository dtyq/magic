# -*- coding: utf-8 -*-
"""
文件回滚业务服务

这个模块提供文件回滚相关的业务服务，包括：
- 回滚到指定checkpoint状态
- 分析回滚操作
- 清理回滚后的checkpoint记录
- 提供回滚预览功能
"""

import asyncio
from typing import List, Dict, Optional
from app.service.checkpoint_service import CheckpointService
from app.infrastructure.checkpoint.rollback_executor import RollbackExecutor
from app.core.entity.checkpoint import CheckpointInfo, FileOperation, VirtualCheckpoint
from app.service.file_version_service import FileVersionService
from app.infrastructure.magic_service.constants import FileEditType
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader, ConfigurationError
from app.infrastructure.storage.base import BaseFileProcessor
from app.utils.init_client_message_util import InitClientMessageUtil
from app.path_manager import PathManager
from agentlang.logger import get_logger
from app.core.exceptions import RollbackException, ErrorCode

logger = get_logger(__name__)


class RollbackService:
    """文件回滚业务服务"""

    def __init__(self):
        self.checkpoint_service = CheckpointService()
        self.rollback_executor = RollbackExecutor()
        # 添加文件版本服务
        self.file_version_service = FileVersionService()

    async def _get_previous_checkpoint(self, checkpoint_id: str) -> Optional[str]:
        """获取指定checkpoint的前一个checkpoint（支持虚拟checkpoint）

        Args:
            checkpoint_id: 目标checkpoint ID

        Returns:
            Optional[str]: 前一个checkpoint ID，如果是第一个则返回None
        """
        try:
            # 使用metadata_manager的新方法
            return await self.checkpoint_service.metadata_manager.get_previous_checkpoint_in_checkpoint_manifest(checkpoint_id)

        except Exception as e:
            logger.error(f"获取前一个checkpoint失败: {e}")
            return None

    async def start_rollback(self, target_message_id: str) -> None:
        """开始回滚到指定消息的执行前状态

        Args:
            target_message_id: 目标checkpoint ID，必须是有效的checkpoint

        Raises:
            RollbackException: 当回滚操作失败时抛出

        Note:
            此操作只恢复文件状态，不删除checkpoint记录
            需要调用commit_rollback来完成完整的回滚操作
        """
        # 参数验证
        if not target_message_id or not isinstance(target_message_id, str):
            raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND, "目标checkpoint ID不能为空")

        try:
            logger.info(f"开始回滚到消息执行前状态: {target_message_id}")

            # 真实checkpoint：获取前一个checkpoint
            actual_target_checkpoint_id = await self._get_previous_checkpoint(target_message_id)
            if actual_target_checkpoint_id is None:
                # 如果没有前一个checkpoint，这是不允许的
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND,
                                        f"无法回滚到checkpoint {target_message_id} 的执行前状态，因为它是最早的checkpoint")
            logger.info(f"实际回滚目标: {actual_target_checkpoint_id} (消息{target_message_id}的执行前状态)")

            # 获取当前checkpoint状态（用于版本创建）
            current_checkpoint_id = await self.checkpoint_service.metadata_manager.get_current_checkpoint()

            # 执行回滚到实际目标checkpoint
            await self.rollback_executor.start_rollback(actual_target_checkpoint_id)
            logger.info(f"开始回滚成功完成: {target_message_id}")

            # 在回滚成功后创建文件版本
            try:
                await self._create_file_versions_after_rollback(current_checkpoint_id, actual_target_checkpoint_id)
            except Exception as version_error:
                # 版本创建失败不应该影响回滚操作
                logger.error(f"文件版本创建失败，但回滚操作已成功: {version_error}")
        except RollbackException:
            raise
        except Exception as e:
            logger.error(f"回滚过程中发生错误: {e}")
            raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, f"回滚过程中发生未知错误: {str(e)} (原始错误: {str(e)})")

    async def commit_rollback(self) -> None:
        """提交回滚操作，清理当前checkpoint之后的所有checkpoint

        Raises:
            RollbackException: 当提交回滚操作失败时抛出

        Note:
            此操作会永久删除当前checkpoint之后的所有checkpoint记录
            调用此方法前应确保已经执行了start_rollback操作
        """
        try:
            logger.info("开始提交回滚操作，清理后续checkpoint")

            # 执行checkpoint清理
            success = await self.rollback_executor.commit_rollback()
            if not success:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, "提交回滚操作失败")

            logger.info("回滚提交成功完成")

        except RollbackException:
            raise
        except Exception as e:
            logger.error(f"提交回滚过程中发生错误: {e}")
            raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, f"提交回滚过程中发生未知错误: {str(e)}")

    async def undo_rollback(self) -> None:
        """撤回回滚操作，将 current_checkpoint_id 恢复到最新的 checkpoint

        将系统状态从当前 checkpoint 恢复到 checkpoints 列表中的最后一个 checkpoint。
        这个操作用于撤销之前的回滚操作。

        示例：
        - 当前状态：checkpoints=[c1,c2,c3,c4], current_checkpoint_id=c2
        - 执行撤回回滚后：current_checkpoint_id=c4

        Raises:
            RollbackException: 当撤回回滚操作失败时抛出

        Note:
            如果当前已经是最新状态，则不执行任何操作
        """
        try:
            logger.info("开始执行撤回回滚操作")

            # 1. 获取当前 checkpoint 清单
            manifest = await self.checkpoint_service.metadata_manager.load_checkpoint_manifest()
            if not manifest or not manifest.checkpoints:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND, "checkpoint清单为空或不存在")

            current_checkpoint_id = manifest.current_checkpoint_id
            if not current_checkpoint_id:
                raise RollbackException(ErrorCode.CHECKPOINT_NOT_FOUND, "当前checkpoint状态未设置")

            # 2. 获取最新的 checkpoint（列表中的最后一个）
            latest_checkpoint_id = manifest.checkpoints[-1]
            logger.info(f"当前checkpoint: {current_checkpoint_id}, 最新checkpoint: {latest_checkpoint_id}")

            # 3. 检查是否需要撤回回滚
            if current_checkpoint_id == latest_checkpoint_id:
                logger.info("当前已经是最新状态，无需撤回回滚")
                return

            # 4. 执行撤回回滚到最新 checkpoint
            logger.info(f"开始撤回回滚到最新checkpoint: {latest_checkpoint_id}")
            success = await self.rollback_executor.undo_rollback(latest_checkpoint_id)
            if not success:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, "撤回回滚执行失败")

            # 5. 在撤回回滚成功后创建文件版本
            try:
                await self._create_file_versions_after_rollback(current_checkpoint_id, latest_checkpoint_id)
            except Exception as version_error:
                # 版本创建失败不应该影响回滚操作
                logger.error(f"文件版本创建失败，但撤回回滚操作已成功: {version_error}")

            logger.info(f"撤回回滚成功完成，当前checkpoint: {latest_checkpoint_id}")

        except RollbackException:
            raise
        except Exception as e:
            logger.error(f"撤回回滚过程中发生错误: {e}")
            raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, f"撤回回滚过程中发生未知错误: {str(e)}")

    async def _create_file_versions_after_rollback(self, current_checkpoint_id: Optional[str], target_checkpoint_id: str) -> None:
        """
        在回滚后创建文件版本

        Args:
            current_checkpoint_id: 回滚前的checkpoint ID
            target_checkpoint_id: 回滚后的checkpoint ID
        """
        try:
            logger.info("开始为回滚相关文件创建版本")

            # 获取需要创建版本的文件列表
            files_for_version = await self.rollback_executor.get_files_for_version_creation(
                current_checkpoint_id, target_checkpoint_id
            )

            if not files_for_version:
                logger.info("没有文件需要创建版本")
                return

            logger.info(f"准备为 {len(files_for_version)} 个文件创建版本")

            # 直接调用异步版本创建方法，不使用 asyncio.run()
            await self._create_versions_for_files(files_for_version)

        except Exception as e:
            logger.error(f"创建文件版本过程中发生错误: {e}")
            # 不重新抛出异常，避免影响回滚主流程

    async def _create_versions_for_files(self, file_paths: List[str]) -> None:
        """
        为指定文件列表创建版本（异步方法）

        Args:
            file_paths: 文件路径列表
        """
        try:
            # 将文件路径转换为file_key列表
            file_keys = []
            for file_path in file_paths:
                file_key = self._convert_file_path_to_file_key(file_path)
                if file_key:
                    file_keys.append(file_key)
                else:
                    logger.warning(f"无法转换文件路径为file_key，跳过: {file_path}")

            if not file_keys:
                logger.info("没有有效的file_key，跳过文件版本创建")
                return

            # 调用FileVersionService的公共方法创建版本
            result = await self.file_version_service.create_file_versions(file_keys, edit_type=FileEditType.AI)

            # 记录结果
            if result["success"]:
                logger.info(f"文件版本创建完成: {result['success_count']}/{result['total_count']} 个文件成功")
            else:
                logger.error(f"文件版本创建失败: {result['success_count']}/{result['total_count']} 个文件成功")
                if result["failed_files"]:
                    logger.error(f"失败的文件: {result['failed_files']}")

        except Exception as e:
            logger.error(f"异步创建文件版本失败: {e}")

    def _convert_file_path_to_file_key(self, file_path: str) -> Optional[str]:
        """
        将文件路径转换为OSS存储键

        Args:
            file_path: 本地文件绝对路径

        Returns:
            Optional[str]: OSS存储键，转换失败则返回None
        """
        try:
            # 获取本地工作空间目录
            local_workspace_dir = PathManager.get_workspace_dir()

            # 获取OSS工作空间目录
            oss_work_dir = InitClientMessageUtil.get_work_dir()
            if not oss_work_dir:
                logger.warning("无法获取OSS工作目录，跳过文件版本创建")
                return None

            # 计算相对路径
            relative_path = file_path.replace(str(local_workspace_dir), "").lstrip("/")

            # 构造file_key
            file_key = BaseFileProcessor.combine_path(oss_work_dir, relative_path)

            logger.debug(f"文件路径转换成功: {file_path} -> {file_key}")
            return file_key

        except Exception as e:
            logger.error(f"转换文件路径到file_key失败: {file_path}, 错误: {e}")
            return None
