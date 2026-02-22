"""
微信 ClawBot 扫码登录会话管理。

这里遵循官方 login-qr.ts 的核心行为：
- bot_type 默认值为 3
- 活跃登录会话有 TTL
- 最多自动刷新二维码 3 次
- confirmed 后返回 bot_token / ilink_bot_id / baseurl / ilink_user_id

super-magic 只额外承担两件事：
- 把二维码页面落到 workspace/.tmp 下
- 扫码完成后删除二维码页面文件
"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.wechat import api
from app.paths import PathManager
from app.utils.async_file_utils import async_mkdir, async_unlink, async_exists, async_write_text

logger = get_logger(__name__)

_QR_SUBDIR = "im-channels"
ACTIVE_LOGIN_TTL_MS = 5 * 60_000
DEFAULT_LOGIN_TIMEOUT_MS = 480_000
MAX_QR_REFRESH_COUNT = 3
QR_PAGE_RELOAD_INTERVAL_MS = 3_000
QR_CODE_SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
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


@dataclass
class WechatLoginResult:
    bot_token: str
    ilink_bot_id: str
    base_url: str
    ilink_user_id: str


@dataclass
class WechatLoginOutcome:
    success: bool
    message: str
    result: Optional[WechatLoginResult] = None
    finished_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))


@dataclass
class WechatLoginSession:
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    status: LoginStatus = LoginStatus.WAITING
    qr_file: Optional[Path] = None
    qrcode: str = ""
    qrcode_url: str = ""
    started_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    result: Optional[WechatLoginResult] = None
    _poll_task: Optional[asyncio.Task] = None
    _result_future: Optional["asyncio.Future[WechatLoginResult]"] = None

    def qr_relative_path(self) -> str:
        """返回二维码文件相对于 workspace 的路径，供 Markdown 链接使用。"""
        return f".tmp/{_QR_SUBDIR}/wechat-login-qrcode-{self.session_id}.html"

    def is_active(self) -> bool:
        return self.status in (LoginStatus.WAITING, LoginStatus.SCANNED)

    def is_fresh(self) -> bool:
        return int(time.time() * 1000) - self.started_at_ms < ACTIVE_LOGIN_TTL_MS


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


def _build_qr_html(qrcode_content: str) -> str:
    """构造本地二维码 HTML 页面，直接在浏览器端渲染二维码。"""
    escaped_content = qrcode_content.replace("\\", "\\\\").replace("'", "\\'")
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>连接 MagiClaw 到微信</title>
    <style>
      :root {{
        --primary: #07c160;
        --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
        --card-bg: #ffffff;
        --text-main: #111111;
        --text-muted: #666666;
      }}
      body {{
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-gradient);
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
      }}
      .card {{
        width: min(92vw, 400px);
        background: var(--card-bg);
        border-radius: 28px;
        padding: 48px 40px;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03);
        text-align: center;
        box-sizing: border-box;
      }}
      .brand-icon {{
        width: 52px;
        height: 52px;
        margin: 0 auto 20px;
        border-radius: 16px;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.04);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
      }}
      h2 {{
        margin: 0 0 10px;
        color: var(--text-main);
        font-size: 24px;
        font-weight: 600;
        letter-spacing: -0.3px;
      }}
      .subtitle {{
        margin: 0 0 36px;
        color: var(--text-muted);
        font-size: 15px;
        line-height: 1.5;
      }}
      .qr-wrapper {{
        background: #ffffff;
        padding: 16px;
        border-radius: 20px;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.04);
        display: inline-block;
        margin-bottom: 36px;
        transition: transform 0.3s ease;
      }}
      .qr-wrapper:hover {{
        transform: translateY(-2px);
      }}
      #qrcode {{
        display: flex;
        align-items: center;
        justify-content: center;
      }}
      #qrcode canvas,
      #qrcode img {{
        max-width: 100%;
        height: auto;
        display: block;
        border-radius: 4px;
      }}
      .hint {{
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: #f7f8fa;
        padding: 12px 20px;
        border-radius: 100px;
      }}
      .hint::before {{
        content: "";
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary);
        animation: pulse 2s infinite;
        flex-shrink: 0;
      }}
      @keyframes pulse {{
        0% {{ box-shadow: 0 0 0 0 rgba(7, 193, 96, 0.4); }}
        70% {{ box-shadow: 0 0 0 6px rgba(7, 193, 96, 0); }}
        100% {{ box-shadow: 0 0 0 0 rgba(7, 193, 96, 0); }}
      }}
    </style>
    <script src="{QR_CODE_SCRIPT_URL}"></script>
  </head>
  <body>
    <div class="card">
      <div class="brand-icon" aria-hidden="true">🦞</div>
      <h2>连接 MagiClaw 到微信</h2>
      <div class="subtitle">请使用微信扫一扫，将 MagiClaw 连接到微信</div>
      <div class="qr-wrapper">
        <div id="qrcode"></div>
      </div>
      <div>
        <div class="hint">请扫码并在微信中确认连接，页面会自动刷新</div>
      </div>
    </div>
    <noscript>当前页面需要启用 JavaScript 才能渲染二维码。</noscript>
    <script>
      const qrcodeContent = '{escaped_content}';
      const container = document.getElementById('qrcode');
      const reloadIntervalMs = {QR_PAGE_RELOAD_INTERVAL_MS};

      function showError(message) {{
        container.textContent = message;
      }}

      try {{
        if (typeof QRCode === 'undefined') {{
          throw new Error('QRCode library unavailable');
        }}
        new QRCode(container, {{
          text: qrcodeContent,
          width: 240,
          height: 240,
          colorDark: "#111111",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M,
        }});
      }} catch (error) {{
        showError('二维码渲染失败，请检查网络后重新打开页面。');
      }}

      window.setTimeout(() => {{
        window.location.reload();
      }}, reloadIntervalMs);
    </script>
  </body>
</html>
"""


