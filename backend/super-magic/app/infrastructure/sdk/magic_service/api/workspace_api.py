"""Existing Super Magic workspace HTTP endpoints."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter

BASE = "/api/v1/super-agent/workspaces"


class WorkspaceApi(MagicServiceAbstractApi):
    async def list_async(self, auth: MagicServiceAuthConfig, *, keyword: str = "", page: int = 1, page_size: int = 20) -> dict[str, Any]:
        # The UI DTO defaults auto_create to true; discovery must never write.
        query = {"workspace_name": keyword, "page": page, "page_size": page_size, "auto_create": "false"}
        return await self.request_by_parameter_async(ProductParameter(auth, query=query), "GET", f"{BASE}/queries")

    async def get_async(self, auth: MagicServiceAuthConfig, workspace_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", f"{BASE}/{workspace_id}")

    async def create_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", BASE)

    async def update_async(self, auth: MagicServiceAuthConfig, workspace_id: str, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "PUT", f"{BASE}/{workspace_id}")

    async def archive_async(self, auth: MagicServiceAuthConfig, workspace_id: str, archived: bool) -> dict[str, Any]:
        body = {"workspace_ids": [workspace_id], "is_archived": int(archived)}
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"{BASE}/set-archived")

    async def delete_async(self, auth: MagicServiceAuthConfig, workspace_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "DELETE", f"{BASE}/{workspace_id}")
