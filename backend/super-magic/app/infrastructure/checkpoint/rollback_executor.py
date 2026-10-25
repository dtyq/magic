# -*- coding: utf-8 -*-
"""
回滚执行器 - 基础设施层

统一处理checkpoint的完整回滚，全部通过帧重放完成。重放策略由空间
注册表（entity/checkpoint.py）按条目决定：
- 工作区空间（project / user）：失败即中止整体回滚，构建受影响文件、
  创建文件版本；
- 内部状态空间（topic / chat_history，以及未来新增）：尽力而为——
  失败仅告警跳过，不做文件版本创建、不产生变更附件。

agfs 侧把所有挂载的变更记入同一份操作流水，file_path 是 agent 可见
绝对路径（挂载配置下发 path_prefix），space 字段标记来源空间。重放时
直接按记录路径恢复，无需按子树猜测根目录。新增需要回滚的空间时，在
空间注册表登记一行即可，本模块无需改动。
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple
from app.core.entity.checkpoint import (
    FileSnapshot,
    FileOperation,
    FileType,
    is_file_version_space,
    is_internal_space,
)
from app.infrastructure.checkpoint.metadata_manager import CheckpointMetadataManager
from app.infrastructure.checkpoint.storage import CheckpointStorage
from app.utils.async_file_utils import (
    async_copy2, async_exists, async_rmtree, async_mkdir, async_unlink,
    async_rmdir, async_rename, get_file_id_from_xattr
)
from app.core.exceptions import RollbackException, ErrorCode
from app.path_manager import PathManager

from agentlang.logger import get_logger

logger = get_logger(__name__)


def _is_internal_space_entry(file_snapshot: FileSnapshot) -> bool:
    """判断流水条目是否属于内部状态空间（依据空间注册表）。

    agfs 侧从挂载配置把 space_type 盖章进每条流水；空 space 视为旧数据
    的工作区条目（历史行为：仅工作区有帧）。
    """
    return is_internal_space(file_snapshot.space)


class RollbackExecutor:
    """回滚执行器 - 处理工作区文件回滚

    挂载内文件与工作区共用同一套重放链路：agfs 侧记录的 file_path 是
    agent 可见绝对路径（网关为每个挂载下发 path_prefix），恢复目标就是
    路径本身，不需要按子树猜测根目录；两者只差 policy——严格性与版本/
    附件均由空间注册表的空间分类决定。
    """

    def __init__(self):
        """初始化回滚执行器（启用文件快照合并优化）"""
        self.metadata_manager = CheckpointMetadataManager()
        self.storage = CheckpointStorage()

        logger.info("RollbackExecutor初始化完成，合并优化已启用")

    async def start_rollback(self, target_checkpoint_id: str) -> Tuple[bool, List[Dict[str, str]]]:
        """
        开始回滚操作，只恢复文件状态

        所有空间共用同一份操作流水：这里只查询一次回滚范围、合并一次
        操作流，然后交由单一重放循环完成——每条的重放策略由空间注册表
        按条目决定。工作区条目失败会中止整体回滚；内部状态空间条目失败
        仅告警继续（产品语义：不阻塞用户继续会话）。

        Args:
            target_checkpoint_id: 目标检查点ID，不能为None

        Returns:
            Tuple[bool, List[Dict[str, str]]]: 回滚是否成功、受影响文件列表
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
                return True, []

            # 查询一次回滚范围并合并一次操作流（方向感知的排序去重）
            direction, checkpoints_to_process = await self.metadata_manager.get_checkpoints_between_in_checkpoint_manifest(
                current_checkpoint_id, target_checkpoint_id
            )
            logger.info(f"回滚方向: {direction}, 需要处理的checkpoint: {checkpoints_to_process}")

            is_forward = direction == "forward"
            merged_operations = await self._merge_file_snapshots_for_rollback(
                checkpoints_to_process, is_forward=is_forward,
            )

            # 一次重放完成全部空间的回滚：每条的重放策略（失败是否中止、
            # 是否构建受影响文件）由空间注册表按条目决定，新增空间无需
            # 改动本方法。
            ok, affected_files = await self._replay_file_operations(
                merged_operations, is_forward=is_forward,
            )
            if not ok:
                logger.error("工作区文件回滚失败")
                return False, []

            # 更新当前checkpoint状态
            await self.metadata_manager.update_current_checkpoint(target_checkpoint_id)
            logger.info(f"当前checkpoint状态已更新: {target_checkpoint_id}")

            logger.info(f"回滚完成，当前checkpoint: {target_checkpoint_id}")
            return True, affected_files

        except Exception as e:
            logger.error(f"开始回滚时发生错误: {e}")
            return False, []

    async def _merge_file_snapshots_for_rollback(self, checkpoint_ids: List[str], is_forward: bool) -> List[Tuple[str, FileSnapshot]]:
        """
        合并多个checkpoint的文件快照，去除重复操作

        按 file_id（文件稳定身份）去重，而非 file_path。因为 rename 时
        file_path 变化但 file_id 不变，按 file_id 去重才能正确聚合
        同一逻辑文件跨 rename 的多次操作。

        Args:
            checkpoint_ids: checkpoint ID列表
            is_forward: True=正向回滚(保留最晚), False=反向回滚(保留最早)

        Returns:
            List[Tuple[str, FileSnapshot]]: [(checkpoint_id, file_snapshot), ...]
        """
        file_operations = {}  # {file_id: (checkpoint_id, file_snapshot)}

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

            # file_snapshots 按事件发生时间升序 append，反向回滚需要
            # 连同 checkpoint 内部的 snapshot 顺序一起反转，否则同一个
            # checkpoint 内同一文件的多次操作（如 created→updated→deleted）
            # 会被最晚的一次覆盖，反向时保留的仍是最新操作，语义错误。
            snapshots_order = (
                checkpoint_info.file_snapshots
                if is_forward
                else list(reversed(checkpoint_info.file_snapshots))
            )

            for file_snapshot in snapshots_order:
                file_id = file_snapshot.file_id

                # 处理顺序已通过 reversed 调整，直接覆盖即可达到预期效果：
                # - 反向回滚：从新到旧处理，最后保留最早的操作
                # - 正向回滚：从旧到新处理，最后保留最晚的操作
                file_operations[file_id] = (checkpoint_id, file_snapshot)
                logger.debug(f"{'正向' if is_forward else '反向'}回滚更新文件操作: file_id={file_id}, path={file_snapshot.file_path} -> {file_snapshot.operation.value}")

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

            # 检查是否有重复的文件 ID
            file_ids = [file_snapshot.file_id for _, file_snapshot in merged_operations]
            unique_file_ids = set(file_ids)

            if len(file_ids) != len(unique_file_ids):
                logger.error("合并逻辑错误：存在重复的文件 ID")
                return False

            logger.debug(f"合并逻辑验证通过，处理了{len(unique_file_ids)}个唯一文件")
            return True

        except Exception as e:
            logger.error(f"合并逻辑验证失败: {e}")
            return False

    async def _build_affected_file(
        self,
        file_snapshot: FileSnapshot,
        is_forward: bool
    ) -> Optional[Dict[str, str]]:
        # 删除类回滚会先 unlink 文件，再收集 affected_files；此时目标路径上的
        # xattr 已经不存在。checkpoint 中的 file_id 是稳定身份，作为兜底可以
        # 保证 CREATED -> delete、DELETED -> add 等操作仍能生成通知。
        file_id = await get_file_id_from_xattr(self._resolve_restore_path(file_snapshot.file_path))
        if not file_id:
            file_id = file_snapshot.file_id
        if not file_id:
            return None

        return {
            "file_id": file_id,
            "file_path": self._normalize_affected_file_path(file_snapshot.file_path),
            "operation": self._get_rollback_file_operation(file_snapshot, is_forward),
        }

    def _merge_affected_file(
        self,
        affected_files: Dict[str, Dict[str, str]],
        affected_file: Optional[Dict[str, str]]
    ) -> None:
        if affected_file is None:
            return

        file_id = affected_file.get("file_id")
        if not file_id:
            return

        affected_files[file_id] = affected_file

    def _get_rollback_file_operation(self, file_snapshot: FileSnapshot, is_forward: bool) -> str:
        if file_snapshot.operation == FileOperation.CREATED:
            return "add" if is_forward else "delete"
        if file_snapshot.operation == FileOperation.DELETED:
            return "delete" if is_forward else "add"
        if file_snapshot.operation == FileOperation.RENAMED:
            return "update"
        return "update"

    def _normalize_affected_file_path(self, file_path: str) -> str:
        path = Path(file_path)
        if not path.is_absolute():
            return file_path.strip().replace("\\", "/").lstrip("/")

        try:
            return path.relative_to(PathManager.get_workspace_dir()).as_posix()
        except ValueError:
            return path.as_posix()

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

    def _resolve_restore_path(self, file_path: str) -> Path:
        """将流水记录的 file_path 解析为恢复目标绝对路径。

        新格式条目的 file_path 是 agent 可见绝对路径（形如
        <AGFS FUSE 挂载根>/magicfs/project/a.txt，挂载根由网关决定），
        直接使用。旧沙箱镜像产生的相对路径条目没有可靠的根信息，无法
        安全恢复——交由调用方跳过。
        """
        p = Path(file_path)
        if p.is_absolute():
            return p
        # 兼容历史数据：相对路径按 workspace 根解析（旧行为）
        return PathManager.get_workspace_dir() / p

    async def _replay_file_operations(
        self,
        entries: List[Tuple[str, FileSnapshot]],
        *,
        is_forward: bool,
    ) -> Tuple[bool, List[Dict[str, str]]]:
        """重放引擎：按 operation 语义逐条恢复合并后的文件操作。

        每条的重放策略由空间注册表按条目自行决定，单一循环、无分区特判：

        - 工作区空间条目：失败即中止整体回滚（返回 False）；成功后经
          xattr 构建受影响文件（供文件版本创建）。
        - 内部状态空间条目：尽力而为——失败仅告警并继续，不构建受影响
          文件。

        Args:
            entries: [(checkpoint_id, file_snapshot), ...]，合并后的操作流
            is_forward: True=正向回滚(应用 latest), False=反向回滚(撤销到 initial)

        Returns:
            Tuple[bool, List[Dict[str, str]]]: 重放是否成功、受影响文件列表。
            注意失败返回 False 时重放是部分完成的，已恢复的条目不回退
            （current_checkpoint_id 未推进，可重试整次回滚）。
        """
        # 工作区条目整体在前、内部状态空间条目在后（各自保持合并顺序）：
        # 跨空间路径互不相交，此排序只为保留"工作区先完整尝试"的既有
        # 语义——工作区失败时内部状态空间条目尚未开始重放。
        ordered = (
            [entry for entry in entries if not _is_internal_space_entry(entry[1])]
            + [entry for entry in entries if _is_internal_space_entry(entry[1])]
        )

        success_count = 0
        affected_files: Dict[str, Dict[str, str]] = {}
        for checkpoint_id, file_snapshot in ordered:
            internal = _is_internal_space_entry(file_snapshot)
            success = await self._restore_file_by_operation(
                checkpoint_id, file_snapshot, is_forward=is_forward,
            )
            if not success:
                if internal:
                    logger.warning(
                        "内部状态空间帧重放失败，跳过继续（尽力而为）: %s",
                        file_snapshot.file_path,
                    )
                    continue
                logger.error(f"帧重放失败: {file_snapshot.file_path}")
                return False, []
            success_count += 1
            if not internal:
                affected_file = await self._build_affected_file(file_snapshot, is_forward)
                if affected_file is not None:
                    self._merge_affected_file(affected_files, affected_file)

        logger.info(f"帧重放完成，成功处理了{success_count}/{len(ordered)}个文件操作")
        return True, list(affected_files.values())

    async def undo_rollback(self, latest_checkpoint_id: str) -> Tuple[bool, List[Dict[str, str]]]:
        """
        执行撤回回滚操作

        这是对 start_rollback 的封装，专门用于撤回回滚场景，
        提供更清晰的语义和更详细的日志记录。

        Args:
            latest_checkpoint_id: 最新的 checkpoint ID，不能为None

        Returns:
            Tuple[bool, List[Dict[str, str]]]: 撤回回滚是否成功、受影响文件列表
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
                return True, []

            logger.info(f"撤回回滚：从 {current_checkpoint_id} 到 {latest_checkpoint_id}")

            # 调用现有的 start_rollback 方法执行实际的回滚操作
            success, affected_files = await self.start_rollback(latest_checkpoint_id)

            if success:
                logger.info(f"撤回回滚执行成功: {latest_checkpoint_id}")
            else:
                logger.error(f"撤回回滚执行失败: {latest_checkpoint_id}")

            return success, affected_files

        except Exception as e:
            logger.error(f"撤回回滚执行时发生错误: {e}")
            return False, []

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
                elif operation == FileOperation.RENAMED:
                    return await self._restore_renamed_file_forward(checkpoint_id, file_snapshot)
            else:
                # 反向回滚：撤销操作的结果
                if operation == FileOperation.CREATED:
                    return await self._restore_created_file_backward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.UPDATED:
                    return await self._restore_updated_file_backward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.DELETED:
                    return await self._restore_deleted_file_backward(checkpoint_id, file_snapshot)
                elif operation == FileOperation.RENAMED:
                    return await self._restore_renamed_file_backward(checkpoint_id, file_snapshot)

            logger.error(f"未知的文件操作类型: {operation}")
            return False

        except Exception as e:
            logger.error(f"operation感知恢复失败 {file_path}: {e}")
            return False

    async def _restore_created_file_forward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """CREATED操作的正向回滚：创建文件（应用创建操作）"""
        try:
            target_path = self._resolve_restore_path(file_snapshot.file_path)

            # 根据文件类型选择创建方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从latest_content恢复
                latest_content_path = self.storage.get_latest_content_file_path(checkpoint_id, file_snapshot.file_id, space=file_snapshot.space)

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
            target_path = self._resolve_restore_path(file_snapshot.file_path)

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
            target_path = self._resolve_restore_path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从latest_content恢复
                latest_content_path = self.storage.get_latest_content_file_path(checkpoint_id, file_snapshot.file_id, space=file_snapshot.space)

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
            target_path = self._resolve_restore_path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从initial_content恢复
                initial_content_path = self.storage.get_initial_content_file_path(checkpoint_id, file_snapshot.file_id, space=file_snapshot.space)

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
            target_path = self._resolve_restore_path(file_snapshot.file_path)

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
            target_path = self._resolve_restore_path(file_snapshot.file_path)

            # 根据文件类型选择恢复方法
            if file_snapshot.file_type == FileType.FILE:
                # 文件：从initial_content恢复
                initial_content_path = self.storage.get_initial_content_file_path(checkpoint_id, file_snapshot.file_id, space=file_snapshot.space)

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

    async def _restore_renamed_file_forward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """RENAMED操作的正向回滚：将文件从 old_path 重命名到 new_path（应用 rename 操作）

        rename 不改内容，无需读取 initial_content / latest_content 快照。
        """
        try:
            source_path = self._resolve_restore_path(file_snapshot.old_file_path)
            target_path = self._resolve_restore_path(file_snapshot.file_path)

            if not source_path.exists():
                logger.info(f"RENAMED操作正向回滚，源路径已不存在，跳过: {file_snapshot.old_file_path}")
                return True

            await async_mkdir(target_path.parent, parents=True, exist_ok=True)
            await async_rename(source_path, target_path)
            logger.info(f"RENAMED操作正向回滚成功，重命名: {file_snapshot.old_file_path} -> {file_snapshot.file_path}")
            return True

        except Exception as e:
            logger.error(f"RENAMED操作正向回滚失败: {e}")
            return False

    async def _restore_renamed_file_backward(self, checkpoint_id: str, file_snapshot: FileSnapshot) -> bool:
        """RENAMED操作的反向回滚：将文件从 new_path 重命名回 old_path（撤销 rename 操作）

        rename 不改内容，无需读取 initial_content / latest_content 快照。
        """
        try:
            source_path = self._resolve_restore_path(file_snapshot.file_path)
            target_path = self._resolve_restore_path(file_snapshot.old_file_path)

            if not source_path.exists():
                logger.info(f"RENAMED操作反向回滚，源路径已不存在，跳过: {file_snapshot.file_path}")
                return True

            await async_mkdir(target_path.parent, parents=True, exist_ok=True)
            await async_rename(source_path, target_path)
            logger.info(f"RENAMED操作反向回滚成功，重命名: {file_snapshot.file_path} -> {file_snapshot.old_file_path}")
            return True

        except Exception as e:
            logger.error(f"RENAMED操作反向回滚失败: {e}")
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
            # 文件版本只针对版本空间条目（工作区空间 project / user，
            # 含用户空间 .magic/ 等隐藏目录下的持久文件）；topic /
            # chat_history 空间（Agent 内部状态）条目随 checkpoint 恢复，
            # 不进入版本链路。
            merged_operations = [
                entry for entry in merged_operations
                if is_file_version_space(entry[1].space)
            ]
            files_for_version = []
            for checkpoint_id, file_snapshot in merged_operations:
                # 跳过目录快照：file version 只针对文件，服务端对目录型 file_key 会
                # 直接返回 "无法为目录创建版本"。与 checkpoint 链路
                # (_collect_changed_file_paths) 的过滤策略对齐。
                if file_snapshot.file_type == FileType.DIRECTORY:
                    continue

                should_create_version = False

                if direction == "forward":
                    # 正向回滚：DELETE 操作的文件不需要版本（会被删除），
                    # CREATED/UPDATED/RENAMED 都需要版本。
                    should_create_version = file_snapshot.operation != FileOperation.DELETED
                elif direction == "backward":
                    # 反向回滚：CREATE 操作的文件不需要版本（会被删除），
                    # UPDATED/DELETED/RENAMED 都需要版本。
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
