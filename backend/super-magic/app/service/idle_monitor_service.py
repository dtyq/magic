"""
Agent空闲监控服务

监控所有Agent的活动状态，当所有Agent超过指定时间未执行任何任务时自动退出服务
"""
import threading
import time
import os
import signal
from agentlang.environment import Environment
from agentlang.logger import get_logger

logger = get_logger(__name__)

class IdleMonitorService:
    """
    空闲监控服务，负责监控Agent的活动状态并在长时间无活动时退出程序
    """
    _instance = None

    @classmethod
    def get_instance(cls):
        """获取IdleMonitorService单例实例"""
        if cls._instance is None:
            cls._instance = IdleMonitorService()
        return cls._instance

    def __init__(self):
        """初始化空闲监控服务"""
        if IdleMonitorService._instance is not None:
            return

        self._monitor_thread = None
        self._running = False

        self._check_interval = Environment.get_idle_monitor_interval()

    def start(self):
        """启动监控服务"""
        if self._running:
            logger.warning("监控服务已经在运行")
            return

        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_task, daemon=True)
        self._monitor_thread.start()

        idle_timeout_seconds = Environment.get_agent_idle_timeout()
        logger.info(f"空闲监控服务已启动，超时时间: {idle_timeout_seconds}秒，检查间隔: {self._check_interval}秒")

    def _monitor_task(self):
        """监控任务主循环"""
        from app.service.agent_dispatcher import AgentDispatcher

        while self._running:
            try:
                logger.info("正在进行Agent空闲状态检查...")
                dispatcher = AgentDispatcher.get_instance()
                if dispatcher.agent_context.is_idle_timeout():
                    idle_timeout_seconds = Environment.get_agent_idle_timeout()
                    logger.info(f"Agent已超过{idle_timeout_seconds}秒未执行任何任务，发送退出信号")
                    os.kill(os.getpid(), signal.SIGTERM)

                time.sleep(self._check_interval)
            except Exception as e:
                logger.error(f"监控任务异常: {e}")
                time.sleep(self._check_interval)

    def stop(self):
        """停止监控服务"""
        self._running = False
        if self._monitor_thread and self._monitor_thread.is_alive():
            logger.info("正在停止空闲监控服务")
