"""
子进程管理模块，提供独立的子进程管理功能

此模块实现了一个可靠的子进程管理器，用于在FastAPI应用中管理长时间运行的后台进程。
主要功能包括：
1. 创建和管理独立的子进程
2. 优雅地处理进程的终止和资源清理
3. 集成FastAPI生命周期事件
4. 提供异步接口与FastAPI的异步模型兼容
"""

import asyncio
import logging
import multiprocessing as mp
import os
import signal
import subprocess
import time
from typing import Any, Callable, Dict, Optional, List


from agentlang.logger import get_logger

logger = get_logger(__name__)

class WorkerProcess:
    """工作进程包装类，用于管理单个子进程"""

    def __init__(self, worker_function: Callable, *args: Any, **kwargs: Any):
        """
        初始化工作进程

        Args:
            worker_function: 要在子进程中运行的函数
            args: 传递给工作函数的位置参数
            kwargs: 传递给工作函数的关键字参数
        """
        self.worker_function = worker_function
        self.args = args
        self.kwargs = kwargs
        self.process: Optional[mp.Process] = None
        self.start_time: Optional[float] = None

    def start(self) -> int:
        """
        启动工作进程

        Returns:
            int: 进程ID
        """
        self.process = mp.Process(
            target=self.worker_function,
            args=self.args,
            kwargs=self.kwargs,
            daemon=True  # 设置为守护进程，主进程结束时自动结束
        )
        self.process.start()
        self.start_time = time.time()
        logger.info(f"工作进程已启动: PID={self.process.pid}")
        return self.process.pid

    def terminate(self, timeout: int = 5) -> bool:
        """
        终止工作进程，直接使用强制终止信号

        Args:
            timeout: 等待进程终止的超时时间(秒)

        Returns:
            bool: 终止是否成功
        """
        if not self.process or not self.process.is_alive():
            logger.warning("尝试终止一个不存在或已终止的进程")
            return True

        logger.info(f"正在强制终止工作进程 PID={self.process.pid}")

        # 直接使用强制终止 (SIGKILL)
        try:
            os.kill(self.process.pid, signal.SIGKILL)
            self.process.join(timeout=timeout)  # 等待进程终止
        except Exception as e:
            logger.error(f"强制终止工作进程时出错: {e}")
            return False

        logger.info(f"工作进程(PID={self.process.pid})已终止")
        return True

    def is_alive(self) -> bool:
        """
        检查进程是否仍在运行

        Returns:
            bool: 进程是否存活
        """
        return self.process is not None and self.process.is_alive()

    def get_info(self) -> Dict[str, Any]:
        """
        获取进程信息

        Returns:
            Dict: 包含进程信息的字典
        """
        if not self.process:
            return {"status": "not_started"}

        return {
            "pid": self.process.pid,
            "status": "running" if self.process.is_alive() else "terminated",
            "exit_code": self.process.exitcode if not self.process.is_alive() else None,
            "uptime": time.time() - self.start_time if self.start_time else None
        }


