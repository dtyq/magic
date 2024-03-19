# -*- coding: utf-8 -*-
"""
文件快照管理器

这个模块负责创建和管理文件快照，包括：
- 创建文件快照（复制文件内容和元数据）
- 计算文件hash和路径hash
- 保存文件快照信息
- 从快照恢复文件
"""

import os
import shutil
import hashlib
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional
from app.core.entity.checkpoint import FileSnapshot, FileOperation, FileType
from app.utils.async_file_utils import (
    async_copy2, async_mkdir, async_write_json, async_write_text, async_exists
)
from agentlang.logger import get_logger

logger = get_logger(__name__)


class FileSnapshotManager:
    """文件快照管理器"""

    def __init__(self):
        """初始化文件快照管理器"""
        from .storage import CheckpointStorage
        self.storage = CheckpointStorage()

    async def create_initial_file_snapshot(self, checkpoint_id: str, file_path: str, operation: FileOperation) -> Optional[FileSnapshot]:
        """创建初始化文件快照"""
        try:
            # 计算文件路径hash
            path_hash = self._calculate_path_hash(file_path)

            # 创建快照目录
            file_snapshots_dir = self.storage.get_file_snapshots_dir(checkpoint_id)
            snapshot_dir = file_snapshots_dir / path_hash
            await async_mkdir(snapshot_dir, parents=True, exist_ok=True)

            return await self._create_initial_file_snapshot(checkpoint_id, path_hash, file_path, operation)

        except Exception as e:
            logger.error(f"创建文件快照失败 {file_path}: {e}")
            return None

    async def restore_file_from_snapshot(self, file_snapshot: FileSnapshot) -> bool:
        """从快照恢复文件"""
        try:
            if file_snapshot.operation == FileOperation.DELETED:
                # 删除操作的回滚：恢复文件
                if file_snapshot.snapshot_path and Path(file_snapshot.snapshot_path).exists():
                    # 确保目标目录存在
                    target_path = Path(file_snapshot.file_path)
                    await async_mkdir(target_path.parent, parents=True, exist_ok=True)
                    await async_copy2(file_snapshot.snapshot_path, target_path)
                    logger.info(f"从快照恢复文件: {file_snapshot.file_path}")
                    return True
                else:
                    logger.warning(f"快照文件不存在，无法恢复: {file_snapshot.file_path}")
                    return False

            elif file_snapshot.operation in [FileOperation.CREATED, FileOperation.UPDATED]:
                # 创建/更新操作的回滚：恢复原始内容
                if file_snapshot.snapshot_path and Path(file_snapshot.snapshot_path).exists():
                    target_path = Path(file_snapshot.file_path)
                    await async_mkdir(target_path.parent, parents=True, exist_ok=True)
                    await async_copy2(file_snapshot.snapshot_path, target_path)
                    logger.info(f"恢复文件原始内容: {file_snapshot.file_path}")
                    return True
                else:
                    logger.warning(f"快照文件不存在，无法恢复: {file_snapshot.file_path}")
                    return False

            return False

        except Exception as e:
            logger.error(f"从快照恢复文件失败 {file_snapshot.file_path}: {e}")
            return False

    async def _create_initial_file_snapshot(self, checkpoint_id: str, path_hash: str, file_path: str, operation: FileOperation) -> Optional[FileSnapshot]:
        """创建初始化文件快照（适用于所有操作类型：创建/更新/删除）"""
        file_path_obj = Path(file_path)

        try:
            # 检测文件类型
            file_type = FileSnapshot.detect_file_type(file_path)

            # 获取快照目录
            file_snapshots_dir = self.storage.get_file_snapshots_dir(checkpoint_id)
            snapshot_dir = file_snapshots_dir / path_hash

            snapshot_file_path = None
            if file_path_obj.exists():
                # 文件/目录存在
                stat = file_path_obj.stat()
                modified_time = datetime.fromtimestamp(stat.st_mtime)

                if file_type == FileType.FILE:
                    # 文件：复制内容
                    snapshot_file_path = self.storage.get_initial_content_file_path(checkpoint_id, path_hash)
                    await async_copy2(file_path_obj, snapshot_file_path)
                else:
                    logger.error(f"未知的文件类型: {file_type}")
                    return None
            else:
                # 文件/目录不存在（DELETE操作）
                logger.info(f"路径不存在，创建空内容快照: {file_path}")
                if file_type == FileType.FILE:
                    # 为文件创建空内容快照
                    snapshot_file_path = self.storage.get_initial_content_file_path(checkpoint_id, path_hash)
                    await async_write_text(snapshot_file_path, "", encoding='utf-8')

                # 设置默认信息
                modified_time = datetime.now()

            file_snapshot = FileSnapshot(
                file_path=file_path,
                modified_time=modified_time,
                operation=operation,
                file_type=file_type,
                snapshot_path=str(snapshot_file_path) if snapshot_file_path else None
            )

            # 保存文件信息
            await self._save_file_info(snapshot_dir, file_snapshot)

            logger.info(f"创建文件快照成功: {file_path} -> {operation.value}, type={file_type.value}")
            return file_snapshot

        except Exception as e:
            logger.error(f"创建文件快照失败 {file_path}: {e}")
            return None

    def _calculate_path_hash(self, file_path: str) -> str:
        """计算文件路径hash"""
        return hashlib.md5(file_path.encode('utf-8')).hexdigest()

    async def _save_file_info(self, snapshot_dir: Path, file_snapshot: FileSnapshot) -> None:
        """保存初始化文件信息到快照目录"""
        try:
            file_info_path = snapshot_dir / "initial_file_info.json"
            await async_write_json(file_info_path, file_snapshot.model_dump(), ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            logger.error(f"保存文件信息失败: {e}")
            raise

    async def has_snapshot_for_file(self, checkpoint_id: str, file_path: str) -> bool:
        """检查指定checkpoint目录下是否已有文件快照"""
        try:
            # 计算文件路径hash
            path_hash = self._calculate_path_hash(file_path)
            file_snapshots_dir = self.storage.get_file_snapshots_dir(checkpoint_id)
            snapshot_dir = file_snapshots_dir / path_hash

            # 检查快照目录是否存在，以及是否有内容文件
            initial_content_file = self.storage.get_initial_content_file_path(checkpoint_id, path_hash)
            return await async_exists(snapshot_dir) and await async_exists(initial_content_file)

        except Exception as e:
            logger.error(f"检查文件快照存在性失败: {e}")
            return False

    async def create_latest_file_snapshot(self, checkpoint_id: str, file_path: str, operation: FileOperation) -> Optional[FileSnapshot]:
        """创建最新文件快照"""
        try:
            # 计算文件路径hash
            path_hash = self._calculate_path_hash(file_path)

            # 创建快照目录
            file_snapshots_dir = self.storage.get_file_snapshots_dir(checkpoint_id)
            snapshot_dir = file_snapshots_dir / path_hash
            await async_mkdir(snapshot_dir, parents=True, exist_ok=True)

            return await self._create_latest_file_snapshot(checkpoint_id, path_hash, file_path, operation)

        except Exception as e:
            logger.error(f"创建最新文件快照失败 {file_path}: {e}")
            return None

    async def _create_latest_file_snapshot(self, checkpoint_id: str, path_hash: str, file_path: str, operation: FileOperation) -> Optional[FileSnapshot]:
        """创建最新文件快照（保存当前文件状态）"""
        file_path_obj = Path(file_path)

        try:
            # 检测文件类型
            file_type = FileSnapshot.detect_file_type(file_path)

            # 获取快照目录
            file_snapshots_dir = self.storage.get_file_snapshots_dir(checkpoint_id)
            snapshot_dir = file_snapshots_dir / path_hash

            snapshot_file_path = None
            if file_path_obj.exists():
                # 文件/目录存在
                stat = file_path_obj.stat()
                modified_time = datetime.fromtimestamp(stat.st_mtime)

                if file_type == FileType.FILE:
                    # 文件：复制最新内容
                    snapshot_file_path = self.storage.get_latest_content_file_path(checkpoint_id, path_hash)
                    await async_copy2(file_path_obj, snapshot_file_path)
                else:
                    logger.error(f"未知的文件类型: {file_type}")
                    return None
            else:
                # 文件/目录不存在
                logger.info(f"路径不存在，创建空最新内容快照: {file_path}")
                if file_type == FileType.FILE:
                    # 为文件创建空内容快照
                    snapshot_file_path = self.storage.get_latest_content_file_path(checkpoint_id, path_hash)
                    await async_write_text(snapshot_file_path, "", encoding='utf-8')

                # 设置默认信息
                modified_time = datetime.now()

            file_snapshot = FileSnapshot(
                file_path=file_path,
                modified_time=modified_time,
                operation=operation,
                file_type=file_type,
                snapshot_path=str(snapshot_file_path) if snapshot_file_path else None
            )

            # 保存文件信息（使用latest前缀区分）
            await self._save_latest_file_info(snapshot_dir, file_snapshot)

            logger.info(f"创建最新文件快照成功: {file_path} -> {operation.value}, type={file_type.value}")
            return file_snapshot

        except Exception as e:
            logger.error(f"创建最新文件快照失败 {file_path}: {e}")
            return None

    async def _save_latest_file_info(self, snapshot_dir: Path, file_snapshot: FileSnapshot) -> None:
        """保存最新文件信息到快照目录"""
        try:
            file_info_path = snapshot_dir / "latest_file_info.json"
            await async_write_json(file_info_path, file_snapshot.model_dump(), ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            logger.error(f"保存最新文件信息失败: {e}")
            raise
