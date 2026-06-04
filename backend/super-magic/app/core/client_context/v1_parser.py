"""Client context v1.0.0 parser."""
from __future__ import annotations

from collections.abc import Mapping

from app.core.client_context.parser_interface import ClientContextParserInterface
from app.core.client_context.payload import ClientContextPayload


class ClientContextV1Parser(ClientContextParserInterface):
    VERSION = "1.0.0"
    CONTENT_LIMIT = 5000

    @classmethod
    def normalize_content(cls, content: str) -> str:
        return (
            content
            .replace("\\r\\n", "\n")
            .replace("\\n", "\n")
            .replace("\\r", "\n")
        )

    def parse(self, client_context: object) -> ClientContextPayload | None:
        if not isinstance(client_context, Mapping):
            return None

        version = client_context.get("version")
        if version != self.VERSION:
            return None

        data = client_context.get("data")
        if not isinstance(data, Mapping):
            return None

        content = data.get("content")
        if not isinstance(content, str):
            return None

        normalized_content = self.normalize_content(content)

        return ClientContextPayload(
            version=self.VERSION,
            content=normalized_content[: self.CONTENT_LIMIT],
        )
