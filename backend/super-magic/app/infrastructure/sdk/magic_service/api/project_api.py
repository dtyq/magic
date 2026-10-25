"""Existing Super Magic project HTTP endpoints."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter

BASE = "/api/v1/super-agent/projects"


class ProjectApi(MagicServiceAbstractApi):
    async def list_async(self, auth: MagicServiceAuthConfig, *, keyword: str = "", scope: str = "owned", workspace_id: str | None = None, page: int = 1, page_size: int = 20, order_by: str = "created_at", sort: str = "desc") -> dict[str, Any]:
        fields = {"project_name": keyword, "page": page, "page_size": page_size}
        if workspace_id is not None:
            fields["workspace_id"] = workspace_id
        if scope == "participated":
            fields.update(show_collaboration=1, show_hidden=0, include_special=0)
            return await self.request_by_parameter_async(ProductParameter(auth, body=fields), "POST", f"{BASE}/participated")
        fields.update(order_by=order_by, sort=sort)
        return await self.request_by_parameter_async(ProductParameter(auth, query=fields), "GET", f"{BASE}/queries")

    async def get_async(self, auth: MagicServiceAuthConfig, project_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "GET", f"{BASE}/{project_id}")

    async def create_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", BASE)

    async def update_async(self, auth: MagicServiceAuthConfig, project_id: str, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "PUT", f"{BASE}/{project_id}")

    async def move_async(self, auth: MagicServiceAuthConfig, body: dict[str, Any]) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, body=body), "POST", f"{BASE}/move")

    async def delete_async(self, auth: MagicServiceAuthConfig, project_id: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth), "DELETE", f"{BASE}/{project_id}")

    async def list_topics_async(self, auth: MagicServiceAuthConfig, project_id: str, *, page: int = 1, page_size: int = 20) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, query={"page": page, "page_size": page_size}), "GET", f"{BASE}/{project_id}/topics")

    async def search_topics_async(self, auth: MagicServiceAuthConfig, project_id: str, *, keyword: str = "", page: int = 1, page_size: int = 20) -> dict[str, Any]:
        return await self.request_by_parameter_async(ProductParameter(auth, query={"q": keyword, "page": page, "page_size": page_size}), "GET", f"{BASE}/{project_id}/sidebar-topics")
