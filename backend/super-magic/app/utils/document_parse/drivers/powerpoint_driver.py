"""PowerPoint structured parsing driver."""

from __future__ import annotations

from ..constants import POWERPOINT_EXTENSIONS
from ..office.pptx_structure_reader import PptxStructureReader
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .generic import GenericMarkItDownDriver


class PowerPointDocumentDriver(GenericMarkItDownDriver):
    file_type = "powerpoint"
    unit_type = "slide"
    supported_extensions = POWERPOINT_EXTENSIONS

    async def inspect(self, path):
        profile = await super().inspect(path)
        if path.suffix.lower() == ".pptx":
            titles = PptxStructureReader.read_slide_titles(path)
            if titles:
                profile.outline = VirtualOutlineBuilder.by_names("slide", titles)
                profile.total_units = len(titles)
                profile.samples = [{"slide": index + 1, "title": title} for index, title in enumerate(titles[:10])]
        profile.recommended_strategy = "treat each slide as a chunk; summarize slide by slide"
        return profile
