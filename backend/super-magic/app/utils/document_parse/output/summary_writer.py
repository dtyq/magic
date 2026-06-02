"""Write document summaries."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_write_text
from ..constants import SUMMARY_FILENAME


class SummaryWriter:
    @staticmethod
    async def write(output_dir: Path, summary: str) -> Path:
        path = output_dir / SUMMARY_FILENAME
        await async_write_text(path, summary.rstrip() + "\n")
        return path
