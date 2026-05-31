"""Client context synchronization service."""
from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING

from agentlang.logger import get_logger
from app.core.client_context.parser_interface import ClientContextParserInterface
from app.core.client_context.payload import ClientContextPayload
from app.core.client_context.v1_parser import ClientContextV1Parser

if TYPE_CHECKING:
    from app.core.horizon.agent_horizon import AgentHorizon

logger = get_logger(__name__)


class ClientContextService:
    """Parse dynamic_config.client_context and stage it in Horizon."""

    PARSERS: Mapping[str, ClientContextParserInterface] = {
        ClientContextV1Parser.VERSION: ClientContextV1Parser(),
    }

    @classmethod
    async def sync_to_horizon(
        cls,
        dynamic_config: Mapping[str, object] | None,
        horizon: "AgentHorizon",
    ) -> None:
        if not dynamic_config:
            return

        client_context = dynamic_config.get("client_context")
        if client_context is None:
            return

        payload = cls.parse(client_context)
        if payload is None:
            logger.warning("[ClientContextService] ignored invalid client_context")
            return

        await horizon.set_client_context(payload.content)

    @classmethod
    def parse(cls, client_context: object) -> ClientContextPayload | None:
        if not isinstance(client_context, Mapping):
            return None

        version = client_context.get("version")
        if not isinstance(version, str):
            return None

        parser = cls.PARSERS.get(version)
        if parser is None:
            return None

        return parser.parse(client_context)
