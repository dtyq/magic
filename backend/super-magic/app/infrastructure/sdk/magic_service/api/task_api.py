"""Open task lifecycle and existing topic queue endpoints."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter

OPEN = "/api/v1/open-api/super-magic/task"
QUEUE = "/api/v1/super-agent/message-queue"


class TaskApi(MagicServiceAbstractApi):
    async def create_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"{OPEN}/create")

    async def status_async(self, auth: MagicServiceAuthConfig, task_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, query={"task_id": task_id}), "GET", f"{OPEN}/status")

    async def cancel_async(self, auth: MagicServiceAuthConfig, task_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "POST", f"{OPEN}/{task_id}/cancel")

    async def list_queue_async(self, auth: MagicServiceAuthConfig, topic_id: str, page: int, page_size: int) -> dict[str, Any]:
        body = {"topic_id": topic_id, "page": page, "page_size": page_size}
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"{QUEUE}/queries")

    async def delete_queue_async(self, auth: MagicServiceAuthConfig, queue_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "DELETE", f"{QUEUE}/{queue_id}")

    async def model_config_async(self, auth: MagicServiceAuthConfig, key: str) -> dict[str, Any]:
        path = f"/api/v1/contact/users/setting/super-magic/topic-model/{quote(key, safe='')}"
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", path)

    async def execution_modes_async(self, auth: MagicServiceAuthConfig) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", "/api/v1/super-agents/featured")

    async def mode_async(self, auth: MagicServiceAuthConfig, identifier: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", f"/api/v1/modes/{quote(identifier, safe='')}")

    async def custom_models_async(self, auth: MagicServiceAuthConfig) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "POST", "/api/v1/service-provider/models/queries")
