"""Generic MarkItDown-backed document driver.

This driver is best-effort. When an external converter is unavailable, it emits
a bounded metadata chunk instead of breaking the whole document-converter flow.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_exists, async_read_text, async_stat, async_unlink
from ..models import DocumentChunk, DocumentProfile, ExtractionResult, stable_document_id
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
from ..structure.heading_detector import HeadingDetector
from ..structure.outline_builder import OutlineBuilder
from ..structure.virtual_outline_builder import VirtualOutlineBuilder


class GenericMarkItDownDriver:
    """Driver that reuses the existing FileParser for whole-file extraction."""

    file_type = "document"
    unit_type = "section"
    supported_extensions: set[str] = set()

    def supports(self, path: Path) -> bool:
        return path.suffix.lower() in self.supported_extensions

    async def inspect(self, path: Path) -> DocumentProfile:
        title = path.name
        sample = ""
        try:
            from app.utils.file_parse import get_file_parser

            temp_path = path.with_suffix(path.suffix + ".inspect.tmp.md")
            parse_result = await get_file_parser().parse(path, temp_path, extract_images=False, enable_visual_understanding=False)
            if parse_result.success and parse_result.output_file_path and await async_exists(parse_result.output_file_path):
                sample = (await async_read_text(parse_result.output_file_path, errors="ignore"))[:4000]
                await async_unlink(parse_result.output_file_path)
        except Exception:
            sample = ""
        headings = HeadingDetector.detect(sample)
        nodes = OutlineBuilder.build_tree(headings) if headings else []
        file_stat = await async_stat(path)
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type=self.file_type,
            file_extension=path.suffix.lower(),
            file_size=file_stat.st_size,
            unit_type=self.unit_type,
            total_units=len(nodes) or 1,
            title=title,
            outline=nodes,
            samples=[{"range": "sample", "content": sample[:1000]}] if sample else [],
            recommended_strategy="inspect outline first, then extract targeted chunks",
            metadata={},
        )

    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: Optional[str] = None,
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        from app.utils.file_parse import get_file_parser

        document_id = stable_document_id(path)
        temp_output = output_dir / f"{path.name}.raw.md"
        parse_result = await get_file_parser().parse(
            path,
            temp_output,
            extract_images=kwargs.get("extract_images", True),
            enable_visual_understanding=False,
        )
        if not parse_result.success or not parse_result.output_file_path:
            return await self._fallback_extraction(
                path,
                output_dir,
                parse_result.error_message or "document extraction failed",
                mode,
            )
        content = await async_read_text(parse_result.output_file_path, errors="ignore")
        chunks = DocumentChunker.chunk_text(content, path.name, ranges or "all", max_chars=max_chars)
        chunks = await ChunkStore.write_chunks(output_dir, chunks)
        nodes = OutlineBuilder.build_tree(HeadingDetector.detect(content)) or VirtualOutlineBuilder.by_units(self.unit_type, len(chunks), 1)
        for node, chunk in zip(nodes, chunks):
            node.chunk_ids.append(chunk.chunk_id)
        return ExtractionResult(
            document_id=document_id,
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            nodes=nodes,
            total_units=len(chunks),
            pages_processed=len(chunks),
            metadata={"mode": mode, "raw_markdown_path": str(temp_output.relative_to(output_dir))},
        )

    async def _fallback_extraction(self, path: Path, output_dir: Path, error_message: str, mode: str) -> ExtractionResult:
        document_id = stable_document_id(path)
        content = "\n".join([
            f"# {path.name}",
            "",
            "Content extraction could not be completed in this environment.",
            "",
            f"- File type: `{path.suffix.lower()}`",
            f"- Extraction error: `{error_message}`",
            "",
            "The document is still indexed as a supported file type, but detailed Markdown content requires the relevant converter or parser dependency.",
        ])
        chunk = DocumentChunk(
            chunk_id="chunk_0001",
            title=path.name,
            content=content,
            source_range="all",
            metadata={"extraction_error": error_message, "fallback": True},
        )
        chunks = await ChunkStore.write_chunks(output_dir, [chunk])
        nodes = VirtualOutlineBuilder.by_units(self.unit_type, 1, 1)
        if nodes:
            nodes[0].title = path.name
            nodes[0].chunk_ids.append(chunks[0].chunk_id)
            chunks[0].parent_node_id = nodes[0].node_id
        return ExtractionResult(
            document_id=document_id,
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            nodes=nodes,
            total_units=1,
            pages_processed=1,
            metadata={"mode": mode, "fallback": True, "extraction_error": error_message},
        )
