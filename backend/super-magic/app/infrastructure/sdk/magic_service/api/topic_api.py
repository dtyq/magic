"""Existing Super Magic topic HTTP endpoints."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter

BASE = "/api/v1/super-agent/topics"


class TopicApi(MagicServiceAbstractApi):
    async def get_async(self, auth: MagicServiceAuthConfig, topic_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", f"{BASE}/{topic_id}")

    async def create_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", BASE)

    async def update_async(self, auth: MagicServiceAuthConfig, topic_id: str, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "PUT", f"{BASE}/{topic_id}")

    async def archive_async(self, auth: MagicServiceAuthConfig, topic_id: str, archived: bool) -> dict[str, Any]:
        suffix = "archive" if archived else "unarchive"
        return await self.request_by_parameter_async(ProductParameter(auth), "POST", f"{BASE}/{topic_id}/{suffix}")

    async def delete_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"{BASE}/delete")
