"""Client context parsed payload."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ClientContextPayload:
    version: str
    content: str