async def _write_qr_page(session: WechatLoginSession) -> None:
    """将二维码 HTML 页面写到 workspace .tmp 目录，按需创建父目录。"""
    qr_dir = PathManager.get_tmp_dir() / _QR_SUBDIR
    await async_mkdir(qr_dir, parents=True, exist_ok=True)
    qr_path = qr_dir / f"wechat-login-qrcode-{session.session_id}.html"
    await async_write_text(qr_path, _build_qr_html(session.qrcode_url))
    session.qr_file = qr_path


async def _cleanup_qr(session: WechatLoginSession) -> None:
    """删除二维码文件（登录成功、失败、取消时调用）。"""
    if session.qr_file and await async_exists(session.qr_file):
        try:
            await async_unlink(session.qr_file)
        except Exception as e:
            logger.warning(f"[WechatLogin] 删除二维码文件失败: {e}")
        session.qr_file = None


async def _poll_loop(
    session: WechatLoginSession,
    timeout_ms: int = DEFAULT_LOGIN_TIMEOUT_MS,
) -> None:
    """后台轮询扫码状态，直到 confirmed / failed / timeout 为止。"""
    global _active_session
    assert session._result_future is not None
    on_confirmed = session._result_future
    deadline_ms = int(time.time() * 1000) + max(timeout_ms, 1000)
    qr_refresh_count = 1
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
                    _set_last_login_outcome(
                        WechatLoginOutcome(
                            success=True,
                            message=LOGIN_SUCCESS_MESSAGE,
                            result=result,
                        )
                    )
                    await _cleanup_qr(session)
                    logger.info(f"[WechatLogin] 登录成功, ilink_bot_id={result.ilink_bot_id}")
                    if not on_confirmed.done():
                        on_confirmed.set_result(result)
                    return

                elif status == "expired":
                    logger.info("[WechatLogin] 二维码已过期，刷新中…")
                    qr_refresh_count += 1
                    if qr_refresh_count > MAX_QR_REFRESH_COUNT:
                        logger.warning("[WechatLogin] 二维码多次过期，终止登录会话")
                        session.status = LoginStatus.FAILED
                        break
                    try:
                        qr_data = await api.get_bot_qrcode(http_session)
                        session.qrcode = qr_data["qrcode"]
                        session.qrcode_url = qr_data["qrcode_img_content"]
                        session.started_at_ms = int(time.time() * 1000)
                        await _write_qr_page(session)
                        session.status = LoginStatus.WAITING
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
        if session.is_active() and int(time.time() * 1000) >= deadline_ms:
            session.status = LoginStatus.FAILED
            _set_last_login_outcome(
                WechatLoginOutcome(
                    success=False,
                    message=LOGIN_TIMEOUT_MESSAGE,
                )
            )
        elif session.status == LoginStatus.FAILED and _last_login_outcome is None:
            _set_last_login_outcome(
                WechatLoginOutcome(
                    success=False,
                    message=LOGIN_FAILURE_MESSAGE,
                )
            )
        await _cleanup_qr(session)
        if not on_confirmed.done():
            on_confirmed.set_exception(RuntimeError(f"登录失败，状态: {session.status}"))
        if _active_session is session:
            _active_session = None


