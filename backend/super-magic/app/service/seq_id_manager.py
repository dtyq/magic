"""
序列号管理服务

为每个task_id维护自增的seq_id，确保消息有序
支持异步和线程安全
"""

import asyncio
import threading
from typing import Dict, Optional
from agentlang.logger import get_logger

logger = get_logger(__name__)


class SeqIdManagerService:
    """任务序列号管理器服务，为每个task_id维护自增的seq_id"""

    def __init__(self):
        self._task_seq_map: Dict[str, int] = {}
        # 双重锁保护：支持异步和线程环境
        self._async_lock = asyncio.Lock()
        self._thread_lock = threading.Lock()

    def initialize_task(self, task_id: str) -> None:
        """初始化任务的序列号计数器（同步版本）"""
        with self._thread_lock:
            if task_id not in self._task_seq_map:
                self._task_seq_map[task_id] = 0
                logger.info(f"初始化任务序列号: task_id={task_id}, seq_id=0")

    async def initialize_task_async(self, task_id: str) -> None:
        """初始化任务的序列号计数器（异步版本）"""
        async with self._async_lock:
            if task_id not in self._task_seq_map:
                self._task_seq_map[task_id] = 0
                logger.info(f"初始化任务序列号: task_id={task_id}, seq_id=0")

    def get_next_seq_id(self, task_id: str) -> int:
        """获取任务的下一个序列号（同步版本）"""
        with self._thread_lock:
            if task_id not in self._task_seq_map:
                self._task_seq_map[task_id] = 0

            self._task_seq_map[task_id] += 1
            seq_id = self._task_seq_map[task_id]
            logger.debug(f"分配序列号: task_id={task_id}, seq_id={seq_id}")
            return seq_id

    async def get_next_seq_id_async(self, task_id: str) -> int:
        """获取任务的下一个序列号（异步版本）"""
        async with self._async_lock:
            if task_id not in self._task_seq_map:
                self._task_seq_map[task_id] = 0

            self._task_seq_map[task_id] += 1
            seq_id = self._task_seq_map[task_id]
            logger.debug(f"分配序列号: task_id={task_id}, seq_id={seq_id}")
            return seq_id

    def get_current_seq_id(self, task_id: str) -> int:
        """获取任务的当前序列号（不自增，同步版本）"""
        with self._thread_lock:
            return self._task_seq_map.get(task_id, 0)

    async def get_current_seq_id_async(self, task_id: str) -> int:
        """获取任务的当前序列号（不自增，异步版本）"""
        async with self._async_lock:
            return self._task_seq_map.get(task_id, 0)

    def reset_task(self, task_id: str) -> None:
        """重置任务的序列号（同步版本）"""
        with self._thread_lock:
            if task_id in self._task_seq_map:
                del self._task_seq_map[task_id]
                logger.info(f"重置任务序列号: task_id={task_id}")

    async def reset_task_async(self, task_id: str) -> None:
        """重置任务的序列号（异步版本）"""
        async with self._async_lock:
            if task_id in self._task_seq_map:
                del self._task_seq_map[task_id]
                logger.info(f"重置任务序列号: task_id={task_id}")

    def get_all_tasks(self) -> Dict[str, int]:
        """获取所有任务的序列号状态（同步版本）"""
        with self._thread_lock:
            return self._task_seq_map.copy()

    async def get_all_tasks_async(self) -> Dict[str, int]:
        """获取所有任务的序列号状态（异步版本）"""
        async with self._async_lock:
            return self._task_seq_map.copy()

    def get_stats(self) -> Dict[str, any]:
        """获取管理器统计信息"""
        with self._thread_lock:
            return {
                'total_tasks': len(self._task_seq_map),
                'active_tasks': list(self._task_seq_map.keys()),
                'max_seq_id': max(self._task_seq_map.values()) if self._task_seq_map else 0,
                'total_messages': sum(self._task_seq_map.values())
            }


# 全局单例
_seq_id_manager_service = SeqIdManagerService()


def get_seq_id_manager_service() -> SeqIdManagerService:
    """获取全局序列号管理器服务实例"""
    return _seq_id_manager_service
