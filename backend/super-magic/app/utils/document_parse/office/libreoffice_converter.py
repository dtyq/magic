"""LibreOffice conversion adapter."""

from __future__ import annotations

from pathlib import Path


class LibreOfficeConverter:
    @staticmethod
    async def convert(path: Path, target_format: str, output_dir: Path | None = None) -> Path:
        from app.utils.file_parse.utils.libreoffice_util import LibreOfficeUtil

        return await LibreOfficeUtil.convert_document(path, target_format, output_dir.name if output_dir else "converted")
