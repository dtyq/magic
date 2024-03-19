"""Canvas Lock Manager - 画布锁管理器

此模块提供画布级别的锁机制，防止并发操作导致的数据冲突和不一致。

主要功能：
1. 为每个画布项目维护独立的异步锁
2. 确保 load → 操作 → save 过程的原子性
3. 防止多个 agent 任务同时修改同一画布
4. 支持异步上下文管理器（async with）语法

使用场景：
- Agent 添加、更新、删除画布元素
- Agent 调整元素图层顺序
- 任何需要修改 magic.project.js 的操作

并发控制策略：
- 使用 asyncio.Lock 实现画布级别的锁
- 每个画布路径对应一个独立的锁
- 锁的粒度是画布项目，而不是单个元素
- 采用"先到先得"策略，后来的操作需要等待
"""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict

from agentlang.logger import get_logger

logger = get_logger(__name__)


class CanvasLockManager:
    """画布锁管理器

    管理所有画布项目的锁，防止并发操作导致的数据冲突。
    使用单例模式，全局共享一个实例。

    """

    def __init__(self) -> None:
        """初始化锁管理器"""
        # 存储每个画布路径对应的锁
        # Key: 画布项目的绝对路径（字符串）
        # Value: asyncio.Lock 实例
        self._locks: Dict[str, asyncio.Lock] = {}

        # 用于保护 _locks 字典本身的锁（防止并发访问字典）
        self._locks_lock: asyncio.Lock = asyncio.Lock()

        logger.info("Canvas Lock Manager initialized")

    def _normalize_path(self, project_path: Path) -> str:
        """标准化项目路径

        将路径转换为绝对路径的字符串形式，确保相同的项目使用相同的锁。

        Args:
            project_path: 项目路径（可以是相对路径或绝对路径）

        Returns:
            标准化后的绝对路径字符串
        """
        return str(project_path.resolve())

    async def _get_or_create_lock(self, canvas_id: str) -> asyncio.Lock:
        """获取或创建指定画布的锁

        如果锁不存在，则创建一个新的锁。
        此操作本身是线程安全的（通过 _locks_lock 保护）。

        Args:
            canvas_id: 标准化后的画布 ID（项目绝对路径）

        Returns:
            该画布对应的 asyncio.Lock 实例
        """
        # 保护 _locks 字典的访问
        async with self._locks_lock:
            if canvas_id not in self._locks:
                self._locks[canvas_id] = asyncio.Lock()
                logger.debug(f"Created new lock for canvas: {canvas_id}")
            return self._locks[canvas_id]

    @asynccontextmanager
    async def lock_canvas(self, project_path: Path):
        """获取画布锁的上下文管理器

        使用此方法可以安全地锁定画布进行操作。
        锁会在上下文退出时自动释放。

        Args:
            project_path: 项目路径

        Yields:
            None（但保证在上下文中画布已被锁定）

        Raises:
            任何在锁定期间发生的异常都会被传播
        """
        canvas_id = self._normalize_path(project_path)
        lock = await self._get_or_create_lock(canvas_id)

        logger.debug(f"Attempting to acquire lock for canvas: {canvas_id}")

        async with lock:
            logger.debug(f"Lock acquired for canvas: {canvas_id}")
            try:
                yield
            finally:
                logger.debug(f"Lock released for canvas: {canvas_id}")

    def get_locked_canvases_count(self) -> int:
        """获取当前已创建的锁的数量

        注意：这不代表当前正在被锁定的画布数量，
        而是已经创建过锁的画布总数（包括当前未被锁定的）。

        Returns:
            已创建的锁的数量
        """
        return len(self._locks)

    def is_canvas_registered(self, project_path: Path) -> bool:
        """检查指定画布是否已注册过锁

        Args:
            project_path: 项目路径

        Returns:
            如果该画布已经创建过锁，返回 True；否则返回 False
        """
        canvas_id = self._normalize_path(project_path)
        return canvas_id in self._locks


# 全局单例实例
# 所有设计工具共享这个实例，确保锁的一致性
canvas_lock_manager = CanvasLockManager()
