"""Canvas Lock Manager Tests

测试画布锁管理器的功能。
"""

import asyncio
from pathlib import Path

import pytest

from app.tools.design.manager.canvas_lock_manager import canvas_lock_manager
from app.tools.design.manager.canvas_manager import CanvasManager


pytestmark = pytest.mark.asyncio


class TestCanvasLockManager:
    """测试 CanvasLockManager 类"""

    async def test_singleton_instance(self):
        """测试全局单例实例"""
        from app.tools.design.manager.canvas_lock_manager import CanvasLockManager

        # 创建一个新实例
        manager1 = CanvasLockManager()
        manager2 = CanvasLockManager()

        # 两个实例不应该是同一个（它们是不同的实例）
        # 但全局的 canvas_lock_manager 应该是单例
        assert manager1 is not manager2

        # 全局实例应该存在
        assert canvas_lock_manager is not None

    async def test_normalize_path(self):
        """测试路径标准化"""
        path1 = Path("project")
        path2 = Path("project")
        path3 = Path("project/../project")

        # 相同路径应该标准化为相同的字符串
        normalized1 = canvas_lock_manager._normalize_path(path1)
        normalized2 = canvas_lock_manager._normalize_path(path2)
        normalized3 = canvas_lock_manager._normalize_path(path3)

        assert isinstance(normalized1, str)
        assert normalized1 == normalized2
        assert normalized1 == normalized3

    async def test_get_or_create_lock(self):
        """测试获取或创建锁"""
        canvas_id = "test_canvas_1"

        # 第一次获取应该创建新锁
        lock1 = await canvas_lock_manager._get_or_create_lock(canvas_id)
        assert lock1 is not None
        assert isinstance(lock1, asyncio.Lock)

        # 第二次获取应该返回同一个锁
        lock2 = await canvas_lock_manager._get_or_create_lock(canvas_id)
        assert lock2 is lock1

    async def test_lock_canvas_basic(self):
        """测试基本的锁定功能"""
        project_path = Path("test_project_basic")

        # 锁定应该成功
        async with canvas_lock_manager.lock_canvas(project_path):
            # 在锁内执行某些操作
            pass

        # 锁应该被释放

    async def test_lock_canvas_concurrent(self):
        """测试并发锁定（确保串行执行）"""
        project_path = Path("test_project_concurrent")
        execution_order = []

        async def task1():
            async with canvas_lock_manager.lock_canvas(project_path):
                execution_order.append("task1_start")
                await asyncio.sleep(0.1)  # 模拟操作
                execution_order.append("task1_end")

        async def task2():
            async with canvas_lock_manager.lock_canvas(project_path):
                execution_order.append("task2_start")
                await asyncio.sleep(0.1)  # 模拟操作
                execution_order.append("task2_end")

        # 并发启动两个任务
        await asyncio.gather(task1(), task2())

        # 验证执行顺序：应该是串行的，一个任务完全执行完后另一个才开始
        # 可能的顺序：task1 全部完成 → task2 全部完成，或反之
        assert len(execution_order) == 4

        # 检查是否是串行的（不应该交错）
        if execution_order[0] == "task1_start":
            assert execution_order == ["task1_start", "task1_end", "task2_start", "task2_end"]
        else:
            assert execution_order == ["task2_start", "task2_end", "task1_start", "task1_end"]

    async def test_different_canvas_independent(self):
        """测试不同画布的锁是独立的"""
        project_path1 = Path("test_project_1")
        project_path2 = Path("test_project_2")
        execution_order = []

        async def task1():
            async with canvas_lock_manager.lock_canvas(project_path1):
                execution_order.append("project1_start")
                await asyncio.sleep(0.1)
                execution_order.append("project1_end")

        async def task2():
            async with canvas_lock_manager.lock_canvas(project_path2):
                execution_order.append("project2_start")
                await asyncio.sleep(0.1)
                execution_order.append("project2_end")

        # 并发启动两个任务（操作不同的画布）
        await asyncio.gather(task1(), task2())

        # 验证执行顺序：不同画布的锁是独立的，应该能够并发执行
        assert len(execution_order) == 4

        # 由于是并发执行，start 和 end 可能会交错
        # 但每个项目自己的 start 应该在 end 之前
        project1_start_idx = execution_order.index("project1_start")
        project1_end_idx = execution_order.index("project1_end")
        project2_start_idx = execution_order.index("project2_start")
        project2_end_idx = execution_order.index("project2_end")

        assert project1_start_idx < project1_end_idx
        assert project2_start_idx < project2_end_idx

    async def test_lock_canvas_exception_handling(self):
        """测试锁在异常情况下的释放"""
        project_path = Path("test_project_exception")

        # 第一个任务抛出异常
        try:
            async with canvas_lock_manager.lock_canvas(project_path):
                raise ValueError("Test exception")
        except ValueError:
            pass  # 预期的异常

        # 第二个任务应该能够获取锁（证明锁已被释放）
        async with canvas_lock_manager.lock_canvas(project_path):
            pass  # 成功获取锁

    async def test_get_locked_canvases_count(self):
        """测试获取已注册的锁数量"""
        # 创建一些锁
        await canvas_lock_manager._get_or_create_lock("canvas_count_1")
        await canvas_lock_manager._get_or_create_lock("canvas_count_2")
        await canvas_lock_manager._get_or_create_lock("canvas_count_3")

        # 计数应该至少包含这3个
        count = canvas_lock_manager.get_locked_canvases_count()
        assert count >= 3

    async def test_is_canvas_registered(self):
        """测试检查画布是否已注册"""
        project_path = Path("test_registered_check")

        # 初始状态应该未注册
        assert not canvas_lock_manager.is_canvas_registered(project_path)

        # 使用一次锁后应该注册
        async with canvas_lock_manager.lock_canvas(project_path):
            pass

        # 现在应该已注册
        assert canvas_lock_manager.is_canvas_registered(project_path)

    async def test_lock_same_path_different_formats(self):
        """测试相同路径的不同表示形式使用同一个锁"""
        execution_order = []

        # 使用相对路径
        path1 = Path("test_project_same")

        # 使用绝对路径（应该标准化为相同的）
        path2 = path1.resolve()

        async def task1():
            async with canvas_lock_manager.lock_canvas(path1):
                execution_order.append("task1_start")
                await asyncio.sleep(0.1)
                execution_order.append("task1_end")

        async def task2():
            async with canvas_lock_manager.lock_canvas(path2):
                execution_order.append("task2_start")
                await asyncio.sleep(0.1)
                execution_order.append("task2_end")

        # 并发启动
        await asyncio.gather(task1(), task2())

        # 应该是串行执行（因为它们实际上是同一个画布）
        assert len(execution_order) == 4
        if execution_order[0] == "task1_start":
            assert execution_order == ["task1_start", "task1_end", "task2_start", "task2_end"]
        else:
            assert execution_order == ["task2_start", "task2_end", "task1_start", "task1_end"]


