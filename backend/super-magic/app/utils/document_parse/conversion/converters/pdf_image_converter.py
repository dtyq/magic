"""PDF page rendering conversion."""

from __future__ import annotations

from app.utils.async_file_utils import async_move_file

from ...constants import PDF_EXTENSIONS
from ...pdf.pdf_metadata import PdfMetadata
from ...pdf.pdf_page_renderer import PdfPageRenderer
from ...structure.range_parser import RangeParser
from ..models import ConversionCapability, ConversionRequest, ConversionResult
from .base import DocumentFormatConverterDriver

PDF_IMAGE_TARGET_FORMATS = {"png", "jpg", "jpeg"}


class PdfImageConverter(DocumentFormatConverterDriver):
    def capabilities(self) -> list[ConversionCapability]:
        return [
            ConversionCapability(
                source_extensions=PDF_EXTENSIONS,
                target_formats=PDF_IMAGE_TARGET_FORMATS,
                converter_name="pdf_image_renderer",
                description="PDF -> png, jpg, jpeg",
            )
        ]

    async def convert(self, request: ConversionRequest) -> ConversionResult:
        total = (await PdfMetadata.inspect(request.input_path))["page_count"]
        pages = RangeParser.parse_numeric(request.ranges, total) or list(range(1, total + 1))
        rendered = await PdfPageRenderer.render_pages(request.input_path, pages)
        output_paths = []
        for page_no, temp_path in rendered:
            out = request.output_dir / f"{request.input_path.stem}_page_{page_no:03d}.{request.normalized_target}"
            await async_move_file(temp_path, out)
            output_paths.append(out)
        return ConversionResult(output_files=output_paths, converter_name="pdf_image_renderer")

