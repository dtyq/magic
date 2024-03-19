"""
ChannelKeepalive — 通用 IM 渠道沙箱保活工具。

沙箱容器在 AGENT_IDLE_TIMEOUT（默认 1h，但实际部署可能配置为 30min）内无活动会自动退出。
当 IM bot 持续连接但无消息时，需要定期调用 agent_context.update_activity_time() 来重置计时器。
"""
import asyncio
from typing import Callable, Optional

from agentlang.logger import get_logger

logger = get_logger(__name__)

# 保活间隔 5 分钟，远小于最严格的 30 分钟超时阈值
_KEEPALIVE_INTERVAL = 5 * 60


class ChannelKeepalive:
    """周期性更新 agent context 活跃时间，防止沙箱因 IM 渠道静默期退出。

    用法：
        self._keepalive = ChannelKeepalive("WeCom", is_active=lambda: self.is_connected)
        await self._keepalive.start()   # 在 connect() 中调用
        self._keepalive.stop()          # 在 disconnect() 中调用
    """

    def __init__(self, channel_name: str, is_active: Callable[[], bool]) -> None:
        """
        :param channel_name: 日志前缀，用于区分渠道（如 "WeCom"、"DingTalk"、"Lark"）
        :param is_active: 返回当前渠道是否仍然连接的谓词，为 False 时保活循环自动退出
        """
        self._channel = channel_name
        self._is_active = is_active
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        """启动保活后台任务（幂等：已运行则跳过）。"""
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name=f"{self._channel}-keepalive")
        logger.info(f"[{self._channel}Keepalive] 保活任务已启动，间隔 {_KEEPALIVE_INTERVAL}s")

    def stop(self) -> None:
        """停止保活后台任务。"""
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        logger.info(f"[{self._channel}Keepalive] 保活任务已停止")

    async def _run(self) -> None:
        from app.service.agent_dispatcher import AgentDispatcher

        try:
            while self._is_active():
                await asyncio.sleep(_KEEPALIVE_INTERVAL)
                if not self._is_active():
                    break
                ctx = AgentDispatcher.get_instance().agent_context
                if ctx:
                    ctx.update_activity_time()
                    logger.debug(f"[{self._channel}Keepalive] 已更新活跃时间")
        except asyncio.CancelledError:
            pass
