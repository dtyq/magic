"""
微信 typing 控制器。

职责很单一：
- start 时发一次 typing
- 之后每 5 秒发一次 keepalive typing
- stop 时发 cancel typing
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Optional

import aiohttp

from agentlang.logger import get_logger
from app.channel.wechat import api

logger = get_logger(__name__)

TYPING_KEEPALIVE_INTERVAL_SECONDS = 5
CONFIG_CACHE_TTL_MS = 24 * 60 * 60 * 1000
CONFIG_CACHE_INITIAL_RETRY_MS = 2_000
CONFIG_CACHE_MAX_RETRY_MS = 60 * 60 * 1000


@dataclass
class TypingTicketCacheEntry:
    typing_ticket: str
    ever_succeeded: bool
    next_fetch_at_ms: int
    retry_delay_ms: int


class WechatTypingConfigManager:
    def __init__(
        self,
        *,
        http_session: aiohttp.ClientSession,
        base_url: str,
        token: str,
    ) -> None:
        self._http_session = http_session
        self._base_url = base_url
        self._token = token
        self._cache: dict[str, TypingTicketCacheEntry] = {}

    async def get_typing_ticket(
        self,
        ilink_user_id: str,
        context_token: str | None = None,
    ) -> str:
        now_ms = int(time.time() * 1000)
        entry = self._cache.get(ilink_user_id)
        should_fetch = entry is None or now_ms >= entry.next_fetch_at_ms

        if should_fetch:
            fetch_ok = False
            try:
                resp = await api.get_config(
                    self._http_session,
                    base_url=self._base_url,
                    token=self._token,
                    ilink_user_id=ilink_user_id,
                    context_token=context_token,
                )
                if resp.get("ret", 0) == 0:
                    self._cache[ilink_user_id] = TypingTicketCacheEntry(
                        typing_ticket=str(resp.get("typing_ticket") or ""),
                        ever_succeeded=True,
                        next_fetch_at_ms=now_ms + CONFIG_CACHE_TTL_MS,
                        retry_delay_ms=CONFIG_CACHE_INITIAL_RETRY_MS,
                    )
                    fetch_ok = True
            except Exception as e:
                logger.warning(f"[WechatTyping] get_config 失败，暂不阻断主流程: {e}")

            if not fetch_ok:
                prev_delay_ms = entry.retry_delay_ms if entry else CONFIG_CACHE_INITIAL_RETRY_MS
                next_delay_ms = min(prev_delay_ms * 2, CONFIG_CACHE_MAX_RETRY_MS)
                self._cache[ilink_user_id] = TypingTicketCacheEntry(
                    typing_ticket=entry.typing_ticket if entry else "",
                    ever_succeeded=entry.ever_succeeded if entry else False,
                    next_fetch_at_ms=now_ms + (next_delay_ms if entry else CONFIG_CACHE_INITIAL_RETRY_MS),
                    retry_delay_ms=next_delay_ms if entry else CONFIG_CACHE_INITIAL_RETRY_MS,
                )

        return self._cache.get(ilink_user_id, TypingTicketCacheEntry("", False, 0, 0)).typing_ticket


class WechatTypingController:
    def __init__(
        self,
        *,
        http_session: aiohttp.ClientSession,
        base_url: str,
        token: str,
        ilink_user_id: str,
        typing_ticket: str,
    ) -> None:
        self._http_session = http_session
        self._base_url = base_url
        self._token = token
        self._ilink_user_id = ilink_user_id
        self._typing_ticket = typing_ticket
        self._task: Optional[asyncio.Task] = None
        self._started = False
        self._stopped = False

    async def start(self) -> None:
        if not self._typing_ticket or self._stopped or self._started:
            return
        self._started = True
        await self._send(api.TYPING_STATUS_TYPING)
        self._task = asyncio.create_task(self._keepalive_loop())

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        try:
            await self._send(api.TYPING_STATUS_CANCEL)
        except Exception as e:
            logger.warning(f"[WechatTyping] cancel typing 失败: {e}")

    async def _keepalive_loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(TYPING_KEEPALIVE_INTERVAL_SECONDS)
                await self._send(api.TYPING_STATUS_TYPING)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"[WechatTyping] keepalive 失败: {e}")

    async def _send(self, status: int) -> None:
        await api.send_typing(
            self._http_session,
            base_url=self._base_url,
            token=self._token,
            ilink_user_id=self._ilink_user_id,
            typing_ticket=self._typing_ticket,
            status=status,
        )