class TestCanvasManagerWithLock:
    """测试 CanvasManager 的 with_lock() 方法"""

    async def test_canvas_manager_with_lock_basic(self):
        """测试 CanvasManager 的基本锁定功能"""
        manager = CanvasManager("test_project")

        # 锁定应该成功
        async with manager.with_lock():
            # 在锁内执行某些操作
            pass

    async def test_canvas_manager_concurrent_lock(self):
        """测试 CanvasManager 的并发锁定"""
        project_path = "test_concurrent_project"
        execution_order = []

        async def task1():
            manager = CanvasManager(project_path)
            async with manager.with_lock():
                execution_order.append("task1_start")
                await asyncio.sleep(0.1)
                execution_order.append("task1_end")

        async def task2():
            manager = CanvasManager(project_path)
            async with manager.with_lock():
                execution_order.append("task2_start")
                await asyncio.sleep(0.1)
                execution_order.append("task2_end")

        # 并发启动两个任务（操作同一个项目）
        await asyncio.gather(task1(), task2())

        # 验证执行顺序：应该是串行的
        assert len(execution_order) == 4
        if execution_order[0] == "task1_start":
            assert execution_order == ["task1_start", "task1_end", "task2_start", "task2_end"]
        else:
            assert execution_order == ["task2_start", "task2_end", "task1_start", "task1_end"]

    async def test_different_canvas_managers_independent(self):
        """测试不同项目的 CanvasManager 锁是独立的"""
        execution_order = []

        async def task1():
            manager = CanvasManager("project1")
            async with manager.with_lock():
                execution_order.append("project1_start")
                await asyncio.sleep(0.1)
                execution_order.append("project1_end")

        async def task2():
            manager = CanvasManager("project2")
            async with manager.with_lock():
                execution_order.append("project2_start")
                await asyncio.sleep(0.1)
                execution_order.append("project2_end")

        # 并发启动两个任务（操作不同的项目）
        await asyncio.gather(task1(), task2())

        # 验证执行顺序：不同项目的锁是独立的
        assert len(execution_order) == 4

        # 由于是并发执行，start 和 end 可能会交错
        project1_start_idx = execution_order.index("project1_start")
        project1_end_idx = execution_order.index("project1_end")
        project2_start_idx = execution_order.index("project2_start")
        project2_end_idx = execution_order.index("project2_end")

        assert project1_start_idx < project1_end_idx
        assert project2_start_idx < project2_end_idx
