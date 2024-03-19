# -*- coding: utf-8 -*-
"""
聊天历史快照管理器

负责聊天历史的快照和恢复操作：
- 完整快照.chat_history目录
- 验证快照完整性
- 计算快照大小
- 恢复聊天历史快照
- 清空聊天历史
"""

from pathlib import Path
from agentlang.paths import PathManager
from app.utils.async_file_utils import (
    async_rmtree, async_mkdir, async_copy2, async_copytree, async_exists, async_scandir
)
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ChatHistorySnapshotManager:
    """聊天历史快照管理器"""

    async def create_initial_chat_history_snapshot(self, snapshot_dir: Path) -> bool:
        """
        创建聊天历史初始快照（checkpoint 创建时调用，保存执行前的状态）

        Args:
            snapshot_dir: 快照目标目录（initial_chat_history_snapshots）

        Returns:
            bool: 是否成功
        """
        try:
            chat_history_source = PathManager.get_chat_history_dir()

            if not await async_exists(chat_history_source):
                logger.info("聊天历史目录不存在，跳过初始快照")
                return True

            if await async_exists(snapshot_dir):
                await async_rmtree(snapshot_dir)
            await async_mkdir(snapshot_dir, parents=True)

            logger.info(f"开始创建聊天历史初始快照: {chat_history_source} -> {snapshot_dir}")

            items = await async_scandir(chat_history_source)
            for item in items:
                if item.is_file():
                    await async_copy2(item.path, snapshot_dir / item.name)
                elif item.is_dir():
                    await async_copytree(item.path, snapshot_dir / item.name)

            logger.info("聊天历史初始快照完成")
            return True

        except Exception as e:
            logger.error(f"创建聊天历史初始快照失败: {e}")
            return False

    async def create_latest_chat_history_snapshot(self, snapshot_dir: Path) -> bool:
        """
        创建聊天历史最新快照（chat_history 变更时调用，保存执行后的状态）

        Args:
            snapshot_dir: 快照目标目录（latest_chat_history_snapshots）

        Returns:
            bool: 是否成功
        """
        try:
            chat_history_source = PathManager.get_chat_history_dir()

            if not await async_exists(chat_history_source):
                logger.info("聊天历史目录不存在，跳过最新快照")
                return True

            if await async_exists(snapshot_dir):
                await async_rmtree(snapshot_dir)
            await async_mkdir(snapshot_dir, parents=True)

            logger.info(f"开始创建聊天历史最新快照: {chat_history_source} -> {snapshot_dir}")

            items = await async_scandir(chat_history_source)
            for item in items:
                if item.is_file():
                    await async_copy2(item.path, snapshot_dir / item.name)
                elif item.is_dir():
                    await async_copytree(item.path, snapshot_dir / item.name)

            logger.info("聊天历史最新快照完成")
            return True

        except Exception as e:
            logger.error(f"创建聊天历史最新快照失败: {e}")
            return False

    async def restore_from_initial_chat_history(self, snapshot_dir: Path) -> bool:
        """
        从初始快照恢复聊天历史（反向回滚使用）

        Args:
            snapshot_dir: 快照源目录（initial_chat_history_snapshots）

        Returns:
            bool: 是否恢复成功
        """
        try:
            chat_history_target = PathManager.get_chat_history_dir()

            if not await async_exists(snapshot_dir):
                logger.warning(f"初始快照目录不存在: {snapshot_dir}")
                return True

            logger.info(f"开始从初始快照恢复聊天历史: {snapshot_dir} -> {chat_history_target}")

            if await async_exists(chat_history_target):
                logger.info(f"删除当前聊天历史目录: {chat_history_target}")
                await async_rmtree(chat_history_target)

            await async_mkdir(chat_history_target, parents=True, exist_ok=True)

            items = await async_scandir(snapshot_dir)
            for item in items:
                target_path = chat_history_target / item.name
                if item.is_file():
                    await async_copy2(item.path, target_path)
                elif item.is_dir():
                    await async_copytree(item.path, target_path)

            logger.info("从初始快照恢复聊天历史完成")
            return True

        except Exception as e:
            logger.error(f"从初始快照恢复聊天历史失败: {e}")
            return False

    async def restore_from_latest_chat_history(self, snapshot_dir: Path) -> bool:
        """
        从最新快照恢复聊天历史（正向回滚使用）

        Args:
            snapshot_dir: 快照源目录（latest_chat_history_snapshots）

        Returns:
            bool: 是否恢复成功
        """
        try:
            chat_history_target = PathManager.get_chat_history_dir()

            if not await async_exists(snapshot_dir):
                logger.warning(f"最新快照目录不存在: {snapshot_dir}")
                return True

            logger.info(f"开始从最新快照恢复聊天历史: {snapshot_dir} -> {chat_history_target}")

            if await async_exists(chat_history_target):
                logger.info(f"删除当前聊天历史目录: {chat_history_target}")
                await async_rmtree(chat_history_target)

            await async_mkdir(chat_history_target, parents=True, exist_ok=True)

            items = await async_scandir(snapshot_dir)
            for item in items:
                target_path = chat_history_target / item.name
                if item.is_file():
                    await async_copy2(item.path, target_path)
                elif item.is_dir():
                    await async_copytree(item.path, target_path)

            logger.info("从最新快照恢复聊天历史完成")
            return True

        except Exception as e:
            logger.error(f"从最新快照恢复聊天历史失败: {e}")
            return False

    async def clear_chat_history(self) -> bool:
        """
        清空当前聊天历史（用于回滚到没有聊天记录的状态）

        Returns:
            bool: 是否清空成功
        """
        try:
            chat_history_target = PathManager.get_chat_history_dir()

            if await async_exists(chat_history_target):
                logger.info(f"清空聊天历史目录: {chat_history_target}")
                await async_rmtree(chat_history_target)

            await async_mkdir(chat_history_target, parents=True, exist_ok=True)

            logger.info("聊天历史清空完成")
            return True

        except Exception as e:
            logger.error(f"清空聊天历史失败: {e}")
            return False
