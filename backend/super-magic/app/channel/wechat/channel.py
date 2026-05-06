"""
WechatChannel — 单例，管理微信官方 ClawBot HTTP 长轮询生命周期和消息分发。

实现目标：
- getUpdates 轮询模型尽量贴合官方 monitor.ts
- 入站消息解析尽量贴合官方 inbound.ts
- 仅在 super-magic 接线处保留最薄的一层适配
"""
from __future__ import annotations

import asyncio
import uuid
from typing import List, Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.channel import BaseChannel
from app.channel.config import IMChannelsConfig, WechatCredential
from app.channel.wechat import api
from app.channel.wechat.state import (
    WechatUserContext,
    WechatRuntimeState,
    get_latest_context,
    load_runtime_state,
    save_context_token,
    save_runtime_state,
)
from app.channel.wechat.stream import WechatStream
from app.channel.wechat.typing import WechatTypingConfigManager, WechatTypingController
from app.channel.base.third_party_message import dispatch_third_party_message
from app.core.keepalive_registry import KeepaliveRegistry
from app.core.entity.message.client_message import ChatClientMessage, Metadata
from app.utils.time_utils import now_ms

logger = get_logger(__name__)

DEFAULT_LONG_POLL_TIMEOUT_MS = api.DEFAULT_LONG_POLL_TIMEOUT_MS
MAX_CONSECUTIVE_FAILURES = 3
BACKOFF_DELAY_MS = 30_000
RETRY_DELAY_MS = 2_000


