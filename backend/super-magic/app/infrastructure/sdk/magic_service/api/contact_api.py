"""Read-only contact search with the current chat user's authorization."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_api import MagicServiceAbstractApi
from ..kernel.magic_service_parameter import MagicServiceAuthConfig
from ..parameter.product_parameter import ProductParameter

_BASE = "/api/v1/open-api/sandbox/contact"


class ContactApi(MagicServiceAbstractApi):
    async def search_users_async(self, auth: MagicServiceAuthConfig, query: str, page_token: str = "") -> dict[str, Any]:
        return await self.request_by_parameter_async(
            ProductParameter(auth, query={"query": query, "page_token": page_token}),
            "GET",
            f"{_BASE}/users/search",
        )

    async def search_departments_async(self, auth: MagicServiceAuthConfig, query: str) -> dict[str, Any]:
        return await self.request_by_parameter_async(
            ProductParameter(auth, query={"query": query}),
            "GET",
            f"{_BASE}/departments/search",
        )
