"""Per-request product API parameters bound to the current authenticated user."""

from __future__ import annotations

from typing import Any

from ..kernel.magic_service_parameter import MagicServiceAbstractParameter, MagicServiceAuthConfig


class ProductParameter(MagicServiceAbstractParameter):
    """A small transport parameter for the existing product endpoints."""

    def __init__(
        self,
        auth_config: MagicServiceAuthConfig,
        *,
        body: dict[str, Any] | None = None,
        query: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(auth_config=auth_config)
        self.body = body or {}
        self.query = query or {}

    def to_body(self) -> dict[str, Any]:
        return self.body

    def to_query_params(self) -> dict[str, Any]:
        return self.query
