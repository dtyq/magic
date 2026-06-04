"""Format conversion service."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_mkdir, async_move_file

from ..constants import POWERPOINT_EXTENSIONS, SPREADSHEET_EXTENSIONS, WORD_EXTENSIONS
from ..pdf.pdf_page_renderer import PdfPageRenderer


class DocumentFormatConverter:
    async def convert(self, input_path: Path, output_dir: Path, target_format: str, ranges: Optional[str] = None) -> list[Path]:
        await async_mkdir(output_dir, parents=True, exist_ok=True)
        suffix = input_path.suffix.lower()
        target = target_format.lower().lstrip(".")

        if suffix == ".pdf" and target in {"png", "jpg", "jpeg"}:
            from ..pdf.pdf_metadata import PdfMetadata
            from ..structure.range_parser import RangeParser

            total = (await PdfMetadata.inspect(input_path))["page_count"]
            pages = RangeParser.parse_numeric(ranges, total) or list(range(1, total + 1))
            rendered = await PdfPageRenderer.render_pages(input_path, pages)
            output_paths: list[Path] = []
            for page_no, temp_path in rendered:
                out = output_dir / f"{input_path.stem}_page_{page_no:03d}.{target}"
                await async_move_file(temp_path, out)
                output_paths.append(out)
            return output_paths

        office_suffixes = WORD_EXTENSIONS | POWERPOINT_EXTENSIONS | SPREADSHEET_EXTENSIONS
        if suffix in office_suffixes and target in {"pdf", "docx", "pptx", "xlsx"}:
            from app.utils.file_parse.utils.libreoffice_util import LibreOfficeUtil

            converted = await LibreOfficeUtil.convert_document(input_path, target, output_dir.name)
            final_path = output_dir / converted.name
            if converted != final_path:
                await async_move_file(converted, final_path)
            return [final_path]

        raise ValueError(f"unsupported format conversion: {suffix} -> {target_format}")
