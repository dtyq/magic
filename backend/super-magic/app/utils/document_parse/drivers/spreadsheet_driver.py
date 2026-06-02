"""Spreadsheet structured parsing driver."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_exists, async_unlink
from ..constants import SPREADSHEET_EXTENSIONS
from ..office.spreadsheet_profiler import SpreadsheetProfiler
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .generic import GenericMarkItDownDriver


class SpreadsheetDocumentDriver(GenericMarkItDownDriver):
    file_type = "spreadsheet"
    unit_type = "sheet"
    supported_extensions = SPREADSHEET_EXTENSIONS

    async def inspect(self, path: Path):
        profile = await super().inspect(path)
        profile_path = path
        converted_path = None
        try:
            if path.suffix.lower() not in {".xls", ".xlsx", ".xlsm", ".csv", ".tsv"}:
                from app.utils.file_parse.utils.libreoffice_util import LibreOfficeUtil

                converted_path = await LibreOfficeUtil.convert_document(path, "xlsx", "inspect")
                profile_path = converted_path

            spreadsheet_profile = await SpreadsheetProfiler.profile(profile_path)
        except Exception as exc:
            spreadsheet_profile = {"error": f"spreadsheet profile failed: {exc}", "sheets": [], "sheet_count": 0}
        finally:
            if converted_path and await async_exists(converted_path):
                await async_unlink(converted_path)

        sheets = spreadsheet_profile.get("sheets", [])
        profile.outline = VirtualOutlineBuilder.by_names("sheet", [sheet.get("name", "") for sheet in sheets])
        profile.total_units = len(sheets)
        profile.samples = sheets[:5]
        profile.metadata.update(spreadsheet_profile)
        profile.recommended_strategy = "profile sheets first; extract only target sheets or ranges for large tables"
        return profile
