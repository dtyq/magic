# -*- coding: utf-8 -*-
"""
Checkpoint底层存储操作

这个模块负责checkpoint的底层存储操作，包括：
- 创建和删除checkpoint目录结构
- 检查checkpoint是否存在
- 管理checkpoint相关的文件路径
"""

import os
import shutil
import asyncio
from pathlib import Path
from typing import Optional
from app.paths import PathManager
from app.utils.async_file_utils import async_mkdir, async_rmtree, async_exists
from agentlang.logger import get_logger

logger = get_logger(__name__)


class CheckpointStorage:
    """Checkpoint底层存储操作类"""

    def __init__(self):
        self.checkpoint_root = PathManager.get_checkpoints_dir()

    async def create_checkpoint_directory(self, checkpoint_id: str) -> str:
        """创建checkpoint目录结构"""
        try:
            checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)

            # 创建文件快照子目录
            file_snapshots_dir = self.get_file_snapshots_dir(checkpoint_id)
            await async_mkdir(file_snapshots_dir, exist_ok=True)

            # 创建聊天历史初始快照子目录（用于反向回滚）
            initial_chat_history_dir = self.get_initial_chat_history_snapshots_dir(checkpoint_id)
            await async_mkdir(initial_chat_history_dir, exist_ok=True)

            # 创建聊天历史最新快照子目录（用于正向回滚）
            latest_chat_history_dir = self.get_latest_chat_history_snapshots_dir(checkpoint_id)
            await async_mkdir(latest_chat_history_dir, exist_ok=True)

            logger.info(f"创建checkpoint目录: {checkpoint_dir}")
            return str(checkpoint_dir)
        except Exception as e:
            logger.error(f"创建checkpoint目录失败 {checkpoint_id}: {e}")
            raise

    async def checkpoint_exists(self, checkpoint_id: str) -> bool:
        """检查checkpoint是否存在"""
        try:
            checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
            info_file = checkpoint_dir / "checkpoint_info.json"
            return await async_exists(info_file)
        except Exception as e:
            logger.error(f"检查checkpoint存在性失败 {checkpoint_id}: {e}")
            return False

    async def delete_checkpoint_directory(self, checkpoint_id: str) -> bool:
        """删除checkpoint目录"""
        try:
            checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
            if await async_exists(checkpoint_dir):
                await async_rmtree(checkpoint_dir)
                logger.info(f"删除checkpoint目录: {checkpoint_dir}")
            return True
        except Exception as e:
            logger.error(f"删除checkpoint目录失败 {checkpoint_id}: {e}")
            return False

    def get_checkpoint_info_file_path(self, checkpoint_id: str) -> Path:
        """获取checkpoint信息文件路径"""
        checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
        return checkpoint_dir / "checkpoint_info.json"

    def get_file_operations_file_path(self, checkpoint_id: str) -> Path:
        """获取文件操作记录文件路径"""
        checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
        return checkpoint_dir / "file_operations.json"

    def get_checkpoint_manifest_file_path(self) -> Path:
        """获取checkpoint清单文件路径"""
        return self.checkpoint_root / "checkpoint_manifest.json"

    def get_file_snapshots_dir(self, checkpoint_id: str) -> Path:
        """获取文件快照目录路径"""
        checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
        return checkpoint_dir / "file_snapshots"

    def get_initial_chat_history_snapshots_dir(self, checkpoint_id: str) -> Path:
        """获取聊天历史初始快照目录路径（执行前的状态）"""
        checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
        return checkpoint_dir / "initial_chat_history_snapshots"

    def get_latest_chat_history_snapshots_dir(self, checkpoint_id: str) -> Path:
        """获取聊天历史最新快照目录路径（执行后的状态）"""
        checkpoint_dir = PathManager.get_checkpoint_dir(checkpoint_id)
        return checkpoint_dir / "latest_chat_history_snapshots"

    def get_initial_content_file_path(self, checkpoint_id: str, path_hash: str) -> Path:
        """获取文件快照的初始化内容文件路径"""
        file_snapshots_dir = self.get_file_snapshots_dir(checkpoint_id)
        snapshot_dir = file_snapshots_dir / path_hash
        return snapshot_dir / "initial_content"

    def get_latest_content_file_path(self, checkpoint_id: str, path_hash: str) -> Path:
        """获取文件快照的最新内容文件路径"""
        file_snapshots_dir = self.get_file_snapshots_dir(checkpoint_id)
        snapshot_dir = file_snapshots_dir / path_hash
        return snapshot_dir / "latest_content"
