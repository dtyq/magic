"""
微信 ClawBot 扫码登录会话管理。

这里遵循官方 login-qr.ts 的核心行为：
- bot_type 默认值为 3
- 活跃登录会话有 TTL
- 最多自动刷新二维码 3 次
- confirmed 后返回 bot_token / ilink_bot_id / baseurl / ilink_user_id

super-magic 只额外承担两件事：
- 在内存中保留当前二维码内容，供 Skill 模板直接渲染
- 当二维码刷新时，向 Tool 发出显式事件，驱动 Agent 重发新的 HTML
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

ACTIVE_LOGIN_TTL_MS = 5 * 60_000
DEFAULT_LOGIN_TIMEOUT_MS = 480_000
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
        return int(time.time() * 1000) - self.started_at_ms < ACTIVE_LOGIN_TTL_MS

    def qrcode_js_string_literal(self) -> str:
        """返回可直接塞进 Skill 模板的 JS 字符串字面量。"""
        return json.dumps(self.qrcode_content, ensure_ascii=False)


# 全局活跃登录会话（同时只允许一个）
_active_session: Optional[WechatLoginSession] = None
_last_login_outcome: Optional[WechatLoginOutcome] = None


def get_active_session() -> Optional[WechatLoginSession]:
    return _active_session


def get_last_login_outcome() -> Optional[WechatLoginOutcome]:
    return _last_login_outcome


def _set_last_login_outcome(outcome: WechatLoginOutcome) -> None:
    global _last_login_outcome
    _last_login_outcome = outcome


def _emit_event(session: WechatLoginSession, outcome: WechatLoginOutcome) -> None:
    session._event_queue.put_nowait(outcome)


def _build_qr_render_outcome(session: WechatLoginSession) -> WechatLoginOutcome:
    return WechatLoginOutcome(
        kind=LoginOutcomeKind.QR_RENDER,
        message="",
        qrcode_content=session.qrcode_content,
    )


async def _poll_loop(
    session: WechatLoginSession,
    timeout_ms: int = DEFAULT_LOGIN_TIMEOUT_MS,
) -> None:
    """后台轮询扫码状态，直到 confirmed / failed / timeout 为止。"""
    global _active_session
    deadline_ms = int(time.time() * 1000) + max(timeout_ms, 1000)
    qr_refresh_count = 1
    terminal_event_emitted = False
    try:
        async with aiohttp.ClientSession() as http_session:
            while session.is_active() and int(time.time() * 1000) < deadline_ms:
                try:
                    data = await api.get_qrcode_status(
                        http_session,
                        qrcode=session.qrcode,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error(f"[WechatLogin] get_qrcode_status 异常: {e}")
                    await asyncio.sleep(2)
                    continue

                status = data.get("status", "")
                logger.debug(f"[WechatLogin] 扫码状态: {status}")

                if status == "wait":
                    session.status = LoginStatus.WAITING

                elif status == "scaned":
                    session.status = LoginStatus.SCANNED
                    logger.info("[WechatLogin] 已扫码，等待用户确认")

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
                        kind=LoginOutcomeKind.SUCCESS,
                        message=LOGIN_SUCCESS_MESSAGE,
                        result=result,
                    )
                    _set_last_login_outcome(outcome)
                    _emit_event(session, outcome)
                    terminal_event_emitted = True
                    logger.info(f"[WechatLogin] 登录成功, ilink_bot_id={result.ilink_bot_id}")
                    return

                elif status == "expired":
                    logger.info("[WechatLogin] 二维码已过期，刷新中…")
                    session.status = LoginStatus.EXPIRED
                    qr_refresh_count += 1
                    if qr_refresh_count > MAX_QR_REFRESH_COUNT:
                        logger.warning("[WechatLogin] 二维码多次过期，终止登录会话")
                        session.status = LoginStatus.FAILED
                        break
                    try:
                        qr_data = await api.get_bot_qrcode(http_session)
                        session.qrcode = qr_data["qrcode"]
                        session.qrcode_content = qr_data["qrcode_img_content"]
                        session.started_at_ms = int(time.time() * 1000)
                        session.status = LoginStatus.WAITING
                        _emit_event(session, _build_qr_render_outcome(session))
                        logger.info("[WechatLogin] 二维码已刷新")
                    except Exception as e:
                        logger.error(f"[WechatLogin] 刷新二维码失败: {e}")
                        session.status = LoginStatus.FAILED
                        break

                await asyncio.sleep(1)

    except asyncio.CancelledError:
        logger.info("[WechatLogin] 轮询任务已取消")
        raise
    except Exception as e:
        logger.error(f"[WechatLogin] 轮询异常: {e}")
        session.status = LoginStatus.FAILED
    finally:
        final_outcome: WechatLoginOutcome | None = None
        if not terminal_event_emitted and session.is_active() and int(time.time() * 1000) >= deadline_ms:
            session.status = LoginStatus.FAILED
            final_outcome = WechatLoginOutcome(
                kind=LoginOutcomeKind.TIMEOUT,
                message=LOGIN_TIMEOUT_MESSAGE,
            )
        elif not terminal_event_emitted and session.status == LoginStatus.FAILED:
            final_outcome = WechatLoginOutcome(
                kind=LoginOutcomeKind.FAILURE,
                message=LOGIN_FAILURE_MESSAGE,
            )
        if final_outcome is not None:
            _set_last_login_outcome(final_outcome)
            _emit_event(session, final_outcome)
        if _active_session is session:
            _active_session = None


async def start_login_session(
    *,
    force_refresh: bool = False,
) -> WechatLoginSession:
    """
    发起新的微信扫码登录会话。

    若已有活跃会话，先取消旧会话再发起新会话。
    返回会话本身，二维码内容由 Tool 配合 Skill 模板直接渲染。
    """
    global _active_session
    global _last_login_outcome

    if _active_session and _active_session.is_active():
        if not force_refresh and _active_session.is_fresh():
            return _active_session
        await cancel_login_session()

    session = WechatLoginSession()
    _active_session = session
    _last_login_outcome = None

    async with aiohttp.ClientSession() as http_session:
        qr_data = await api.get_bot_qrcode(http_session)
        session.qrcode = qr_data["qrcode"]
        session.qrcode_content = qr_data["qrcode_img_content"]
        session.started_at_ms = int(time.time() * 1000)
    session._poll_task = asyncio.create_task(_poll_loop(session))

    return session


async def cancel_login_session() -> None:
    """取消当前活跃的登录会话。"""
    global _active_session
    if _active_session is None:
        return
    session = _active_session
    _active_session = None
    if session._poll_task and not session._poll_task.done():
        session._poll_task.cancel()
        try:
            await session._poll_task
        except asyncio.CancelledError:
            pass
    logger.info("[WechatLogin] 登录会话已取消")


async def wait_for_login(timeout_seconds: int = 60) -> WechatLoginOutcome:
    """
    等待当前登录会话完成。

    - 成功：返回成功 outcome
    - 刷新：返回新的二维码渲染 outcome
    - 超时：取消当前会话并返回超时 outcome
    - 若近期已有完成结果，直接返回
    """
    active_session = get_active_session()
    if active_session is None:
        last_outcome = get_last_login_outcome()
        if last_outcome is not None:
            return last_outcome
        raise RuntimeError("No active WeChat login session exists. Start a fresh QR flow first.")

    try:
        return await asyncio.wait_for(
            active_session._event_queue.get(),
            timeout=max(timeout_seconds, 1),
        )
    except asyncio.TimeoutError:
        await cancel_login_session()
        outcome = WechatLoginOutcome(
            kind=LoginOutcomeKind.TIMEOUT,
            message=(
                f"Tell the user that no QR confirmation or refresh was received within {timeout_seconds} "
                "seconds, the login request has been cancelled, and they should send another message if "
                "they need a fresh QR flow."
            ),
        )
        _set_last_login_outcome(outcome)
        return outcome
    except asyncio.CancelledError:
        raise
    except Exception:
        last_outcome = get_last_login_outcome()
        if last_outcome is not None:
            return last_outcome
        raise
