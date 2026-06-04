"""Client context parser contract."""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.client_context.payload import ClientContextPayload


class ClientContextParserInterface(ABC):
    @abstractmethod
    def parse(self, client_context: object) -> ClientContextPayload | None:
        """Parse a versioned client_context payload."""
