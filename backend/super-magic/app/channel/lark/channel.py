"""
LarkChannel — 单例，管理飞书 WebSocket 长连接和消息分发。

连接可由 ConnectLarkBot Tool 触发，也可在检测到已保存配置后于进程启动时自动发起。

线程模型：
  lark_oapi.ws.Client.start() 内部调用 loop.run_until_complete()，无法在已有事件循环中直接
  调用。解决方案：在独立 daemon 线程中运行，线程内新建 asyncio 事件循环，并重定向
  lark_oapi.ws.client 模块级 loop 变量。消息回调通过 asyncio.run_coroutine_threadsafe
  调度到主事件循环（fire-and-forget，不阻塞 ws 线程）。
"""
from __future__ import annotations

import asyncio
import json
import threading
import uuid
from typing import Optional, TYPE_CHECKING

from agentlang.logger import get_logger
from app.channel.base.channel import BaseChannel
from app.core.entity.message.client_message import ChatClientMessage, Metadata
from app.channel.base.keepalive import ChannelKeepalive
from app.channel.lark.stream import LarkStream
from app.channel.lark.streaming_driver import LarkStreamingDriver
from app.channel.config import IMChannelsConfig

if TYPE_CHECKING:
    import lark_oapi as lark

logger = get_logger(__name__)

# CardKit 2.0 初始流式卡片（streaming_mode=true，内容为空，等待 element.content 流入）
_STREAMING_THINKING_CARD = {
    "schema": "2.0",
    "config": {
        "streaming_mode": True,
        "locales": ["zh_cn", "en_us"],
        "summary": {
            "content": "Thinking...",
            "i18n_content": {"zh_cn": "思考中...", "en_us": "Thinking..."},
        },
    },
    "body": {
        "elements": [
            {
                "tag": "markdown",
                "content": "",
                "text_align": "left",
                "text_size": "normal_v2",
                "margin": "0px 0px 0px 0px",
                "element_id": "streaming_content",
            }
        ]
    },
}


