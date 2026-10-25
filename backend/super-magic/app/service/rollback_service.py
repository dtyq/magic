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
from pathlib import Path
from typing import List, Dict, Optional
from app.core.entity.checkpoint import CheckpointActivity
from app.service.checkpoint_service import CheckpointService
from app.infrastructure.checkpoint.rollback_executor import RollbackExecutor
from app.infrastructure.checkpoint.remote_sync import CheckpointRemoteSync
from app.core.entity.checkpoint import CheckpointInfo, FileOperation, VirtualCheckpoint
from app.service.file_version_service import FileVersionService
from app.infrastructure.magic_service.constants import FileEditType
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader, ConfigurationError
from app.infrastructure.storage.factory import StorageFactory
from app.path_manager import PathManager
from app.utils.async_file_utils import async_exists, get_s3_key_from_xattr
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

    async def _reload_main_agent_persistent_state(self) -> None:
        """将磁盘上刚被回滚覆盖的 ChatHistory 和 Horizon 重新加载到内存。

        checkpoint 会覆盖整个持久目录，但主 Agent 进程内常驻的 ChatHistory
        和 Horizon 都不会主动重读。只刷新其中一个，另一个后续保存时仍可能
        用回滚前的内存状态覆盖目标 checkpoint。

        仅在 commit_rollback 的成功路径上调用：
        - start_rollback 之后必然走 commit 或 undo，中间不会触发 agent.run，
          不需要在 start 里 reload。
        - undo_rollback 的语义本身就是把磁盘恢复成内存当前所在的 latest
          状态，内存与磁盘天然一致，不需要 reload。

        主 Agent 尚未创建（例如回滚发生在会话首次启动前）时，Runtime
        没有缓存实例，直接跳过即可；reload 失败不应影响
        回滚主流程成功的语义，因此这里只记日志不抛错。
        """
        # 局部 import 避免与 agent_dispatcher 的模块级循环依赖
        from app.service.agent_dispatcher import AgentDispatcher
        from app.service.agent_runtime import AgentRuntime

        dispatcher = AgentDispatcher.get_instance()
        agent_context = dispatcher.agent_context
        if agent_context is None:
            logger.debug("主 Agent 尚未创建，跳过持久状态内存重载")
            return

        agent = AgentRuntime.get_instance().get_cached_agent(agent_context.context_id)
        if agent is None:
            logger.debug("主 Agent 尚未创建，跳过持久状态内存重载")
            return

        try:
            await agent.chat_history.reload_from_disk()
            await agent_context.horizon.reload_from_store()
            logger.info(f"已从磁盘重新加载 ChatHistory 和 Horizon: agent_type={agent.agent_name}")
        except Exception as e:
            logger.error(
                f"从磁盘重新加载持久状态失败 (agent_type={agent.agent_name}): {e}",
                exc_info=True,
            )

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

    async def _build_remote_sync_context(self):
        """从主 Agent 上下文构造 (storage_service, topic_id)。

        沙箱重启后本地可能只有 manifest，回滚前需要按需拉取远端 checkpoint 归档，
        提交/撤回回滚后需要同步远端 manifest。主 Agent 未创建或缺少 topic_id 时
        返回 (None, None)，调用方应跳过远端操作。

        Returns:
            Tuple[Optional[Any], Optional[str]]: (storage_service, topic_id)
        """
        try:
            from app.service.agent_dispatcher import AgentDispatcher

            dispatcher = AgentDispatcher.get_instance()
            agent_context = dispatcher.agent_context
            if agent_context is None:
                logger.debug("主 Agent 尚未创建，跳过远端 checkpoint 同步")
                return None, None

            metadata = agent_context.get_metadata()
            topic_id = metadata.get("topic_id") or metadata.get("chat_topic_id")
            if not topic_id:
                logger.warning("无法获取 topic_id，跳过远端 checkpoint 同步")
                return None, None

            sts_token_refresh = agent_context.get_init_client_message_sts_token_refresh()
            platform_type = agent_context.get_init_client_message_platform_type()
            storage_service = await StorageFactory.get_storage(
                sts_token_refresh=sts_token_refresh,
                metadata=metadata,
                platform=platform_type,
            )
            return storage_service, topic_id
        except Exception as e:
            logger.error(f"构造远端 checkpoint 同步上下文失败: {e}")
            return None, None

    async def _sync_remote_manifest(self) -> None:
        """提交/撤回回滚后同步远端 manifest，让被丢弃的未来分支立即从远端移除。

        回滚本身只改本地磁盘与本地 manifest；不主动同步的话，远端会停留在
        「回滚未提交」的状态，直到下一次消息轮次上传才被纠正。
        """
        try:
            storage_service, topic_id = await self._build_remote_sync_context()
            if storage_service is None or not topic_id:
                return
            await CheckpointRemoteSync(storage_service, topic_id).sync_manifest_and_evicted()
        except Exception as e:
            logger.error(f"同步远端 checkpoint manifest 失败: {e}")

    async def _ensure_rollback_checkpoints_available(
        self,
        storage_service,
        topic_id: Optional[str],
        current_checkpoint_id: Optional[str],
        target_checkpoint_id: str,
    ) -> None:
        """回滚前确保「当前位与目标之间」的 checkpoint 在本地可用。

        沙箱重启后本地可能只有 manifest，checkpoint 数据在需要回滚时按需
        从远端拉取对应归档。topic_id 是回滚定位远端归档的必需字段，只在
        上下文缺失（主 Agent 未创建）时跳过拉取。
        """
        if storage_service is None or not topic_id:
            return
        _, checkpoints_to_process = await self.checkpoint_service.metadata_manager.get_checkpoints_between_in_checkpoint_manifest(
            current_checkpoint_id, target_checkpoint_id
        )
        if checkpoints_to_process:
            await CheckpointRemoteSync(storage_service, topic_id).ensure_checkpoints_available(
                checkpoints_to_process
            )

    async def start_rollback(self, target_message_id: str) -> List[Dict[str, str]]:
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

            # 沙箱重启后本地可能只有 manifest，回滚前按需拉取范围内缺失的 checkpoint 数据
            storage_service, topic_id = await self._build_remote_sync_context()
            await self._ensure_rollback_checkpoints_available(
                storage_service, topic_id, current_checkpoint_id, actual_target_checkpoint_id
            )

            # 通知 agfs 侧：回滚期间 activity=rollback，checkpoint hook 跳过记账，
            # 避免把重放恢复的内容当作新用户改动回灌进快照
            await self.checkpoint_service.metadata_manager.set_activity(CheckpointActivity.ROLLBACK)
            try:
                # 执行回滚到实际目标checkpoint
                success, affected_files = await self.rollback_executor.start_rollback(actual_target_checkpoint_id)
            finally:
                await self.checkpoint_service.metadata_manager.set_activity(CheckpointActivity.IDLE)
            if not success:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, "回滚执行失败")
            logger.info(f"开始回滚成功完成: {target_message_id}")

            # 回滚位置必须同步到远端，否则沙箱重启后恢复的是过期 manifest，
            # 会让后续「撤回回滚」被误判为已是最新状态而空转。
            await self._sync_remote_manifest()

            # 注意：这里不需要 reload 主 Agent 的内存 chat_history。
            # start_rollback 之后产品上必然走 commit_rollback 或 undo_rollback，
            # 中间不会触发 agent.run 把陈旧内存写回磁盘；commit 里统一 reload 即可。

            # 在回滚成功后创建文件版本
            try:
                await self._create_file_versions_after_rollback(current_checkpoint_id, actual_target_checkpoint_id)
            except Exception as version_error:
                # 版本创建失败不应该影响回滚操作
                logger.error(f"文件版本创建失败，但回滚操作已成功: {version_error}")

            return affected_files
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

            await self.checkpoint_service.discard_future_checkpoints()

            logger.info("回滚提交成功完成")

            # start_rollback 已经用目标 checkpoint 覆盖持久目录，但内存中的
            # ChatHistory 和 Horizon 都需要切换到同一代状态。
            # 另一条终态路径 undo_rollback 天然一致（内存=磁盘=latest），
            # 因此只需要在 commit 这一个点 reload。
            await self._reload_main_agent_persistent_state()

            # 同步远端 manifest，让被丢弃的未来分支立即从远端移除
            await self._sync_remote_manifest()

        except RollbackException:
            raise
        except Exception as e:
            logger.error(f"提交回滚过程中发生错误: {e}")
            raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, f"提交回滚过程中发生未知错误: {str(e)}")

    async def undo_rollback(self) -> List[Dict[str, str]]:
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
                return []

            # 4. 执行撤回回滚到最新 checkpoint
            logger.info(f"开始撤回回滚到最新checkpoint: {latest_checkpoint_id}")
            # 沙箱重启后本地可能只有 manifest，回滚前按需拉取范围内缺失的 checkpoint 数据
            storage_service, topic_id = await self._build_remote_sync_context()
            await self._ensure_rollback_checkpoints_available(
                storage_service, topic_id, current_checkpoint_id, latest_checkpoint_id
            )
            # 通知 agfs 侧：回滚期间 activity=rollback，checkpoint hook 跳过记账
            await self.checkpoint_service.metadata_manager.set_activity(CheckpointActivity.ROLLBACK)
            try:
                success, affected_files = await self.rollback_executor.undo_rollback(latest_checkpoint_id)
            finally:
                await self.checkpoint_service.metadata_manager.set_activity(CheckpointActivity.IDLE)
            if not success:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, "撤回回滚执行失败")

            # 注意：这里不需要 reload 主 Agent 的内存 chat_history。
            # undo_rollback 的语义就是把磁盘恢复成内存当前所在的 latest 状态，
            # 而内存自 agent 启动以来就一直是 latest（load() 幂等未被改写），
            # 因此 undo 完成后内存与磁盘天然一致，无需额外 reload。

            # 5. 在撤回回滚成功后创建文件版本
            try:
                await self._create_file_versions_after_rollback(current_checkpoint_id, latest_checkpoint_id)
            except Exception as version_error:
                # 版本创建失败不应该影响回滚操作
                logger.error(f"文件版本创建失败，但撤回回滚操作已成功: {version_error}")

            # 同步远端 manifest，让被丢弃的未来分支立即从远端移除
            await self._sync_remote_manifest()

            logger.info(f"撤回回滚成功完成，当前checkpoint: {latest_checkpoint_id}")
            return affected_files

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
            # 将文件路径归一化为本地绝对路径，过滤不存在的文件
            absolute_paths = []
            for file_path in file_paths:
                path_obj = Path(file_path)
                if path_obj.is_absolute():
                    # 绝对路径 = referenced-projects 跨项目挂载文件（agent 视角路径）。
                    # 版本创建按 file_key（s3_key xattr）定位文件，版本天然落在文件
                    # 所属项目名下，不依赖本地项目上下文，因此无需跳过；
                    # 文件不存在或无 xattr 时下游已有优雅降级。
                    local_path = path_obj
                else:
                    local_path = PathManager.get_workspace_dir() / file_path.lstrip("/")
                if await async_exists(local_path):
                    absolute_paths.append(str(local_path))
                else:
                    logger.warning(f"文件不存在，跳过: {local_path}")

            if not absolute_paths:
                logger.info("没有有效的文件，跳过文件版本创建")
                return

            # 调用FileVersionService的公共方法创建版本
            result = await self.file_version_service.create_file_versions(absolute_paths, edit_type=FileEditType.AI)

            # 记录结果
            if result["success"]:
                logger.info(f"文件版本创建完成: {result['success_count']}/{result['total_count']} 个文件成功")
            else:
                logger.error(f"文件版本创建失败: {result['success_count']}/{result['total_count']} 个文件成功")
                if result["failed_files"]:
                    logger.error(f"失败的文件: {result['failed_files']}")

        except Exception as e:
            logger.error(f"异步创建文件版本失败: {e}")
