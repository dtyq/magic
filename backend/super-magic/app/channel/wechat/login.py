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
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.wechat import api

logger = get_logger(__name__)

# session 在此窗口内视为"新鲜"可复用，与 wait_wechat_login 默认超时保持一致
LOGIN_SESSION_TTL_MS = 60_000
# poll loop 安全兜底，正常情况下 cancel_session 早于此时间触发
POLL_LOOP_SAFETY_TIMEOUT_MS = 60_000
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

        若已有活跃且新鲜的 session（且非强制刷新），直接返回该 session。
        否则取消旧 session，发起新的扫码流程。
        """
        # Phase 1: 持锁检查并提取旧 poll task
        async with self._lock:
            existing = self._active_session
            if existing and existing.is_active():
                if not force_refresh and existing.is_fresh():
                    return existing
                # 标记为 None，出锁后取消旧 poll task
                self._active_session = None
                old_poll_task = existing._poll_task
            else:
                old_poll_task = None

        # Phase 2: 出锁后取消旧 poll task（需要 await）
        if old_poll_task and not old_poll_task.done():
            old_poll_task.cancel()
            try:
                await old_poll_task
            except asyncio.CancelledError:
                pass

        # Phase 3: 创建新 session，拉取二维码
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
                    f"Tell the user that no QR confirmation or refresh was received within "
                    f"{timeout_seconds} seconds, the login request has been cancelled, and they "
                    "should send another message if they need a fresh QR flow."
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
