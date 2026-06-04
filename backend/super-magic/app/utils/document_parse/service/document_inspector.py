"""Document inspection service."""

from __future__ import annotations

from pathlib import Path

from ..drivers import get_document_driver_registry
from ..models import DocumentProfile


class DocumentInspector:
    async def inspect(self, path: Path) -> DocumentProfile:
        driver = get_document_driver_registry().get_driver(path)
        return await driver.inspect(path)
