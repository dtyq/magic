"""PDF structured parsing driver.

PDF extraction keeps page boundaries when using local text mode. This lets the
index, outline, and summary point to precise chunk page ranges for large files.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, List, Optional

from app.utils.async_file_utils import async_mkdir, async_stat, async_write_bytes, async_write_text
from ..constants import DEFAULT_VISUAL_MAX_PAGES, PDF_EXTENSIONS, VISUAL_RESULTS_DIRNAME
from ..models import DocumentAsset, DocumentChunk, DocumentNode, DocumentProfile, ExtractionResult, stable_document_id
from ..pdf.pdf_metadata import PdfMetadata
from ..pdf.pdf_outline_reader import PdfOutlineReader
from ..pdf.pdf_text_extractor import PdfTextExtractor
from ..pdf.pdf_visual_extractor import PdfVisualExtractor
from ..structure.asset_store import AssetStore
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
from ..structure.image_feature_analyzer import ImageFeatureAnalyzer
from ..structure.image_watermark_detector import ImageWatermarkDetector
from ..structure.outline_builder import OutlineBuilder
from ..structure.range_parser import RangeParser, compact_numeric_ranges
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .base import DocumentDriver


class PdfDocumentDriver(DocumentDriver):
    file_type = "pdf"
    unit_type = "page"
    supported_extensions = PDF_EXTENSIONS

    async def inspect(self, path: Path) -> DocumentProfile:
        metadata = await PdfMetadata.inspect(path)
        outline = OutlineBuilder.build_tree(await PdfOutlineReader.read(path))
        if not outline:
            outline = VirtualOutlineBuilder.by_units("page", metadata["page_count"])
        if metadata.get("is_scanned_like"):
            strategy = "sample first, extract image assets, then use understand_document_images in batches of at most 10 pages"
        else:
            strategy = "sample first; use local_text for readable ranges and image understanding only when needed"
        file_stat = await async_stat(path)
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type=self.file_type,
            file_extension=path.suffix.lower(),
            file_size=file_stat.st_size,
            unit_type=self.unit_type,
            total_units=metadata["page_count"],
            title=path.name,
            outline=outline,
            samples=[],
            recommended_strategy=strategy,
            metadata=metadata,
        )

    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: Optional[str] = None,
        mode: str = "local_text",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        metadata = await PdfMetadata.inspect(path)
        total_pages = metadata["page_count"]
        pages = RangeParser.parse_numeric(ranges, total_pages) or list(range(1, total_pages + 1))
        if mode == "visual" and len(pages) > kwargs.get("visual_max_pages", DEFAULT_VISUAL_MAX_PAGES):
            raise ValueError(f"visual mode supports at most {DEFAULT_VISUAL_MAX_PAGES} pages per call; requested {len(pages)}")
        source_range = compact_numeric_ranges(pages)
        skipped_images: list[dict[str, Any]] = []
        if kwargs.get("extract_images", False):
            assets, skipped_images = await self._extract_image_assets(
                path,
                output_dir,
                pages,
                exclude_watermark_images=kwargs.get("exclude_watermark_images", True),
                deduplicate_repeated_images=kwargs.get("deduplicate_repeated_images", True),
            )
        else:
            assets = []
        if mode == "visual":
            content = await PdfVisualExtractor.extract_pages(path, pages, kwargs.get("visual_query"))
            visual_result_path = await self._write_visual_result(output_dir, source_range, content)
            chunks = DocumentChunker.chunk_text(content, path.name, f"pages:{source_range}", max_chars=max_chars)
        else:
            visual_result_path = None
            segments = await PdfTextExtractor.extract_page_segments(path, pages)
            chunks = self._chunk_page_segments(segments, path.name, max_chars, assets)
        chunks = await ChunkStore.write_chunks(output_dir, chunks)
        outline = OutlineBuilder.build_tree(await PdfOutlineReader.read(path)) or VirtualOutlineBuilder.by_units("page", total_pages)
        self._attach_chunks_to_outline(outline, chunks)
        remaining = [page for page in range(1, total_pages + 1) if page not in pages]
        return ExtractionResult(
            document_id=stable_document_id(path),
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            assets=assets,
            nodes=outline,
            pages_processed=len(pages),
            total_units=total_pages,
            next_range=compact_numeric_ranges(remaining[:10]) or None,
            metadata={
                "mode": mode,
                "source_range": source_range,
                "skipped_images": skipped_images,
                "skipped_watermark_images": [item for item in skipped_images if "watermark" in str(item.get("reason", ""))],
                **({"visual_result_path": visual_result_path} if visual_result_path else {}),
                **metadata,
            },
        )

    @staticmethod
    async def _extract_image_assets(
        path: Path,
        output_dir: Path,
        pages: Iterable[int],
        exclude_watermark_images: bool = True,
        deduplicate_repeated_images: bool = True,
    ) -> tuple[List[DocumentAsset], list[dict[str, Any]]]:
        page_list = list(pages)
        images = await PdfDocumentDriver._read_page_images(path, page_list)
        if not images:
            return [], []
        images, skipped_watermarks = ImageWatermarkDetector.split_images(
            images,
            selected_unit_count=len(page_list),
            enabled=exclude_watermark_images,
            deduplicate_repeated_images=deduplicate_repeated_images,
        )
        if not images:
            return [], skipped_watermarks
        assets_dir = await AssetStore.ensure(output_dir)
        assets: List[DocumentAsset] = []
        for index, image in enumerate(images, start=1):
            ext = str(image.get("ext") or "png").lower()
            page_no = int(image["page"])
            image_no = int(image["image_index"])
            xref = int(image["xref"])
            file_name = f"pdf_page_{page_no:03d}_image_{image_no:03d}_xref_{xref}.{ext}"
            asset_path = assets_dir / file_name
            await async_write_bytes(asset_path, image["bytes"])
            assets.append(DocumentAsset(
                asset_id=f"asset_{index:04d}",
                asset_type="image",
                path=str(asset_path.relative_to(output_dir)),
                title=f"PDF page {page_no} image {image_no}",
                source_range=f"pages:{page_no}",
                metadata={
                    "page": page_no,
                    "image_index": image_no,
                    "xref": xref,
                    "format": ext.upper(),
                    "width": image.get("width"),
                    "height": image.get("height"),
                    "content_hash": image.get("content_hash"),
                    "rects": image.get("rects", []),
                    "features": image.get("features"),
                },
            ))
        return assets, skipped_watermarks

    @staticmethod
    async def _read_page_images(path: Path, pages: Iterable[int]) -> List[dict[str, Any]]:
        import asyncio

        return await asyncio.to_thread(PdfDocumentDriver._read_page_images_sync, path, list(pages))

    @staticmethod
    def _read_page_images_sync(path: Path, pages: List[int]) -> List[dict[str, Any]]:
        import hashlib

        import fitz

        extracted: List[dict[str, Any]] = []
        with fitz.open(str(path)) as doc:
            for page_no in pages:
                if page_no < 1 or page_no > doc.page_count:
                    continue
                page = doc[page_no - 1]
                for image_index, image_info in enumerate(page.get_images(full=True), start=1):
                    xref = int(image_info[0])
                    try:
                        image = doc.extract_image(xref)
                    except Exception:
                        continue
                    image_bytes = image.get("image")
                    if not image_bytes:
                        continue
                    rects = PdfDocumentDriver._image_rects(page, xref)
                    features = ImageFeatureAnalyzer.analyze_bytes(image_bytes)
                    extracted.append({
                        "page": page_no,
                        "unit": page_no,
                        "image_index": image_index,
                        "xref": xref,
                        "name": image_info[7] if len(image_info) > 7 else "",
                        "ext": image.get("ext") or "png",
                        "width": image.get("width"),
                        "height": image.get("height"),
                        "content_hash": hashlib.sha1(image_bytes).hexdigest(),
                        "rects": rects,
                        "features": features,
                        "bytes": image_bytes,
                    })
        return extracted

    @staticmethod
    def _image_rects(page, xref: int) -> list[dict[str, float]]:
        import fitz

        page_rect = page.rect
        page_area = max(float(page_rect.width * page_rect.height), 1.0)
        page_center = fitz.Point((page_rect.x0 + page_rect.x1) / 2, (page_rect.y0 + page_rect.y1) / 2)
        center_box_width = page_rect.width * 0.5
        center_box_height = page_rect.height * 0.5
        center_box = fitz.Rect(
            page_center.x - center_box_width / 2,
            page_center.y - center_box_height / 2,
            page_center.x + center_box_width / 2,
            page_center.y + center_box_height / 2,
        )
        rects: list[dict[str, float]] = []
        try:
            image_rects = page.get_image_rects(xref)
        except Exception:
            image_rects = []
        for rect in image_rects:
            intersection = rect & center_box
            rect_area = max(float(rect.width * rect.height), 1.0)
            rects.append({
                "x0": float(rect.x0),
                "y0": float(rect.y0),
                "x1": float(rect.x1),
                "y1": float(rect.y1),
                "area_ratio": rect_area / page_area,
                "center_overlap_ratio": max(float(intersection.width * intersection.height), 0.0) / rect_area,
            })
        return rects

    @staticmethod
    async def _write_visual_result(output_dir: Path, source_range: str, content: str) -> str:
        visual_dir = output_dir / VISUAL_RESULTS_DIRNAME
        await async_mkdir(visual_dir, parents=True, exist_ok=True)
        safe_range = source_range.replace(",", "_").replace("-", "_")
        result_path = visual_dir / f"pdf_pages_{safe_range}.md"
        await async_write_text(result_path, content)
        return str(result_path.relative_to(output_dir))

    @staticmethod
    def _chunk_page_segments(
        segments: Iterable[tuple[int, str]],
        title: str,
        max_chars: int,
        assets: Optional[List[DocumentAsset]] = None,
    ) -> List[DocumentChunk]:
        assets_by_page: dict[int, list[DocumentAsset]] = {}
        for asset in assets or []:
            page = asset.metadata.get("page")
            if isinstance(page, int):
                assets_by_page.setdefault(page, []).append(asset)
        chunks: List[DocumentChunk] = []
        current_parts: List[str] = []
        current_pages: List[int] = []
        current_len = 0

        def flush() -> None:
            nonlocal current_parts, current_pages, current_len
            if not current_parts or not current_pages:
                return
            index = len(chunks) + 1
            page_range = compact_numeric_ranges(current_pages)
            chunks.append(DocumentChunk(
                chunk_id=f"chunk_{index:04d}",
                title=f"{title} pages {page_range}",
                content="\n\n".join(current_parts).strip(),
                source_range=f"pages:{page_range}",
                metadata={"unit_type": "page", "pages": current_pages.copy()},
            ))
            current_parts = []
            current_pages = []
            current_len = 0

        for page_no, page_text in segments:
            page_markdown = PdfDocumentDriver._page_markdown(page_no, page_text, assets_by_page.get(page_no, []))
            page_len = len(page_markdown) + 2
            if current_parts and current_len + page_len > max_chars:
                flush()
            current_parts.append(page_markdown)
            current_pages.append(page_no)
            current_len += page_len
        flush()

        for index, chunk in enumerate(chunks):
            if index > 0:
                chunk.previous_chunk_id = chunks[index - 1].chunk_id
            if index + 1 < len(chunks):
                chunk.next_chunk_id = chunks[index + 1].chunk_id
        return chunks

    @staticmethod
    def _page_markdown(page_no: int, page_text: str, assets: List[DocumentAsset]) -> str:
        parts = [f"## 第 {page_no} 页", "", page_text.strip()]
        if assets:
            parts.extend(["", "### Images"])
            for asset in assets:
                parts.append(f"![{asset.title}]({asset.path})")
        return "\n\n".join(part for part in parts if part)

    @staticmethod
    def _attach_chunks_to_outline(nodes: List[DocumentNode], chunks: List[DocumentChunk]) -> None:
        chunk_pages = []
        for chunk in chunks:
            pages = chunk.metadata.get("pages")
            if isinstance(pages, list):
                chunk_pages.append((chunk, {int(page) for page in pages if str(page).isdigit()}))

        def visit(node_list: List[DocumentNode]) -> None:
            for node in node_list:
                node_page = PdfDocumentDriver._source_range_start_page(node.source_range)
                if node_page is not None:
                    node.chunk_ids = [chunk.chunk_id for chunk, pages in chunk_pages if node_page in pages]
                    for chunk in chunks:
                        if chunk.chunk_id in node.chunk_ids and not chunk.parent_node_id:
                            chunk.parent_node_id = node.node_id
                visit(node.children)

        visit(nodes)
        if nodes and chunks and not any(node.chunk_ids for node in PdfDocumentDriver._iter_nodes(nodes)):
            nodes[0].chunk_ids = [chunk.chunk_id for chunk in chunks]

    @staticmethod
    def _source_range_start_page(source_range: str) -> Optional[int]:
        text = str(source_range or "").removeprefix("pages:").strip()
        if not text:
            return None
        first = text.split(",", 1)[0].split("-", 1)[0].strip()
        return int(first) if first.isdigit() else None

    @staticmethod
    def _iter_nodes(nodes: List[DocumentNode]) -> Iterable[DocumentNode]:
        for node in nodes:
            yield node
            yield from PdfDocumentDriver._iter_nodes(node.children)
