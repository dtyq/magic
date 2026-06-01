"""Spreadsheet structured parsing driver."""

from __future__ import annotations

from ..constants import SPREADSHEET_EXTENSIONS
from ..office.spreadsheet_profiler import SpreadsheetProfiler
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .generic import GenericMarkItDownDriver


class SpreadsheetDocumentDriver(GenericMarkItDownDriver):
    file_type = "spreadsheet"
    unit_type = "sheet"
    supported_extensions = SPREADSHEET_EXTENSIONS

    async def inspect(self, path):
        profile = await super().inspect(path)
        spreadsheet_profile = await SpreadsheetProfiler.profile(path)
        sheets = spreadsheet_profile.get("sheets", [])
        profile.outline = VirtualOutlineBuilder.by_names("sheet", [sheet.get("name", "") for sheet in sheets])
        profile.total_units = len(sheets)
        profile.samples = sheets[:5]
        profile.metadata.update(spreadsheet_profile)
        profile.recommended_strategy = "profile sheets first; extract only target sheets or ranges for large tables"
        return profile
