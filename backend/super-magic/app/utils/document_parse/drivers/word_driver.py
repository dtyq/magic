"""Word structured parsing driver."""

from __future__ import annotations

from pathlib import Path

from ..constants import WORD_EXTENSIONS
from ..office.docx_structure_reader import DocxStructureReader
from ..structure.outline_builder import OutlineBuilder
from .generic import GenericMarkItDownDriver


class WordDocumentDriver(GenericMarkItDownDriver):
    file_type = "word"
    unit_type = "section"
    supported_extensions = WORD_EXTENSIONS

    async def inspect(self, path: Path):
        profile = await super().inspect(path)
        if path.suffix.lower() == ".docx":
            headings = DocxStructureReader.read_headings(path)
            if headings:
                profile.outline = OutlineBuilder.build_tree(headings)
                profile.total_units = len(headings)
                profile.metadata["native_headings"] = True
        profile.recommended_strategy = "extract by native heading sections when available"
        return profile