class WechatChannel(BaseChannel):
    key = "wechat"
    label = "微信"
    source_name = "WeChat"

    _instance: Optional["WechatChannel"] = None

    def __init__(self) -> None:
        self._credential: Optional[WechatCredential] = None
        self._http_session: Optional[aiohttp.ClientSession] = None
        self._poll_task: Optional[asyncio.Task] = None
        self._get_updates_buf: str = ""
        self._typing_config_manager: Optional[WechatTypingConfigManager] = None
        self._last_message_at_ms: int = 0
        # 缓存最近活跃用户和按用户保存的 context_token，供回复与主动发送复用
        self._last_active_user_id: Optional[str] = None
        self._context_tokens_by_user: dict[str, WechatUserContext] = {}
        # 防止 connect_wechat_bot 的 _on_success 回调与 wait_wechat_login._activate_channel
        # 并发调用 connect() 导致双重启动（两条路径都会在扫码成功后触发激活）
        self._connect_lock: asyncio.Lock = asyncio.Lock()

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

    def build_agent_context_fragment(self, message: ChatClientMessage | None) -> str:
        ctx = message.channel_context if message else None
        raw_media: List[dict] = ctx.get("wechat_media", []) if ctx else []

        if not raw_media:
            return f'<im source="{self.source_name}" />'

        lines = [f'<im source="{self.source_name}">', "  <media>"]
        for item in raw_media:
            quoted = ' from="quoted"' if item.get("from_quote") else ""
            lines.append(
                f'    <file type="{item.get("media_type")}" mime="{item.get("mime_type")}"'
                f' path="{item.get("relative_path")}"{quoted} />'
            )
        lines.extend(["  </media>", "</im>"])
        return "\n".join(lines)

    def render_status_lines(self, config: IMChannelsConfig) -> list[str]:
        from app.channel.wechat.login import LoginStatus, WechatLoginManager

        credential = config.wechat
        lines = [self.key]
        active_session = WechatLoginManager.get_instance().get_active_session()

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
            reason_suffix = f" ({credential.disabled_reason})" if credential.disabled_reason else ""
            lines.append(f"  Status: configured but disconnected{reason_suffix}")
            lines.append(f"  Bot ID: {credential.ilink_bot_id}")
            if credential.ilink_user_id:
                lines.append(f"  User ID: {credential.ilink_user_id}")
            return lines

        lines.append("  Status: not configured")
        return lines

    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        credential = config.wechat
        if credential is None or not credential.enabled:
            return False
        await self.connect(credential)
        return True

    async def connect(self, credential: WechatCredential) -> None:
        """启动 getupdates 长轮询（幂等：已连接且凭据相同时跳过；凭据不同则先断后连）。
        持锁执行，防止 _on_success 回调与 wait_wechat_login._activate_channel 并发重入
        导致双重启动（两个 poll_task + http_session 泄漏）。
        """
        async with self._connect_lock:
            if self.is_connected:
                if (
                    self._credential is not None
                    and self._credential.ilink_bot_id == credential.ilink_bot_id
                ):
                    logger.info("[WechatChannel] 凭据相同且已连接，跳过重连")
                    return
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
            self._last_message_at_ms = state.last_message_at_ms
            self._last_active_user_id = state.last_active_user_id or None
            self._context_tokens_by_user = dict(state.context_tokens_by_user)
            self._poll_task = asyncio.create_task(self._poll_loop())
            keepalive_registry = KeepaliveRegistry.get_instance()
            keepalive_registry.restore_activity_time(self.key, self._last_message_at_ms)
            logger.info(
                f"[WechatChannel] 启动轮询, ilink_bot_id={credential.ilink_bot_id}, "
                f"get_updates_buf_len={len(self._get_updates_buf)}"
            )

    async def disconnect(self) -> None:
        """停止长轮询并释放 HTTP 会话。"""
        KeepaliveRegistry.get_instance().reset_source(self.key)
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
        logger.info("[WechatChannel] 已断开")

    async def _disable_in_config(self, reason: str = "") -> None:
        """关闭持久化配置的 enabled 并记录原因，防止 AFTER_INIT 反复重连。

        用户重新扫码会写入新凭据并重新 enabled=True + 清空 disabled_reason。
        """
        try:
            from app.channel.config import load_config, save_config
            config = await load_config()
            if config.wechat and config.wechat.enabled:
                config.wechat.enabled = False
                config.wechat.disabled_reason = reason
                await save_config(config)
                logger.info(f"[WechatChannel] 已将 wechat.enabled 设为 False（reason={reason or 'unknown'}）")
        except Exception as e:
            logger.warning(f"[WechatChannel] 关闭 wechat.enabled 失败: {e}")

    async def _sleep_ms(self, delay_ms: int) -> None:
        await asyncio.sleep(max(delay_ms, 0) / 1000)

    def _handle_session_expired(self) -> None:
        """session 过期：自动断连 + 关闭配置 + 通知 LLM，用户扫码重连后自动恢复。

        常见原因：用户在另一个 MagiClaw 实例上扫码绑定了同一微信号，导致当前 session 被踢下线。
        """
        from app.channel.config import DisabledReason

        logger.warning(f"[WechatChannel] session 已过期(errcode={api.SESSION_EXPIRED_ERRCODE})，自动断连")
        asyncio.create_task(self.disconnect())
        asyncio.create_task(self._disable_in_config(reason=DisabledReason.SESSION_EXPIRED))
        try:
            from app.service.agent_dispatcher import AgentDispatcher
            ctx = AgentDispatcher.get_instance().agent_context
            if ctx is not None:
                ctx.horizon.push_notification(
                    source="wechat",
                    content=(
                        "WeChat session has expired and the channel has been disconnected. "
                        "This usually means the user scanned a QR code on another MagiClaw instance, "
                        "so the current session was kicked off. "
                        "Casually let the user know when appropriate — they can reconnect by scanning a new QR code, "
                        "or leave it disconnected. Don't treat this as a blocking issue. "
                        "If you are unsure how to initiate a WeChat reconnection, "
                        "read 'im-channels' skill first."
                    ),
                )
        except Exception as e:
            logger.warning(f"[WechatChannel] 推送 session 过期通知失败: {e}")

    async def _poll_loop(self) -> None:
        """持续调用 getUpdates，将收到的消息分发给 AgentDispatcher。"""
        assert self._credential is not None
        assert self._http_session is not None

        next_timeout_ms = DEFAULT_LONG_POLL_TIMEOUT_MS
        consecutive_failures = 0

        while True:
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
                    self._handle_session_expired()
                    return

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
            # 微信长轮询没有单独的“connected”回调。
            # 这里以首次成功拿到 getUpdates 响应作为“连接已真正可用”的信号，比 task 创建成功更接近真实连通。
            KeepaliveRegistry.get_instance().notify_connected_once(self.key)
            next_get_updates_buf = str(data.get("get_updates_buf") or "")
            if next_get_updates_buf and next_get_updates_buf != self._get_updates_buf:
                self._get_updates_buf = next_get_updates_buf
                try:
                    await self._persist_runtime_state()
                except Exception as e:
                    logger.warning(f"[WechatChannel] 持久化运行态失败: {e}")

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

        current_message_at_ms = now_ms()
        self._last_message_at_ms = current_message_at_ms
        KeepaliveRegistry.get_instance().notify_activity(self.key, current_message_at_ms)
        context_token: str = msg.get("context_token", "")
        user_id: str = msg.get("from_user_id", "wechat_user")

        # 缓存最近活跃用户的 context_token，供回复和主动发送复用
        self._cache_context_token(user_id=user_id, context_token=context_token)
        try:
            await self._persist_runtime_state()
        except Exception as e:
            logger.warning(f"[WechatChannel] 持久化用户上下文失败: {e}")

        # 下载媒体（图片/视频/文件/无转文字的语音），失败不阻断主流程
        assert self._http_session is not None
        wechat_media = None
        try:
            wechat_media = await download_message_media(
                self._http_session,
                msg.get("item_list") or [],
                user_id,
                cdn_base_url=self._credential.cdn_base_url,
            )
        except Exception as e:
            logger.warning(f"[WechatChannel] 媒体下载失败，忽略: {e}")

        if wechat_media:
            logger.info(f"[WechatChannel] 媒体已保存: {wechat_media.relative_path}")


        assert self._credential is not None

        platform_msg_id = msg.get("client_id") or msg.get("message_id") or ""
        message_id = f"wechat_{uuid.uuid4().hex[:16]}"
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
            cdn_base_url=self._credential.cdn_base_url,
            stream_id=platform_msg_id or message_id,
            typing_controller=typing_controller,
        )
        ctx.add_stream(wechat_stream)

        chat_msg = ChatClientMessage(
            message_id=message_id,
            prompt=content,
            metadata=Metadata(
                agent_user_id=user_id,
                channel_name="wechat",
            ),
            channel_context={
                "wechat_media": [wechat_media.model_dump()] if wechat_media else []
            },
        )
        logger.info(f"[WechatChannel] 分发消息: user_id={user_id}, len={len(content)}")

        # 打断当前 run（如有），以非阻塞 task 启动新 run，poll 循环可继续接收消息
        await dispatch_third_party_message(
            dispatcher=dispatcher,
            channel=self.key,
            source_message_id=platform_msg_id or message_id,
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

    async def create_proactive_streams(self, ctx, cleanup_key: str) -> bool:
        """用缓存的最后一次会话上下文创建主动推送 stream。"""
        latest_context = self._get_latest_context()
        if not self.is_connected or self._credential is None or self._http_session is None:
            logger.info("[WechatChannel] proactive stream skipped: channel not connected")
            return False
        if not latest_context.user_id or not latest_context.context_token:
            logger.info("[WechatChannel] proactive stream skipped: no cached user/context_token")
            return False

        stream_id = f"wechat-proactive-{id(self)}"
        wechat_stream = WechatStream(
            http_session=self._http_session,
            bot_token=self._credential.bot_token,
            to_user_id=latest_context.user_id,
            context_token=latest_context.context_token,
            base_url=self._credential.base_url,
            cdn_base_url=self._credential.cdn_base_url,
            stream_id=stream_id,
            is_proactive=True,
        )
        ctx.add_stream(wechat_stream)

        async def _cleanup() -> None:
            ctx.remove_stream(wechat_stream)

        ctx.register_run_cleanup(cleanup_key, _cleanup)
        logger.info("[WechatChannel] proactive stream registered for cron notification")
        return True

    def _build_runtime_state(self) -> WechatRuntimeState:
        return WechatRuntimeState(
            get_updates_buf=self._get_updates_buf,
            last_message_at_ms=self._last_message_at_ms,
            last_active_user_id=self._last_active_user_id or "",
            context_tokens_by_user=dict(self._context_tokens_by_user),
        )

    async def _persist_runtime_state(self) -> None:
        await save_runtime_state(self._build_runtime_state())

    def _cache_context_token(self, *, user_id: str, context_token: str) -> None:
        state = save_context_token(
            self._build_runtime_state(),
            user_id=user_id,
            context_token=context_token,
        )
        self._last_active_user_id = state.last_active_user_id or None
        self._context_tokens_by_user = dict(state.context_tokens_by_user)

    def _get_latest_context(self) -> WechatUserContext:
        state = self._build_runtime_state()
        return get_latest_context(state)
