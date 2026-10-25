"""钉钉转发记录中的发送人昵称解析。"""
from __future__ import annotations

import asyncio
import json
from collections.abc import Iterable
from time import monotonic
from urllib.parse import quote

import aiohttp

from agentlang.logger import get_logger
from app.channel.base.media import MediaDownloadError, read_response_bytes

logger = get_logger(__name__)


class DingTalkUserResolver:
    """通过官方通讯录接口解析可识别的 userId，并安全降级。"""

    _cache: dict[tuple[str, str], tuple[float, str | None]] = {}
    _cache_ttl = 300.0

    def __init__(self, client: object | None) -> None:
        self._client = client

    async def resolve_many(self, sender_ids: Iterable[str], session: aiohttp.ClientSession) -> dict[str, str]:
        ids = [sender_id for sender_id in dict.fromkeys(sender_ids) if sender_id]
        if not ids or self._client is None:
            return {}
        results = await asyncio.gather(*(self._resolve(sender_id, session) for sender_id in ids))
        return {sender_id: name for sender_id, name in zip(ids, results) if name}

    async def _resolve(self, sender_id: str, session: aiohttp.ClientSession) -> str | None:
        client_id = str(getattr(getattr(self._client, "credential", None), "client_id", ""))
        cache_key = (client_id, sender_id)
        cached = self._cache.get(cache_key)
        if cached and cached[0] > monotonic():
            return cached[1]

        # LWCP 是钉钉转发记录常见的内部标识。实测 contact user get 对它
        # 返回空的组织用户信息，因此不能把它当作普通通讯录 userId 重试。
        if sender_id.startswith("$:LWCP_v1:$"):
            return self._remember(cache_key, None)

        # 只有已具备普通通讯录 userId 形态的标识才调用官方接口。
        try:
            token = await asyncio.to_thread(self._client.get_access_token)
            if not token:
                return self._remember(cache_key, None)
            url = f"https://api.dingtalk.com/v1.0/contact/users/{quote(sender_id, safe='')}"
            headers = {"x-acs-dingtalk-access-token": token}
            async with session.get(url, headers=headers) as response:
                raw = await read_response_bytes(response, max_bytes=1024 * 1024)
            data = json.loads(raw)
            name = self._display_name(data)
            return self._remember(cache_key, name)
        except (MediaDownloadError, aiohttp.ClientError, OSError, TypeError, ValueError, json.JSONDecodeError) as error:
            logger.debug(f"[DingTalkUserResolver] 用户解析失败: error_type={type(error).__name__}")
            return self._remember(cache_key, None)

    @staticmethod
    def _display_name(data: object) -> str | None:
        if not isinstance(data, dict):
            return None
        nested = data.get("orgEmployeeModel")
        candidates = [data.get("nick"), data.get("name")]
        if isinstance(nested, dict):
            candidates.extend([nested.get("orgUserName"), nested.get("nick"), nested.get("name")])
        return next((value.strip() for value in candidates if isinstance(value, str) and value.strip()), None)

    @classmethod
    def _remember(cls, key: tuple[str, str], value: str | None) -> str | None:
        cls._cache[key] = (monotonic() + cls._cache_ttl, value)
        return value
