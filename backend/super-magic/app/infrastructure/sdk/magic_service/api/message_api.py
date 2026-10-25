"""V2 topic message cursor endpoint."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter


class MessageApi(MagicServiceAbstractApi):
    async def list_topic_async(
        self, auth: MagicServiceAuthConfig, topic_id: str, *, after_id: str | None = None, limit: int = 20
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"limit": limit}
        if after_id is not None:
            body["after_id"] = after_id
        return await self.request_by_parameter_async(
            ProductParameter(auth, body=body), "POST", f"/api/v2/super-agent/topics/{topic_id}/messages"
        )
