"""PDF structured parsing driver.

PDF extraction keeps page boundaries when using local text mode. This lets the
index, outline, and summary point to precise chunk page ranges for large files.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional

from app.utils.async_file_utils import async_stat
from ..constants import DEFAULT_VISUAL_MAX_PAGES, PDF_EXTENSIONS
from ..models import DocumentChunk, DocumentNode, DocumentProfile, ExtractionResult, stable_document_id
from ..pdf.pdf_metadata import PdfMetadata
from ..pdf.pdf_outline_reader import PdfOutlineReader
from ..pdf.pdf_text_extractor import PdfTextExtractor
from ..pdf.pdf_visual_extractor import PdfVisualExtractor
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
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
        strategy = "local_text for bulk pages; visual only for selected complex/scanned pages"
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
        if mode == "visual":
            content = await PdfVisualExtractor.extract_pages(path, pages, kwargs.get("visual_query"))
            chunks = DocumentChunker.chunk_text(content, path.name, f"pages:{source_range}", max_chars=max_chars)
        else:
            segments = await PdfTextExtractor.extract_page_segments(path, pages)
            chunks = self._chunk_page_segments(segments, path.name, max_chars)
        chunks = await ChunkStore.write_chunks(output_dir, chunks)
        outline = OutlineBuilder.build_tree(await PdfOutlineReader.read(path)) or VirtualOutlineBuilder.by_units("page", total_pages)
        self._attach_chunks_to_outline(outline, chunks)
        remaining = [page for page in range(1, total_pages + 1) if page not in pages]
        return ExtractionResult(
            document_id=stable_document_id(path),
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            nodes=outline,
            pages_processed=len(pages),
            total_units=total_pages,
            next_range=compact_numeric_ranges(remaining[:10]) or None,
            metadata={"mode": mode, "source_range": source_range, **metadata},
        )

    @staticmethod
    def _chunk_page_segments(segments: Iterable[tuple[int, str]], title: str, max_chars: int) -> List[DocumentChunk]:
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
            page_markdown = f"## 第 {page_no} 页\n\n{page_text.strip()}"
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
