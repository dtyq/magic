"""
微信 ClawBot 扫码登录会话管理。

遵循官方 login-qr.ts 核心行为：
- 活跃登录会话有 TTL（60 秒）
- 最多自动刷新二维码 3 次
- confirmed 后返回 bot_token / ilink_bot_id / baseurl / ilink_user_id

WechatLoginManager 是唯一状态所有者：
- 所有 session 生命周期操作都通过 manager
- tool 层只调用 manager 的稳定接口
- 路由层完全不感知微信登录内部细节
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Awaitable, Callable, Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.wechat import api

logger = get_logger(__name__)

# 对齐官方插件 ACTIVE_LOGIN_TTL_MS = 5 * 60_000
LOGIN_SESSION_TTL_MS = 5 * 60_000
POLL_LOOP_SAFETY_TIMEOUT_MS = 300_000
MAX_QR_REFRESH_COUNT = 3
LOGIN_SUCCESS_MESSAGE = (
    "Tell the user that WeChat is connected successfully and ask them to send 'hi' in the "
    "WeChat ClawBot chat to verify the connection."
)
LOGIN_FAILURE_MESSAGE = (
    "Tell the user that the WeChat login failed and they should generate a new QR flow to try again."
)
LOGIN_TIMEOUT_MESSAGE = (
    "Tell the user that the login wait timed out and they should generate a new QR flow to try again."
)
LOGIN_CANCELLED_MESSAGE = (
    "Tell the user that the WeChat login was cancelled."
)


class LoginStatus(StrEnum):
    WAITING = "waiting"      # 等待扫码
    SCANNED = "scanned"      # 已扫码，待确认
    CONFIRMED = "confirmed"  # 已确认，登录成功
    EXPIRED = "expired"      # 二维码过期（会自动刷新并重置为 WAITING）
    FAILED = "failed"        # 不可恢复的错误


class LoginOutcomeKind(StrEnum):
    QR_RENDER = "qr_render"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


@dataclass
class WechatLoginResult:
    bot_token: str
    ilink_bot_id: str
    base_url: str
    ilink_user_id: str


@dataclass
class WechatLoginOutcome:
    kind: LoginOutcomeKind
    message: str
    session_id: str = ""
    result: Optional[WechatLoginResult] = None
    qrcode_content: str = ""
    finished_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))

    @property
    def success(self) -> bool:
        return self.kind == LoginOutcomeKind.SUCCESS

    @property
    def requires_qr_render(self) -> bool:
        return self.kind == LoginOutcomeKind.QR_RENDER

    def qrcode_js_string_literal(self) -> str:
        """返回可直接塞进 Skill 模板的 JS 字符串字面量。"""
        return json.dumps(self.qrcode_content, ensure_ascii=False)


@dataclass
class WechatLoginSession:
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    status: LoginStatus = LoginStatus.WAITING
    qrcode: str = ""
    qrcode_content: str = ""
    started_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    result: Optional[WechatLoginResult] = None
    _poll_task: Optional[asyncio.Task] = None
    _event_queue: "asyncio.Queue[WechatLoginOutcome]" = field(default_factory=asyncio.Queue)
    # 登录成功后的自动激活回调，由 connect_wechat_bot 在发起会话时注册
    _on_success: Optional[Callable[["WechatLoginResult"], Awaitable[None]]] = field(
        default=None, repr=False
    )

    def is_active(self) -> bool:
        return self.status in (LoginStatus.WAITING, LoginStatus.SCANNED)

    def is_fresh(self) -> bool:
        return int(time.time() * 1000) - self.started_at_ms < LOGIN_SESSION_TTL_MS

    def qrcode_js_string_literal(self) -> str:
        return json.dumps(self.qrcode_content, ensure_ascii=False)


class WechatLoginManager:
    """微信登录唯一状态所有者。

    对外接口：
    - start_or_resume_session(force_refresh)
    - wait_for_outcome(timeout_seconds)
    - cancel_session(session_id)
    - get_active_session()
    - consume_last_outcome()
    """

    _instance: Optional["WechatLoginManager"] = None

    def __init__(self) -> None:
        self._active_session: Optional[WechatLoginSession] = None
        self._last_outcome: Optional[WechatLoginOutcome] = None
        self._lock: asyncio.Lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> "WechatLoginManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_active_session(self) -> Optional[WechatLoginSession]:
        """返回当前活跃 session（只读）。"""
        return self._active_session

    async def start_or_resume_session(
        self,
        *,
        force_refresh: bool = False,
    ) -> WechatLoginSession:
        """发起或复用当前登录 session。

        - SCANNED 状态（已扫码待确认）：直接复用，避免打断扫码流程
        - WAITING 状态：总是重新拉取 QR 码并原地更新 session，保持 poll loop 继续
        - 无 session 或 force_refresh：取消旧 session，创建新 session
        """
        # Phase 1: 持锁检查
        async with self._lock:
            existing = self._active_session
            if existing and existing.is_active() and not force_refresh:
                if existing.status == LoginStatus.SCANNED:
                    # 用户已扫码正在确认，不打断
                    return existing
                if existing.is_fresh():
                    # WAITING 状态：原地刷新 QR，出锁后执行 API 调用
                    session_to_refresh = existing
                else:
                    session_to_refresh = None
                    self._active_session = None
                    old_poll_task = existing._poll_task
            elif existing and existing.is_active():
                session_to_refresh = None
                self._active_session = None
                old_poll_task = existing._poll_task
            else:
                session_to_refresh = None
                old_poll_task = None

        # Phase 2: 原地刷新 QR（poll loop 保持运行，下次 poll 会用新 qrcode）
        if session_to_refresh is not None:
            async with aiohttp.ClientSession() as http:
                qr_data = await api.get_bot_qrcode(http)
                session_to_refresh.qrcode = qr_data["qrcode"]
                session_to_refresh.qrcode_content = qr_data["qrcode_img_content"]
                session_to_refresh.started_at_ms = int(time.time() * 1000)
                session_to_refresh.status = LoginStatus.WAITING
            logger.info(f"[WechatLogin] QR refreshed in-place: {session_to_refresh.session_id}")
            return session_to_refresh

        # Phase 3: 出锁后取消旧 poll task（需要 await）
        if old_poll_task and not old_poll_task.done():
            old_poll_task.cancel()
            try:
                await old_poll_task
            except asyncio.CancelledError:
                pass

        # Phase 4: 创建新 session，拉取二维码
        session = WechatLoginSession()
        async with aiohttp.ClientSession() as http:
            qr_data = await api.get_bot_qrcode(http)
            session.qrcode = qr_data["qrcode"]
            session.qrcode_content = qr_data["qrcode_img_content"]
            session.started_at_ms = int(time.time() * 1000)

        async with self._lock:
            self._active_session = session
            self._last_outcome = None

        session._poll_task = asyncio.create_task(
            self._poll_loop(session, POLL_LOOP_SAFETY_TIMEOUT_MS)
        )
        logger.info(f"[WechatLogin] new session started: {session.session_id}")
        return session

    async def wait_for_outcome(self, *, timeout_seconds: int) -> WechatLoginOutcome:
        """等待当前 session outcome，或直接消费上次缓存结果（一次性）。"""
        async with self._lock:
            session = self._active_session
            last = self._last_outcome

        if session is None:
            # 消费上次结果（一次性）
            if last is not None:
                async with self._lock:
                    self._last_outcome = None
                return last
            raise RuntimeError(
                "No active WeChat login session exists. Start a fresh QR flow first."
            )

        try:
            return await asyncio.wait_for(
                session._event_queue.get(),
                timeout=max(timeout_seconds, 1),
            )
        except asyncio.TimeoutError:
            await self.cancel_session(session_id=session.session_id)
            timeout_outcome = WechatLoginOutcome(
                session_id=session.session_id,
                kind=LoginOutcomeKind.TIMEOUT,
                message=(
                    f"The WeChat QR login timed out after {timeout_seconds} seconds — the user did not scan. "
                    "Tell the user that the QR code has expired and the session is cancelled. "
                    "Do NOT call wait_wechat_login again. Stop here and wait for the user to explicitly "
                    "send a new message requesting another QR code."
                ),
            )
            async with self._lock:
                self._last_outcome = timeout_outcome
            return timeout_outcome
        except asyncio.CancelledError:
            raise

    async def cancel_session(self, *, session_id: Optional[str] = None) -> None:
        """取消指定 session（默认取消当前活跃 session）。

        持锁只做同步状态修改，出锁再做 async 工作，避免 release/acquire 手动操作。
        """
        # Phase 1: 持锁，只做同步状态修改
        async with self._lock:
            session = self._active_session
            if session is None:
                return
            if session_id is not None and session.session_id != session_id:
                logger.debug(
                    f"[WechatLogin] cancel_session: mismatch "
                    f"(target={session_id}, current={session.session_id}), skip"
                )
                return
            self._active_session = None
            poll_task = session._poll_task

        # Phase 2: 出锁，做 async 工作
        if poll_task and not poll_task.done():
            poll_task.cancel()
            try:
                await poll_task
            except asyncio.CancelledError:
                pass

        cancelled_outcome = WechatLoginOutcome(
            session_id=session.session_id,
            kind=LoginOutcomeKind.CANCELLED,
            message=LOGIN_CANCELLED_MESSAGE,
        )
        # 这里无需加锁：已无其他协程能拿到同一 session 引用
        self._last_outcome = cancelled_outcome
        session._event_queue.put_nowait(cancelled_outcome)
        logger.info(f"[WechatLogin] session {session.session_id} cancelled")

    def consume_last_outcome(self) -> Optional[WechatLoginOutcome]:
        """消费上次 outcome（一次性，消费后清空）。"""
        outcome = self._last_outcome
        self._last_outcome = None
        return outcome

    async def _poll_loop(
        self,
        session: WechatLoginSession,
        timeout_ms: int,
    ) -> None:
        """后台轮询扫码状态，直到 confirmed / failed / timeout / cancelled 为止。"""
        deadline_ms = int(time.time() * 1000) + max(timeout_ms, 1000)
        qr_refresh_count = 1
        terminal_event_emitted = False

        try:
            async with aiohttp.ClientSession() as http:
                while session.is_active() and int(time.time() * 1000) < deadline_ms:
                    try:
                        data = await api.get_qrcode_status(http, qrcode=session.qrcode)
                    except asyncio.CancelledError:
                        raise
                    except Exception as e:
                        logger.error(f"[WechatLogin] get_qrcode_status error: {e}")
                        await asyncio.sleep(2)
                        continue

                    status = data.get("status", "")
                    logger.debug(f"[WechatLogin] scan status: {status}")

                    if status == "wait":
                        session.status = LoginStatus.WAITING

                    elif status == "scaned":
                        session.status = LoginStatus.SCANNED
                        logger.info("[WechatLogin] scanned, waiting for confirmation")

                    elif status == "confirmed":
                        session.status = LoginStatus.CONFIRMED
                        result = WechatLoginResult(
                            bot_token=data.get("bot_token", ""),
                            ilink_bot_id=data.get("ilink_bot_id", ""),
                            base_url=data.get("baseurl", "https://ilinkai.weixin.qq.com"),
                            ilink_user_id=data.get("ilink_user_id", ""),
                        )
                        session.result = result
                        outcome = WechatLoginOutcome(
                            session_id=session.session_id,
                            kind=LoginOutcomeKind.SUCCESS,
                            message=LOGIN_SUCCESS_MESSAGE,
                            result=result,
                        )
                        async with self._lock:
                            self._last_outcome = outcome
                            if self._active_session is session:
                                self._active_session = None
                        session._event_queue.put_nowait(outcome)
                        terminal_event_emitted = True
                        logger.info(f"[WechatLogin] login success, ilink_bot_id={result.ilink_bot_id}")
                        # 触发自动激活回调（由 connect_wechat_bot 注册），不阻塞轮询主流程
                        if session._on_success is not None:
                            asyncio.create_task(
                                _run_on_success(session._on_success, result),
                                name=f"wechat-on-success-{session.session_id}",
                            )
                        return

                    elif status == "expired":
                        logger.info("[WechatLogin] QR expired, refreshing...")
                        session.status = LoginStatus.EXPIRED
                        qr_refresh_count += 1
                        if qr_refresh_count > MAX_QR_REFRESH_COUNT:
                            logger.warning("[WechatLogin] too many QR expirations, aborting")
                            session.status = LoginStatus.FAILED
                            break
                        try:
                            qr_data = await api.get_bot_qrcode(http)
                            session.qrcode = qr_data["qrcode"]
                            session.qrcode_content = qr_data["qrcode_img_content"]
                            session.started_at_ms = int(time.time() * 1000)
                            session.status = LoginStatus.WAITING
                            session._event_queue.put_nowait(
                                WechatLoginOutcome(
                                    session_id=session.session_id,
                                    kind=LoginOutcomeKind.QR_RENDER,
                                    message="",
                                    qrcode_content=session.qrcode_content,
                                )
                            )
                            logger.info("[WechatLogin] QR refreshed")
                        except Exception as e:
                            logger.error(f"[WechatLogin] QR refresh failed: {e}")
                            session.status = LoginStatus.FAILED
                            break

                    await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info(f"[WechatLogin] poll task {session.session_id} cancelled")
            raise
        except Exception as e:
            logger.error(f"[WechatLogin] poll error: {e}")
            session.status = LoginStatus.FAILED
        finally:
            if not terminal_event_emitted:
                if session.is_active() and int(time.time() * 1000) >= deadline_ms:
                    session.status = LoginStatus.FAILED
                    final_outcome = WechatLoginOutcome(
                        session_id=session.session_id,
                        kind=LoginOutcomeKind.TIMEOUT,
                        message=LOGIN_TIMEOUT_MESSAGE,
                    )
                elif session.status == LoginStatus.FAILED:
                    final_outcome = WechatLoginOutcome(
                        session_id=session.session_id,
                        kind=LoginOutcomeKind.FAILURE,
                        message=LOGIN_FAILURE_MESSAGE,
                    )
                else:
                    # 被 cancel_session 取消，_active_session 已由 cancel_session 清空
                    final_outcome = None

                if final_outcome is not None:
                    async with self._lock:
                        self._last_outcome = final_outcome
                        if self._active_session is session:
                            self._active_session = None
                    session._event_queue.put_nowait(final_outcome)


async def _run_on_success(
    callback: Callable[["WechatLoginResult"], Awaitable[None]],
    result: "WechatLoginResult",
) -> None:
    """包装 _on_success 回调执行，捕获异常避免影响轮询主流程。"""
    try:
        await callback(result)
    except Exception as e:
        logger.error(f"[WechatLogin] _on_success callback failed: {e}")
