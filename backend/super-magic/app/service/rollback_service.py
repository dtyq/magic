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
from app.service.checkpoint_service import CheckpointService
from app.infrastructure.checkpoint.rollback_executor import RollbackExecutor
from app.core.entity.checkpoint import CheckpointInfo, FileOperation, VirtualCheckpoint
from app.service.file_version_service import FileVersionService
from app.infrastructure.magic_service.constants import FileEditType
from app.infrastructure.magic_service.client import MagicServiceClient
from app.infrastructure.magic_service.config import MagicServiceConfigLoader, ConfigurationError
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

    async def _reload_main_agent_chat_history(self) -> None:
        """将磁盘上刚被回滚覆盖的聊天历史重新加载进主 Agent 的内存。

        checkpoint 回滚只能直接覆盖磁盘上的聊天历史文件；主 Agent 进程内
        常驻的 ChatHistory 实例因 load() 幂等保护不会主动重读磁盘，这会
        造成"内存中的历史仍是回滚前旧状态、但文件已是回滚后新状态"的
        错位。只要此后再追加一条新消息并落盘，旧的内存状态就会覆盖回
        滚结果（即用户看到的 revoke + commit + 新消息后，被撤回的那轮对
        话又复活）。

        仅在 commit_rollback 的成功路径上调用：
        - start_rollback 之后必然走 commit 或 undo，中间不会触发 agent.run，
          不需要在 start 里 reload。
        - undo_rollback 的语义本身就是把磁盘恢复成内存当前所在的 latest
          状态，内存与磁盘天然一致，不需要 reload。

        主 Agent 尚未创建（例如回滚发生在会话首次启动前）时，agents 为
        空，直接跳过即可；reload 过程中任何单个 Agent 失败都不应影响
        回滚主流程成功的语义，因此这里只记日志不抛错。
        """
        # 局部 import 避免与 agent_dispatcher 的模块级循环依赖
        from app.service.agent_dispatcher import AgentDispatcher

        dispatcher = AgentDispatcher.get_instance()
        agents = getattr(dispatcher, "agents", None) or {}
        if not agents:
            logger.debug("主 Agent 尚未创建，跳过聊天历史内存重载")
            return

        for agent_type, agent in agents.items():
            chat_history = getattr(agent, "chat_history", None)
            if chat_history is None:
                continue
            try:
                await chat_history.reload_from_disk()
                logger.info(f"已从磁盘重新加载聊天历史: agent_type={agent_type}")
            except Exception as e:
                logger.error(
                    f"从磁盘重新加载聊天历史失败 (agent_type={agent_type}): {e}",
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

            # 通知 magicfs：回滚期间跳过 checkpoint 维护，避免它把工作区改动回灌成 latest_content
            await self.checkpoint_service.metadata_manager.set_rollback_in_progress(True)
            try:
                # 执行回滚到实际目标checkpoint
                await self.rollback_executor.start_rollback(actual_target_checkpoint_id)
            finally:
                await self.checkpoint_service.metadata_manager.set_rollback_in_progress(False)
            logger.info(f"开始回滚成功完成: {target_message_id}")

            # 注意：这里不需要 reload 主 Agent 的内存 chat_history。
            # start_rollback 之后产品上必然走 commit_rollback 或 undo_rollback，
            # 中间不会触发 agent.run 把陈旧内存写回磁盘；commit 里统一 reload 即可。

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

            success = await self.rollback_executor.commit_rollback()
            if not success:
                raise RollbackException(ErrorCode.ROLLBACK_GENERAL_ERROR, "提交回滚操作失败")

            logger.info("回滚提交成功完成")

            # 在这里重新加载主 Agent 的内存 chat_history。
            # start_rollback 已经把磁盘上的聊天历史覆盖为目标状态，但内存
            # 中的 ChatHistory 因 load() 幂等保护未被刷新；若不在此处 reload，
            # 后续新消息会以陈旧内存为基线再写回磁盘，把刚回滚掉的那轮
            # 对话又"复活"到历史记录里。
            # 另一条终态路径 undo_rollback 天然一致（内存=磁盘=latest），
            # 因此只需要在 commit 这一个点 reload。
            await self._reload_main_agent_chat_history()

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
            # 通知 magicfs：回滚期间跳过 checkpoint 维护，避免它把工作区改动回灌成 latest_content
            await self.checkpoint_service.metadata_manager.set_rollback_in_progress(True)
            try:
                success = await self.rollback_executor.undo_rollback(latest_checkpoint_id)
            finally:
                await self.checkpoint_service.metadata_manager.set_rollback_in_progress(False)
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
                file_key = await self._resolve_file_key_from_xattr(file_path)
                if file_key:
                    file_keys.append(file_key)
                else:
                    logger.warning(f"无法从 magicfs xattr 解析 file_key，跳过: {file_path}")

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

    async def _resolve_file_key_from_xattr(self, file_path: str) -> Optional[str]:
        """
        从 magicfs xattr 解析文件对应的对象存储 file_key。

        唯一合法链路: 本地文件 → xattr user.magicfs.s3_key → file_key。
        不允许根据相对路径拼接 OSS key, 因为 magicfs 实际使用 file_id 作为
        存储键 (例如 ".../workspace/<file_id>"), 路径拼出来的 key 在后端
        根本不存在, 会触发 "文件未找到"。

        Args:
            file_path: checkpoint 中记录的文件路径, 可能是 workspace 下的
                相对路径, 也可能是历史数据里的绝对路径

        Returns:
            Optional[str]: 真实的对象存储 file_key; 文件不存在或 xattr 缺失
            时返回 None, 由调用方跳过。
        """
        try:
            # 归一化为本地绝对路径
            path_obj = Path(file_path)
            if path_obj.is_absolute():
                local_path = path_obj
            else:
                local_path = PathManager.get_workspace_dir() / file_path.lstrip("/")

            if not await async_exists(local_path):
                logger.warning(f"文件不存在，跳过 file_key 解析: {local_path}")
                return None

            s3_key = await get_s3_key_from_xattr(local_path)
            if not s3_key:
                logger.error(
                    f"文件缺少 magicfs xattr (user.magicfs.s3_key)，跳过 file_key 解析: {local_path}"
                )
                return None

            logger.debug(f"文件路径解析成功: {file_path} -> {s3_key}")
            return s3_key

        except Exception as e:
            logger.error(f"从 xattr 解析 file_key 失败: {file_path}, 错误: {e}")
            return None
