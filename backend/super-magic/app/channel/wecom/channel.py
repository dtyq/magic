"""
WeComChannel — 单例，管理 WeCom AI Bot WebSocket 生命周期和消息分发。

连接可由 ConnectWecomBot Tool 触发，也可在检测到已保存配置后于进程启动时自动发起。
"""
from __future__ import annotations

import asyncio
from typing import Optional

from agentlang.logger import get_logger
from wecom_aibot_sdk import WSClient, generate_req_id

from app.channel.base.channel import BaseChannel
from app.core.entity.message.client_message import ChatClientMessage, Metadata
from app.channel.base.keepalive import ChannelKeepalive
from app.channel.base.third_party_message import dispatch_third_party_message
from app.channel.wecom.stream import WeComStream
from app.channel.wecom.streaming_driver import WeComStreamingDriver
from app.channel.config import IMChannelsConfig

logger = get_logger(__name__)


class WeComChannel(BaseChannel):
    key = "wecom"
    label = "企业微信"

    _instance: Optional["WeComChannel"] = None

    def __init__(self) -> None:
        self._ws_client: Optional[WSClient] = None
        self._connect_task: Optional[asyncio.Task] = None
        self._keepalive = ChannelKeepalive("WeCom", is_active=lambda: self.is_connected)

    @classmethod
    def get_instance(cls) -> "WeComChannel":
        if cls._instance is None:
            cls._instance = WeComChannel()
        return cls._instance

    @property
    def is_connected(self) -> bool:
        return self._ws_client is not None and self._ws_client.is_connected

    def summarize_config(self, config: IMChannelsConfig) -> str | None:
        credential = config.wecom
        if credential is None:
            return None

        return f"Bot ID: {credential.bot_id}"

    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        credential = config.wecom
        if credential is None or not credential.enabled:
            return False

        await self.connect(credential.bot_id, credential.secret)
        return True

    async def connect(self, bot_id: str, secret: str) -> None:
        """建立企微 AI Bot WS 连接（幂等：已连接则先断开再重连）。"""
        if self.is_connected:
            logger.info("[WeComChannel] 已有连接，先断开再重连")
            await self.disconnect()

        self._ws_client = WSClient(
            bot_id=bot_id,
            secret=secret,
            max_reconnect_attempts=-1,
        )
        self._ws_client.on("authenticated", lambda: logger.info("[WeComChannel] 认证成功"))
        self._ws_client.on("disconnected", lambda reason: logger.warning(f"[WeComChannel] 断开: {reason}"))
        self._ws_client.on("error", lambda e: logger.error(f"[WeComChannel] 错误: {e}"))
        self._ws_client.on("message.text", self._on_text)

        self._connect_task = asyncio.create_task(self._ws_client.connect())
        self._keepalive.start()
        logger.info(f"[WeComChannel] 连接中，bot_id={bot_id}")

    async def disconnect(self) -> None:
        """断开连接并清理资源。"""
        self._keepalive.stop()
        if self._ws_client:
            await self._ws_client.disconnect()
            self._ws_client = None
        if self._connect_task and not self._connect_task.done():
            self._connect_task.cancel()
        self._connect_task = None
        logger.info("[WeComChannel] 已断开")

    async def _on_text(self, frame: dict) -> None:
        """处理文本消息：注册 stream + streaming sink → dispatch_agent → 清理。"""
        from app.service.agent_dispatcher import AgentDispatcher

        dispatcher = AgentDispatcher.get_instance()
        if not dispatcher.agent_context:
            logger.error("[WeComChannel] agent_context 未初始化，忽略消息")
            return

        body = frame.get("body", {})
        content = body.get("text", {}).get("content", "").strip()
        if not content:
            return

        sender = body.get("sender", {})
        user_id = sender.get("userid", "wecom_user")

        stream_id = generate_req_id("wecom")
        ctx = dispatcher.agent_context

        # WeComStreamingDriver：token 级，负责流式推送 finish=False（模型不支持流式时静默）
        wecom_driver = WeComStreamingDriver(self._ws_client, frame, stream_id)
        # WeComStream：事件级，负责捕获内容 + 发送 finish=True；需引用 driver 以读取推理数据
        wecom_stream = WeComStream(self._ws_client, frame, stream_id, wecom_driver)

        ctx.add_stream(wecom_stream)
        ctx.add_streaming_sink(wecom_driver)

        chat_msg = ChatClientMessage(
            message_id=stream_id,
            prompt=content,
            metadata=Metadata(agent_user_id=user_id),
        )
        logger.info(f"[WeComChannel] 分发消息: user_id={user_id}, len={len(content)}")
        await dispatch_third_party_message(
            dispatcher=dispatcher,
            channel=self.key,
            source_message_id=stream_id,
            source_conversation_id="",
            source_sender_id=user_id,
            chat_message=chat_msg,
        )

        async def _cleanup() -> None:
            ctx.remove_stream(wecom_stream)
            ctx.remove_streaming_sink(wecom_driver)

        ctx.register_run_cleanup("wecom_stream", _cleanup)
