"""Asset storage helper placeholder."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_mkdir

from ..constants import ASSETS_DIRNAME


class AssetStore:
    """Create and expose the assets directory for extracted resources."""

    @staticmethod
    async def ensure(output_dir: Path) -> Path:
        assets_dir = output_dir / ASSETS_DIRNAME
        await async_mkdir(assets_dir, parents=True, exist_ok=True)
        return assets_dir
