"""
Agent空闲监控服务

监控所有Agent的活动状态，当所有Agent超过指定时间未执行任何任务时自动退出服务
"""
import asyncio
import threading
from collections.abc import Callable
from typing import ClassVar, Optional

from agentlang.environment import Environment
from agentlang.logger import get_logger

logger = get_logger(__name__)


class IdleMonitorService:
    """
    空闲监控服务，负责监控Agent的活动状态并在长时间无活动时退出程序
    """
    _instance: ClassVar[Optional["IdleMonitorService"]] = None

    @classmethod
    def get_instance(cls) -> "IdleMonitorService":
        """获取IdleMonitorService单例实例"""
        if cls._instance is None:
            cls._instance = IdleMonitorService()
        return cls._instance

    def __init__(self) -> None:
        """初始化空闲监控服务"""
        if IdleMonitorService._instance is not None:
            return

        self._monitor_thread: Optional[threading.Thread] = None
        self._running = False
        self._on_idle_timeout: Optional[Callable[[], None]] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._wake_event = threading.Event()
        self._prepare_task: Optional[asyncio.Task[None]] = None

        self._check_interval = Environment.get_idle_monitor_interval()

    def start(self, on_idle_timeout: Callable[[], None]) -> None:
        """启动监控服务"""
        if not Environment.is_agent_idle_monitor_enabled():
            logger.info("空闲监控服务已通过 ENABLE_AGENT_IDLE_MONITOR 禁用")
            return

        if self._running:
            logger.warning("监控服务已经在运行")
            return

        self._running = True
        self._on_idle_timeout = on_idle_timeout
        self._loop = asyncio.get_running_loop()
        self._wake_event.clear()
        self._monitor_thread = threading.Thread(
            target=self._monitor_task,
            name="idle-monitor",
            daemon=True,
        )
        self._monitor_thread.start()

        idle_timeout_seconds = Environment.get_agent_idle_timeout()
        logger.info(
            f"空闲监控服务已启动，超时时间: {idle_timeout_seconds}秒，"
            f"检查间隔: {self._check_interval}秒"
        )

    def _monitor_task(self) -> None:
        """定时请求主事件循环执行空闲检查，不在线程中读取业务运行态。"""
        while self._running:
            try:
                loop = self._loop
                if loop is None or loop.is_closed():
                    return
                loop.call_soon_threadsafe(self._check_idle_on_loop)
                if self._wake_event.wait(timeout=self._check_interval):
                    return
            except Exception as e:
                logger.error(f"监控任务异常: {e}")
                return

    def _check_idle_on_loop(self) -> None:
        """在主事件循环读取 Agent 运行态并触发一次退出请求。"""
        if not self._running:
            return

        try:
            from app.service.agent_dispatcher import AgentDispatcher

            logger.debug("正在进行Agent空闲状态检查...")
            dispatcher = AgentDispatcher.get_instance()
            if not dispatcher.agent_context.is_idle_timeout():
                return
            if self._prepare_task is None or self._prepare_task.done():
                self._prepare_task = asyncio.create_task(
                    self._prepare_idle_exit(), name="prepare-ask-user-idle-exit"
                )
        except Exception as e:
            logger.error(f"监控任务异常: {e}")

    async def _prepare_idle_exit(self) -> None:
        from app.service.agent_dispatcher import AgentDispatcher
        from app.service.user_tool_call_service import UserToolCallService

        context = AgentDispatcher.get_instance().agent_context
        service = UserToolCallService.get_instance()
        try:
            async with asyncio.timeout(Environment.get_sandbox_graceful_shutdown_timeout_seconds()):
                ready = await service.prepare_ask_user_idle_exit(context)
            if not ready or not self._running or not context.is_idle_timeout():
                return
            # 最终检查和关闭请求之间不能让出事件循环，避免刚收到回答就关闭环境。
            if not service.begin_idle_exit():
                return
            idle_timeout_seconds = Environment.get_agent_idle_timeout()
            logger.info(f"Agent已超过{idle_timeout_seconds}秒未执行任何任务，请求关闭服务")
            self._running = False
            self._wake_event.set()
            if self._on_idle_timeout is not None:
                self._on_idle_timeout()
        except TimeoutError:
            logger.warning("AskUser idle-exit persistence timed out; retry on next idle check")
        except Exception as error:
            logger.error("Idle-exit preparation failed: %s", error, exc_info=True)

    def stop(self) -> None:
        """停止监控服务"""
        self._running = False
        self._wake_event.set()
        self._on_idle_timeout = None
        if self._prepare_task is not None and not self._prepare_task.done():
            self._prepare_task.cancel()
        self._loop = None
        if self._monitor_thread and self._monitor_thread.is_alive():
            logger.info("正在停止空闲监控服务")
