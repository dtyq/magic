"""
ChannelKeepalive — 通用 IM 渠道沙箱保活工具。

沙箱容器在 AGENT_IDLE_TIMEOUT 内无活动会自动退出。
当 IM bot 长连接存在但暂时没有消息时，需要定期调用 agent_context.update_activity_time() 重置计时器。
"""
import asyncio
from typing import Callable, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)

# 保活间隔应明显短于空闲超时阈值。
_KEEPALIVE_INTERVAL = 5 * 60
# 连接尚未建立或短暂断开时，快速轮询以避免保活任务提前退出。
_INACTIVE_RETRY_INTERVAL = 5


class ChannelKeepalive:
    """周期性更新 agent context 活跃时间，防止沙箱因 IM 渠道静默期退出。

    用法：
        self._keepalive = ChannelKeepalive("WeCom", is_active=lambda: self.is_connected)
        self._keepalive.start()         # 在 connect() 中调用
        self._keepalive.stop()          # 在 disconnect() 中调用
    """

    def __init__(self, channel_name: str, is_active: Callable[[], bool]) -> None:
        """
        :param channel_name: 日志前缀，用于区分渠道（如 "WeCom"、"DingTalk"、"Lark"）
        :param is_active: 用来判断当前渠道是否在线，在线时正常保活，离线时等一会再重试
        """
        self._channel = channel_name
        self._is_active = is_active
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def start(self) -> None:
        """启动保活后台任务（幂等：已运行则跳过）。"""
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name=f"{self._channel}-keepalive")
        logger.info(f"[{self._channel}Keepalive] 保活任务已启动，间隔 {_KEEPALIVE_INTERVAL}s")

    def stop(self) -> None:
        """停止保活后台任务。"""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        logger.info(f"[{self._channel}Keepalive] 保活任务已停止")

    async def _run(self) -> None:
        from app.service.agent_dispatcher import AgentDispatcher

        try:
            while self._running:
                if not self._is_active():
                    await asyncio.sleep(_INACTIVE_RETRY_INTERVAL)
                    continue

                await asyncio.sleep(_KEEPALIVE_INTERVAL)
                if not self._is_active():
                    logger.debug(f"[{self._channel}Keepalive] 渠道暂时未连接，等待恢复后继续保活")
                    continue

                ctx = AgentDispatcher.get_instance().agent_context
                if ctx:
                    ctx.update_activity_time()
                    logger.debug(f"[{self._channel}Keepalive] 已更新活跃时间")
        except asyncio.CancelledError:
            logger.debug(f"[{self._channel}Keepalive] 保活任务已取消")