async def start_login_session(
    *,
    force_refresh: bool = False,
) -> tuple[WechatLoginSession, "asyncio.Future[WechatLoginResult]"]:
    """
    发起新的微信扫码登录会话。

    若已有活跃会话，先取消旧会话再发起新会话。
    返回 (session, future)：
      - session.qr_relative_path() 是供前端展示的相对链接
      - future 在扫码确认后完成，结果为 WechatLoginResult
    """
    global _active_session
    global _last_login_outcome

    if _active_session and _active_session.is_active():
        if not force_refresh and _active_session.is_fresh() and _active_session.qr_file:
            assert _active_session._result_future is not None
            return _active_session, _active_session._result_future
        await cancel_login_session()

    session = WechatLoginSession()
    _active_session = session
    _last_login_outcome = None

    async with aiohttp.ClientSession() as http_session:
        qr_data = await api.get_bot_qrcode(http_session)
        session.qrcode = qr_data["qrcode"]
        session.qrcode_url = qr_data["qrcode_img_content"]
        session.started_at_ms = int(time.time() * 1000)
    await _write_qr_page(session)

    loop = asyncio.get_event_loop()
    on_confirmed: asyncio.Future[WechatLoginResult] = loop.create_future()
    session._result_future = on_confirmed
    session._poll_task = asyncio.create_task(
        _poll_loop(session)
    )

    return session, on_confirmed


async def cancel_login_session() -> None:
    """取消当前活跃的登录会话并清理文件。"""
    global _active_session
    if _active_session is None:
        return
    session = _active_session
    _active_session = None
    if session._result_future and not session._result_future.done():
        session._result_future.cancel()
    if session._poll_task and not session._poll_task.done():
        session._poll_task.cancel()
        try:
            await session._poll_task
        except asyncio.CancelledError:
            pass
    await _cleanup_qr(session)
    logger.info("[WechatLogin] 登录会话已取消")


async def wait_for_login(timeout_seconds: int = 60) -> WechatLoginOutcome:
    """
    等待当前登录会话完成。

    - 成功：返回成功 outcome
    - 超时：取消当前会话并返回超时 outcome
    - 若近期已有完成结果，直接返回
    """
    active_session = get_active_session()
    if active_session is None:
        last_outcome = get_last_login_outcome()
        if last_outcome is not None:
            return last_outcome
        raise RuntimeError("当前没有进行中的微信登录，请先生成二维码。")

    if active_session._result_future is None:
        raise RuntimeError("微信登录会话状态异常，请重新生成二维码。")

    try:
        result = await asyncio.wait_for(
            asyncio.shield(active_session._result_future),
            timeout=max(timeout_seconds, 1),
        )
        outcome = WechatLoginOutcome(
            success=True,
            message=LOGIN_SUCCESS_MESSAGE,
            result=result,
        )
        _set_last_login_outcome(outcome)
        return outcome
    except asyncio.TimeoutError:
        await cancel_login_session()
        outcome = WechatLoginOutcome(
            success=False,
            message=(
                f"Tell the user that no QR confirmation was completed within {timeout_seconds} seconds, "
                "the login request has been cancelled, and they should send another message if they need "
                "a fresh QR flow."
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