class LarkChannel(BaseChannel):
    key = "lark"
    label = "飞书"

    _instance: Optional["LarkChannel"] = None

    def __init__(self) -> None:
        self._app_id: Optional[str] = None
        self._app_secret: Optional[str] = None
        self._sdk_client: Optional["lark.Client"] = None
        self._ws_thread: Optional[threading.Thread] = None
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None
        self._keepalive = ChannelKeepalive("Lark", is_active=lambda: self.is_connected)
        # 缓存最后一次活跃的 chat_id，供 cron 主动推送复用会话上下文
        self._last_chat_id: Optional[str] = None

    @classmethod
    def get_instance(cls) -> "LarkChannel":
        if cls._instance is None:
            cls._instance = LarkChannel()
        return cls._instance

    @property
    def is_connected(self) -> bool:
        return self._ws_thread is not None and self._ws_thread.is_alive()

    def summarize_config(self, config: IMChannelsConfig) -> str | None:
        credential = config.lark
        if credential is None:
            return None

        return f"App ID: {credential.app_id}"

    async def start_from_config(self, config: IMChannelsConfig) -> bool:
        credential = config.lark
        if credential is None or not credential.enabled:
            return False

        from app.channel.lark.state import load_runtime_state
        state = await load_runtime_state()
        if state.last_chat_id:
            self._last_chat_id = state.last_chat_id
            logger.info(f"[LarkChannel] 恢复运行态: last_chat_id={state.last_chat_id}")

        await self.connect(credential.app_id, credential.app_secret)
        return True

    async def disconnect(self) -> None:
        """停止保活并清理本地连接引用。"""
        self._keepalive.stop()
        if self._ws_thread is not None and self._ws_thread.is_alive():
            # SDK 线程是阻塞式 start()，当前只能停止保活，避免误报成已彻底断开。
            logger.warning("[LarkChannel] 当前无法主动停止已启动的 WebSocket 线程，仅停止保活")
            return

        self._ws_thread = None
        self._sdk_client = None
        self._main_loop = None
        self._app_id = None
        self._app_secret = None
        logger.info("[LarkChannel] 已清理连接引用")

    async def connect(self, app_id: str, app_secret: str) -> None:
        """建立飞书 WebSocket 长连接。

        当前 SDK 线程无法优雅停止，因此这里只做重复提交保护：
        - 相同凭据且线程存活：直接复用当前连接流程
        - 不同凭据且线程存活：拒绝再次启动，避免并发线程重复收消息
        """
        import lark_oapi as lark

        if self._ws_thread is not None and self._ws_thread.is_alive():
            if self._app_id == app_id and self._app_secret == app_secret:
                logger.info(f"[LarkChannel] 已有活跃连接流程，复用现有线程: app_id={app_id}")
                return
            raise RuntimeError("飞书渠道已有活跃连接线程，请重启进程后再切换凭据")

        self._main_loop = asyncio.get_event_loop()
        self._app_id = app_id
        self._app_secret = app_secret

        self._sdk_client = (
            lark.Client.builder()
            .app_id(app_id)
            .app_secret(app_secret)
            .build()
        )

        # 旧线程无法优雅停止（ws.Client.start 阻塞），设置 daemon=True 让其随进程退出
        self._ws_thread = threading.Thread(
            target=self._run_ws,
            daemon=True,
            name="lark-ws",
        )
        self._ws_thread.start()
        self._keepalive.start()
        logger.info(f"[LarkChannel] 连接中，app_id={app_id}")

    def _run_ws(self) -> None:
        """后台线程：创建自有事件循环并运行 lark_oapi.ws.Client。

        必须在调用 ws.Client.start() 前将 lark_oapi.ws.client.loop 重定向到本线程的事件循环，
        否则 ws.Client 会使用主线程的 loop（已在运行），导致 run_until_complete 报错。
        """
        import lark_oapi as lark
        import lark_oapi.ws.client as _ws_mod

        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        _ws_mod.loop = new_loop  # 重定向模块级 loop，使 ws.Client 使用本线程的事件循环

        event_handler = (
            lark.EventDispatcherHandler.builder("", "")
            .register_p2_im_message_receive_v1(self._on_message_sync)
            .build()
        )

        ws_client = lark.ws.Client(
            self._app_id,
            self._app_secret,
            event_handler=event_handler,
            auto_reconnect=True,
        )
        try:
            logger.info("[LarkChannel] WebSocket 线程启动")
            ws_client.start()  # 阻塞直到连接断开且不再自动重连
        except Exception as e:
            logger.error(f"[LarkChannel] WebSocket 线程异常退出: {e}")

    def _on_message_sync(self, data: object) -> None:
        """同步回调（由 ws.Client 线程调用）→ 调度到主事件循环处理。

        fire-and-forget：不阻塞 ws 线程，异常通过日志追踪。
        """
        assert self._main_loop is not None
        asyncio.run_coroutine_threadsafe(
            self._on_message(data),
            self._main_loop,
        )

    async def _on_message(self, data: object) -> None:
        """主事件循环中异步处理飞书消息。"""
        from app.service.agent_dispatcher import AgentDispatcher

        dispatcher = AgentDispatcher.get_instance()
        if not dispatcher.agent_context:
            logger.error("[LarkChannel] agent_context 未初始化，忽略消息")
            return

        # 提取事件数据
        event_data = getattr(data, "event", None)
        msg = getattr(event_data, "message", None) if event_data else None
        if not msg:
            return

        # 只处理文本消息
        if getattr(msg, "message_type", None) != "text":
            logger.debug(f"[LarkChannel] 忽略非文本消息类型: {getattr(msg, 'message_type', 'unknown')}")
            return

        try:
            content_obj = json.loads(getattr(msg, "content", "{}") or "{}")
            text = (content_obj.get("text") or "").strip()
        except Exception:
            text = ""

        if not text:
            return

        sender = getattr(event_data, "sender", None)
        sender_id_obj = getattr(sender, "sender_id", None) if sender else None
        user_id = getattr(sender_id_obj, "open_id", None) or "lark_user"
        message_id = getattr(msg, "message_id", None) or ""
        chat_id = getattr(msg, "chat_id", None) or ""

        # 缓存 chat_id，供 cron 主动推送复用，并持久化供重启后使用
        if chat_id:
            self._last_chat_id = chat_id
            try:
                from app.channel.lark.state import LarkRuntimeState, save_runtime_state
                await save_runtime_state(LarkRuntimeState(last_chat_id=chat_id))
            except Exception as e:
                logger.warning(f"[LarkChannel] 保存运行态失败: {e}")

        ctx = dispatcher.agent_context
        assert self._sdk_client is not None

        # Step 1: 创建 CardKit 流式卡片（initial streaming_mode=true）
        card_id = await self._create_streaming_card()
        if not card_id:
            logger.error("[LarkChannel] CardKit 卡片创建失败，跳过此消息")
            return

        # Step 2: 以回复（reply）或新消息（create）方式发送卡片气泡
        reply_target = message_id or chat_id
        reply_ok = await self._send_card_reply(reply_target, card_id, is_reply=bool(message_id))
        if not reply_ok:
            logger.error("[LarkChannel] 发送卡片消息失败")
            return

        logger.info(f"[LarkChannel] 卡片发送成功: card_id={card_id}")

        # Step 3: 注册流式驱动和事件流到 agent context
        driver = LarkStreamingDriver(self._sdk_client, card_id)
        stream = LarkStream(self._sdk_client, card_id, driver)
        ctx.add_stream(stream)
        ctx.add_streaming_sink(driver)

        task_id = f"lark_{uuid.uuid4().hex[:16]}"
        chat_msg = ChatClientMessage(
            message_id=task_id,
            prompt=text,
            metadata=Metadata(agent_user_id=user_id),
        )
        logger.info(f"[LarkChannel] 分发消息: user_id={user_id}, len={len(text)}")
        await dispatcher.submit_message(chat_msg)

        async def _cleanup() -> None:
            ctx.remove_stream(stream)
            ctx.remove_streaming_sink(driver)

        ctx.register_run_cleanup("lark_stream", _cleanup)

    async def _create_streaming_card(self) -> Optional[str]:
        """创建 CardKit 流式卡片，返回 card_id，失败返回 None。"""
        from lark_oapi.api.cardkit.v1.model import CreateCardRequest, CreateCardRequestBody

        try:
            assert self._sdk_client is not None
            req = (
                CreateCardRequest.builder()
                .request_body(
                    CreateCardRequestBody.builder()
                    .type("card_json")
                    .data(json.dumps(_STREAMING_THINKING_CARD))
                    .build()
                )
                .build()
            )
            resp = await self._sdk_client.cardkit.v1.card.acreate(req)
            if not resp.success():
                logger.error(f"[LarkChannel] card.acreate 失败: code={resp.code}, msg={resp.msg}")
                return None
            card_id = resp.data.card_id if resp.data else None
            if card_id:
                logger.info(f"[LarkChannel] CardKit 卡片创建成功: card_id={card_id}")
            else:
                logger.error("[LarkChannel] card.acreate 返回空 card_id")
            return card_id
        except Exception as e:
            logger.error(f"[LarkChannel] card.acreate 异常: {e}")
            return None

    async def _send_card_reply(self, target: str, card_id: str, *, is_reply: bool) -> bool:
        """发送引用 card_id 的卡片消息。

        is_reply=True  → 回复 message_id（thread reply）
        is_reply=False → 新消息发往 chat_id
        """
        content = json.dumps({"type": "card", "data": {"card_id": card_id}})
        try:
            assert self._sdk_client is not None
            if is_reply:
                from lark_oapi.api.im.v1.model import ReplyMessageRequest, ReplyMessageRequestBody

                req = (
                    ReplyMessageRequest.builder()
                    .message_id(target)
                    .request_body(
                        ReplyMessageRequestBody.builder()
                        .msg_type("interactive")
                        .content(content)
                        .build()
                    )
                    .build()
                )
                resp = await self._sdk_client.im.v1.message.areply(req)
            else:
                from lark_oapi.api.im.v1.model import CreateMessageRequest, CreateMessageRequestBody

                req = (
                    CreateMessageRequest.builder()
                    .receive_id_type("chat_id")
                    .request_body(
                        CreateMessageRequestBody.builder()
                        .receive_id(target)
                        .msg_type("interactive")
                        .content(content)
                        .build()
                    )
                    .build()
                )
                resp = await self._sdk_client.im.v1.message.acreate(req)

            if not resp.success():
                logger.error(f"[LarkChannel] 发送卡片失败: code={resp.code}, msg={resp.msg}")
                return False
            return True
        except Exception as e:
            logger.error(f"[LarkChannel] 发送卡片异常: {e}")
            return False

    async def create_proactive_streams(self, ctx, cleanup_key: str) -> bool:
        """用缓存的最后一次会话 chat_id 创建主动推送 stream/sink。"""
        from app.channel.lark.stream import LarkStream
        from app.channel.lark.streaming_driver import LarkStreamingDriver

        if not self.is_connected or self._last_chat_id is None or self._sdk_client is None:
            return False

        card_id = await self._create_streaming_card()
        if not card_id:
            return False

        send_ok = await self._send_card_reply(self._last_chat_id, card_id, is_reply=False)
        if not send_ok:
            return False

        driver = LarkStreamingDriver(self._sdk_client, card_id)
        stream = LarkStream(self._sdk_client, card_id, driver)
        ctx.add_stream(stream)
        ctx.add_streaming_sink(driver)

        async def _cleanup() -> None:
            ctx.remove_stream(stream)
            ctx.remove_streaming_sink(driver)

        ctx.register_run_cleanup(cleanup_key, _cleanup)
        logger.info(f"[LarkChannel] proactive stream registered for cron notification: card_id={card_id}")
        return True

    async def verify_permissions(self) -> Optional[str]:
        """验证飞书 AI Bot 所需权限是否已全部开通。

        检测步骤：
          1. 获取 tenant_access_token 验证 App ID/Secret 有效性
          2. 尝试创建 CardKit 测试卡片，捕获权限不足错误（HTTP 403）
        """
        import httpx
        from lark_oapi.api.cardkit.v1.model import CreateCardRequest, CreateCardRequestBody

        assert self._sdk_client is not None

        # 1. 验证凭据
        try:
            async with httpx.AsyncClient(timeout=10) as http_client:
                token_resp = await http_client.post(
                    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                    json={"app_id": self._app_id, "app_secret": self._app_secret},
                )
                token_data = token_resp.json()
                if token_data.get("code") != 0:
                    return (
                        f"飞书凭据无效（code={token_data.get('code')}）：{token_data.get('msg', '')}，"
                        f"请确认 App ID 和 App Secret 是否正确"
                    )
        except Exception as e:
            logger.warning(f"[LarkChannel] 凭据验证异常（忽略）: {e}")

        # 2. 测试 CardKit 权限（创建一张测试卡片）
        try:
            test_card = {
                "schema": "2.0",
                "body": {"elements": [{"tag": "markdown", "content": "perm_check"}]},
            }
            req = (
                CreateCardRequest.builder()
                .request_body(
                    CreateCardRequestBody.builder()
                    .type("card_json")
                    .data(json.dumps(test_card))
                    .build()
                )
                .build()
            )
            resp = await self._sdk_client.cardkit.v1.card.acreate(req)
            if not resp.success():
                return (
                    f"飞书应用缺少 CardKit 权限（code={resp.code}）：{resp.msg}\n"
                    f"请在飞书开放平台 → 应用权限 → 申请并开通以下权限后重新连接：\n"
                    f"  - cardkit:card（创建和更新流式卡片）\n"
                    f"  - im:message（发送消息）\n"
                    f"同时在「事件订阅」中开启长连接并订阅 im.message.receive_v1 事件"
                )
        except Exception as e:
            logger.warning(f"[LarkChannel] CardKit 权限检测异常（忽略）: {e}")

        return None