class ProcessManager:
    """进程管理器，管理多个工作进程"""

    _instance = None  # 单例实例

    @staticmethod
    def run_command(cmd, cwd=None, **kwargs):
        """通用的命令行执行函数

        Args:
            cmd: 命令行参数列表
            cwd: 工作目录
            **kwargs: 其他传递给subprocess.Popen的参数
        """
        try:
            # 设置子进程的日志
            logger = logging.getLogger("cmd_runner")
            logger.info(f"命令行子进程启动: {' '.join(cmd if isinstance(cmd, list) else [cmd])}")

            # 启动进程
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=cwd,
                **kwargs
            )

            # 读取并记录输出
            for line in iter(process.stdout.readline, ''):
                if line:
                    logger.info(f"命令输出: {line.rstrip()}")

            process.stdout.close()
            return_code = process.wait()
            logger.info(f"命令行进程已退出，返回码: {return_code}")

        except Exception as e:
            logger.error(f"命令行子进程异常: {e}")
            import traceback
            logger.error(traceback.format_exc())

    @classmethod
    def get_instance(cls) -> 'ProcessManager':
        """
        获取ProcessManager的单例实例

        Returns:
            ProcessManager: 单例实例
        """
        if cls._instance is None:
            cls._instance = ProcessManager()
        return cls._instance

    def __init__(self):
        """初始化进程管理器"""
        self.workers: Dict[str, WorkerProcess] = {}
        self._shutdown_event = asyncio.Event()
        self._monitor_task = None
        logger.info("进程管理器已初始化")

    async def start_worker(self, name: str, worker_function: Callable, *args: Any, **kwargs: Any) -> int:
        """
        异步启动一个新的工作进程

        Args:
            name: 进程的唯一名称
            worker_function: 要在子进程中运行的函数
            args: 传递给工作函数的位置参数
            kwargs: 传递给工作函数的关键字参数

        Returns:
            int: 进程ID
        """
        # 如果已存在同名进程，先停止它
        if name in self.workers:
            await self.stop_worker(name)

        # 创建并启动新进程
        loop = asyncio.get_event_loop()
        worker = WorkerProcess(worker_function, *args, **kwargs)

        # 在线程池中运行start方法，避免阻塞事件循环
        pid = await loop.run_in_executor(None, worker.start)

        # 记录进程
        self.workers[name] = worker
        logger.info(f"工作进程 '{name}' 已启动，PID={pid}")

        # 如果监控任务未运行，启动它
        if self._monitor_task is None or self._monitor_task.done():
            self._monitor_task = asyncio.create_task(self._monitor_workers())

        return pid

    async def start_worker_with_cmd(self, name: str, cmd: List[str], cwd: str = None, **kwargs: Any) -> int:
        """
        异步启动一个新的命令行工作进程

        Args:
            name: 进程的唯一名称
            cmd: 要执行的命令行列表
            cwd: 工作目录
            kwargs: 传递给subprocess.Popen的其他参数

        Returns:
            int: 进程ID
        """
        # 如果已存在同名进程，先停止它
        if name in self.workers:
            await self.stop_worker(name)

        # 创建并启动新进程
        loop = asyncio.get_event_loop()
        worker = WorkerProcess(self.run_command, cmd, cwd, **kwargs)

        # 在线程池中运行start方法，避免阻塞事件循环
        pid = await loop.run_in_executor(None, worker.start)

        # 记录进程
        self.workers[name] = worker
        logger.info(f"命令行工作进程 '{name}' 已启动，PID={pid}")

        # 如果监控任务未运行，启动它
        if self._monitor_task is None or self._monitor_task.done():
            self._monitor_task = asyncio.create_task(self._monitor_workers())

        return pid

    async def stop_worker(self, name: str, timeout: int = 5) -> bool:
        """
        异步停止一个工作进程

        Args:
            name: 进程名称
            timeout: 等待进程终止的超时时间(秒)

        Returns:
            bool: 操作是否成功
        """
        if name not in self.workers:
            logger.warning(f"尝试停止不存在的工作进程: {name}")
            return False

        worker = self.workers[name]
        loop = asyncio.get_event_loop()

        # 在线程池中运行terminate方法
        success = await loop.run_in_executor(None, lambda: worker.terminate(timeout))

        if success:
            # 从字典中移除
            del self.workers[name]
            logger.info(f"工作进程 '{name}' 已停止并从管理器移除")

        return success

    async def stop_all(self, timeout: int = 5) -> Dict[str, bool]:
        """
        异步停止所有工作进程

        Args:
            timeout: 等待每个进程终止的超时时间(秒)

        Returns:
            Dict[str, bool]: 每个进程名称及其停止是否成功的映射
        """
        logger.info("正在停止所有工作进程...")

        # 设置关闭事件，停止监控任务
        self._shutdown_event.set()
        if self._monitor_task and not self._monitor_task.done():
            try:
                self._monitor_task.cancel()
                await asyncio.sleep(0.1)  # 给任务一点时间取消
            except asyncio.CancelledError:
                pass

        results = {}
        worker_names = list(self.workers.keys())

        # 并发停止所有进程
        tasks = [self.stop_worker(name, timeout) for name in worker_names]
        if tasks:
            results_list = await asyncio.gather(*tasks, return_exceptions=True)
            results = {name: result for name, result in zip(worker_names, results_list) if not isinstance(result, Exception)}

            # 处理异常
            for name, result in zip(worker_names, results_list):
                if isinstance(result, Exception):
                    logger.error(f"停止工作进程 '{name}' 时出错: {result}")
                    results[name] = False

        logger.info(f"所有工作进程停止操作完成，结果: {results}")
        return results

    async def get_worker_info(self, name: str = None) -> Dict[str, Any]:
        """
        获取特定工作进程或所有进程的信息

        Args:
            name: 进程名称，如果为None则返回所有进程信息

        Returns:
            Dict: 包含进程信息的字典
        """
        if name:
            if name in self.workers:
                return {name: self.workers[name].get_info()}
            return {}

        return {name: worker.get_info() for name, worker in self.workers.items()}

    async def _monitor_workers(self) -> None:
        """
        监控工作进程状态的后台任务

        自动检测退出的进程并从管理器中移除
        """
        logger.info("进程监控任务已启动")
        try:
            while not self._shutdown_event.is_set():
                for name in list(self.workers.keys()):
                    worker = self.workers.get(name)
                    if worker and not worker.is_alive():
                        info = worker.get_info()
                        logger.info(f"检测到工作进程 '{name}' 已退出，退出码: {info.get('exit_code')}")
                        # 从字典中移除已退出的进程
                        del self.workers[name]

                # 每秒检查一次
                try:
                    await asyncio.wait_for(self._shutdown_event.wait(), timeout=1)
                except asyncio.TimeoutError:
                    pass  # 预期的超时，继续循环

        except asyncio.CancelledError:
            logger.info("进程监控任务已取消")
        except Exception as e:
            logger.error(f"进程监控任务出错: {e}", exc_info=True)
        finally:
            logger.info("进程监控任务已结束")
