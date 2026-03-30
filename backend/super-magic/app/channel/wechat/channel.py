"""
WechatChannel — 单例，管理微信官方 ClawBot HTTP 长轮询生命周期和消息分发。

实现目标：
- getUpdates 轮询模型尽量贴合官方 monitor.ts
- 入站消息解析尽量贴合官方 inbound.ts
- 仅在 super-magic 接线处保留最薄的一层适配
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.channel import BaseChannel
from app.channel.config import IMChannelsConfig, WechatCredential
from app.channel.wechat import api
from app.channel.wechat.state import load_runtime_state, save_get_updates_buf
from app.channel.wechat.stream import WechatStream
from app.channel.wechat.typing import WechatTypingConfigManager, WechatTypingController
from app.channel.base.third_party_message import dispatch_third_party_message
from app.core.entity.message.client_message import ChatClientMessage, Metadata

logger = get_logger(__name__)

DEFAULT_LONG_POLL_TIMEOUT_MS = api.DEFAULT_LONG_POLL_TIMEOUT_MS
MAX_CONSECUTIVE_FAILURES = 3
BACKOFF_DELAY_MS = 30_000
RETRY_DELAY_MS = 2_000


class WechatChannel(BaseChannel):
    key = "wechat"
    label = "微信"

    _instance: Optional["WechatChannel"] = None

    def __init__(self) -> None:
        self._credential: Optional[WechatCredential] = None
        self._http_session: Optional[aiohttp.ClientSession] = None
        self._poll_task: Optional[asyncio.Task] = None
        self._get_updates_buf: str = ""
        self._typing_config_manager: Optional[WechatTypingConfigManager] = None
        self._session_pause_until_ms: int = 0

    @classmethod
    def get_instance(cls) -> "WechatChannel":
        if cls._instance is None:
            cls._instance = WechatChannel()
        return cls._instance

    @property
    def is_connected(self) -> bool:
        return (
            self._poll_task is not None
            and not self._poll_task.done()
            and self._credential is not None
        )

    def summarize_config(self, config: IMChannelsConfig) -> str | None:
        credential = config.wechat
        if credential is None:
            return None
        return f"Bot ID: {credential.ilink_bot_id}"

    def render_status_lines(self, config: IMChannelsConfig) -> list[str]:
        from app.channel.wechat.login import LoginStatus, WechatLoginManager

        credential = config.wechat
        lines = [self.key]
        active_session = WechatLoginManager.get_instance().get_active_session()

        if self.is_session_paused:
            remaining_ms = self.get_session_pause_remaining_ms()
            remaining_minutes = max(1, (remaining_ms + 59_999) // 60_000)
            lines.append(f"  Status: session paused (retry in about {remaining_minutes} minute(s))")
            if credential is not None:
                lines.append(f"  Bot ID: {credential.ilink_bot_id}")
                if credential.ilink_user_id:
                    lines.append(f"  User ID: {credential.ilink_user_id}")
            return lines

        if self.is_connected and credential is not None:
            lines.append("  Status: connected")
            lines.append(f"  Bot ID: {credential.ilink_bot_id}")
            if credential.ilink_user_id:
                lines.append(f"  User ID: {credential.ilink_user_id}")
            lines.append(f"  Auto-connect: {'enabled' if credential.enabled else 'disabled'}")
            return lines

        if active_session and active_session.is_active():
            status_map = {
                LoginStatus.WAITING: "waiting for QR scan",
                LoginStatus.SCANNED: "scanned, waiting for confirmation",
            }
            lines.append(f"  Status: {status_map.get(active_session.status, 'login in progress')}")
            lines.append("  QR delivery: active in the current chat")
            return lines

        if credential is not None:
            lines.append("  Status: configured but disconnected")
            lines.append(f"  Bot ID: {credential.ilink_bot_id}")
            if credential.ilink_user_id:
                lines.append(f"  User ID: {credential.ilink_user_id}")
            return lines

        lines.append("  Status: not configured")
        return lines

    @property
    def is_session_paused(self) -> bool:
        return self.get_session_pause_remaining_ms() > 0

    def get_session_pause_remaining_ms(self) -> int:
        remaining_ms = self._session_pause_until_ms - int(time.time() * 1000)
        if remaining_ms <= 0:
            self._session_pause_until_ms = 0
            return 0
        return remaining_ms

    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        credential = config.wechat
        if credential is None or not credential.enabled:
            return False
        await self.connect(credential)
        return True

    async def connect(self, credential: WechatCredential) -> None:
        """启动 getupdates 长轮询（幂等：已运行则先停止再重启）。"""
        if self.is_connected:
            logger.info("[WechatChannel] 已有连接，先停止再重连")
            await self.disconnect()

        self._credential = credential
        self._http_session = aiohttp.ClientSession()
        self._typing_config_manager = WechatTypingConfigManager(
            http_session=self._http_session,
            base_url=credential.base_url,
            token=credential.bot_token,
        )
        state = await load_runtime_state()
        self._get_updates_buf = state.get_updates_buf
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info(
            f"[WechatChannel] 启动轮询, ilink_bot_id={credential.ilink_bot_id}, "
            f"get_updates_buf_len={len(self._get_updates_buf)}"
        )

    async def disconnect(self) -> None:
        """停止长轮询并释放 HTTP 会话。"""
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        self._poll_task = None

        if self._http_session:
            await self._http_session.close()
            self._http_session = None

        self._typing_config_manager = None
        self._credential = None
        self._session_pause_until_ms = 0
        logger.info("[WechatChannel] 已断开")

    async def _sleep_ms(self, delay_ms: int) -> None:
        await asyncio.sleep(max(delay_ms, 0) / 1000)

    async def _pause_for_session_expired(self) -> None:
        self._session_pause_until_ms = int(time.time() * 1000) + api.SESSION_PAUSE_DURATION_MS
        remaining_minutes = max(1, int((api.SESSION_PAUSE_DURATION_MS + 59_999) / 60_000))
        logger.error(
            f"[WechatChannel] session 已过期(errcode={api.SESSION_EXPIRED_ERRCODE})，"
            f"暂停所有轮询约 {remaining_minutes} 分钟"
        )
        # 向最近的对话推送过期通知，提示用户重新发起扫码登录
        # TODO: 当前直接调用 send_message，可能与正在处理的 Agent 任务产生竞争；
        #       后续应将此通知投入消息队列，由统一调度层在任务间隙发出
        await self._notify_session_expired()
        await self._sleep_ms(self.get_session_pause_remaining_ms())

    async def _notify_session_expired(self) -> None:
        """向 LLM 的对话历史注入 session 过期通知，下次任务时 Agent 可感知并主动引导扫码登录。"""
        from app.service.agent_dispatcher import AgentDispatcher

        dispatcher = AgentDispatcher.get_instance()
        chat_history = getattr(dispatcher.agent_context, "chat_history", None) if dispatcher.agent_context else None
        if chat_history is None:
            logger.warning("[WechatChannel] chat_history 不可用，无法注入 session 过期通知")
            return
        try:
            await chat_history.append_user_message(
                "[System Note] WeChat session has expired. "
                "No further messages can be received via WeChat. "
                "To reconnect, initiate a new WeChat QR code login flow.",
                show_in_ui=False,
            )
            logger.info("[WechatChannel] 已向 LLM 上下文注入 session 过期通知")
        except Exception as e:
            logger.warning(f"[WechatChannel] 注入 session 过期通知失败: {e}")

    async def _poll_loop(self) -> None:
        """持续调用 getUpdates，将收到的消息分发给 AgentDispatcher。"""
        assert self._credential is not None
        assert self._http_session is not None

        next_timeout_ms = DEFAULT_LONG_POLL_TIMEOUT_MS
        consecutive_failures = 0

        while True:
            if self.is_session_paused:
                await self._sleep_ms(self.get_session_pause_remaining_ms())
                continue

            try:
                data = await api.get_updates(
                    self._http_session,
                    base_url=self._credential.base_url,
                    token=self._credential.bot_token,
                    get_updates_buf=self._get_updates_buf,
                    timeout_ms=next_timeout_ms,
                )
            except asyncio.CancelledError:
                raise
            except Exception as e:
                consecutive_failures += 1
                logger.error(
                    f"[WechatChannel] getUpdates 异常 ({consecutive_failures}/{MAX_CONSECUTIVE_FAILURES}): {e}"
                )
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    consecutive_failures = 0
                    await asyncio.sleep(BACKOFF_DELAY_MS / 1000)
                else:
                    await asyncio.sleep(RETRY_DELAY_MS / 1000)
                continue

            if data.get("longpolling_timeout_ms"):
                next_timeout_ms = int(data["longpolling_timeout_ms"])

            if api.is_api_error_response(data):
                if api.is_session_expired_response(data):
                    consecutive_failures = 0
                    await self._pause_for_session_expired()
                    continue

                consecutive_failures += 1
                logger.error(
                    f"[WechatChannel] getUpdates failed: ret={data.get('ret')} "
                    f"errcode={data.get('errcode')} errmsg={data.get('errmsg')}"
                )
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    consecutive_failures = 0
                    await asyncio.sleep(BACKOFF_DELAY_MS / 1000)
                else:
                    await asyncio.sleep(RETRY_DELAY_MS / 1000)
                continue

            consecutive_failures = 0
            if data.get("get_updates_buf"):
                self._get_updates_buf = data["get_updates_buf"]
                try:
                    await save_get_updates_buf(self._get_updates_buf)
                except Exception as e:
                    logger.warning(f"[WechatChannel] 持久化 get_updates_buf 失败: {e}")

            for msg in data.get("msgs") or []:
                try:
                    await self._handle_message(msg)
                except Exception as e:
                    logger.error(f"[WechatChannel] 消息处理异常: {e}")

    async def _handle_message(self, msg: dict) -> None:
        """提取文本与 context_token，下载媒体，转发给 AgentDispatcher。"""
        from app.service.agent_dispatcher import AgentDispatcher
        from app.channel.wechat.media import download_message_media

        dispatcher = AgentDispatcher.get_instance()
        if not dispatcher.agent_context:
            logger.error("[WechatChannel] agent_context 未初始化，忽略消息")
            return

        content = api.extract_text_from_item_list(msg.get("item_list"))
        if not content:
            return

        context_token: str = msg.get("context_token", "")
        user_id: str = msg.get("from_user_id", "wechat_user")

        # 下载媒体（图片/视频/文件/无转文字的语音），失败不阻断主流程
        assert self._http_session is not None
        media_rel_path: str | None = None
        try:
            media_rel_path = await download_message_media(
                self._http_session, msg.get("item_list") or [], user_id
            )
        except Exception as e:
            logger.warning(f"[WechatChannel] 媒体下载失败，忽略: {e}")

        if media_rel_path:
            content = f"{content}\n\n[Media saved to workspace: {media_rel_path}]"
            logger.info(f"[WechatChannel] 媒体已保存: {media_rel_path}")


        assert self._credential is not None

        stream_id = msg.get("client_id") or msg.get("message_id") or f"wechat-{user_id}-{id(msg)}"
        ctx = dispatcher.agent_context
        typing_controller: WechatTypingController | None = None

        if self._typing_config_manager is not None:
            try:
                typing_ticket = await self._typing_config_manager.get_typing_ticket(
                    user_id,
                    context_token=context_token,
                )
                if typing_ticket:
                    typing_controller = WechatTypingController(
                        http_session=self._http_session,
                        base_url=self._credential.base_url,
                        token=self._credential.bot_token,
                        ilink_user_id=user_id,
                        typing_ticket=typing_ticket,
                    )
                    await typing_controller.start()
            except Exception as e:
                logger.warning(f"[WechatChannel] typing 启动失败，继续主流程: {e}")

        wechat_stream = WechatStream(
            http_session=self._http_session,
            bot_token=self._credential.bot_token,
            to_user_id=user_id,
            context_token=context_token,
            base_url=self._credential.base_url,
            stream_id=stream_id,
            typing_controller=typing_controller,
        )
        ctx.add_stream(wechat_stream)

        chat_msg = ChatClientMessage(
            message_id=stream_id,
            prompt=content,
            metadata=Metadata(agent_user_id=user_id),
        )
        logger.info(f"[WechatChannel] 分发消息: user_id={user_id}, len={len(content)}")

        # 打断当前 run（如有），以非阻塞 task 启动新 run，poll 循环可继续接收消息
        await dispatch_third_party_message(
            dispatcher=dispatcher,
            channel=self.key,
            source_message_id=stream_id,
            source_conversation_id=context_token,
            source_sender_id=user_id,
            chat_message=chat_msg,
        )

        # 在 reset_run_state 之后注册本次 run 的 stream/typing cleanup
        async def _stream_cleanup() -> None:
            ctx.remove_stream(wechat_stream)
            if typing_controller is not None:
                await typing_controller.stop()

        ctx.register_run_cleanup("wechat_stream", _stream_cleanup)
