"""Generic MarkItDown-backed document driver.

This driver is best-effort. When an external converter is unavailable, it emits
a bounded metadata chunk instead of breaking the whole document-converter flow.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
import re
from typing import Optional

from app.utils.async_file_utils import async_copy2, async_exists, async_is_dir, async_iterdir, async_read_bytes, async_read_text, async_stat, async_unlink
from ..models import DocumentAsset, DocumentChunk, DocumentProfile, ExtractionResult, stable_document_id
from ..structure.asset_store import AssetStore
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
from ..structure.heading_detector import HeadingDetector
from ..structure.image_feature_analyzer import ImageFeatureAnalyzer
from ..structure.image_watermark_detector import ImageWatermarkDetector
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
        assets, skipped_images = await self._collect_image_assets(
            parse_result.output_images_dir,
            output_dir,
            path.stem,
            exclude_watermark_images=kwargs.get("exclude_watermark_images", True),
            deduplicate_repeated_images=kwargs.get("deduplicate_repeated_images", True),
        )
        content = self._remove_skipped_image_links(content, parse_result.output_images_dir, skipped_images)
        content = self._rewrite_image_links_to_assets(content, parse_result.output_images_dir, assets)
        content = self._append_missing_image_links(content, assets)
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
            assets=assets,
            nodes=nodes,
            total_units=len(chunks),
            pages_processed=len(chunks),
            metadata={
                "mode": mode,
                "raw_markdown_path": str(temp_output.relative_to(output_dir)),
                "skipped_images": skipped_images,
                "skipped_watermark_images": [item for item in skipped_images if "watermark" in str(item.get("reason", ""))],
            },
        )

    async def _collect_image_assets(
        self,
        images_dir: str,
        output_dir: Path,
        source_prefix: str,
        exclude_watermark_images: bool = True,
        deduplicate_repeated_images: bool = True,
    ) -> tuple[list[DocumentAsset], list[dict]]:
        if not images_dir:
            return [], []
        source_dir = Path(images_dir)
        if not await async_exists(source_dir) or not await async_is_dir(source_dir):
            return [], []
        files = [item for item in await async_iterdir(source_dir) if item.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"}]
        if not files:
            return [], []
        image_records = []
        for image_path in sorted(files, key=lambda item: item.name):
            image_bytes = await async_read_bytes(image_path)
            features = ImageFeatureAnalyzer.analyze_bytes(image_bytes)
            image_records.append({
                "path": str(image_path),
                "original_name": image_path.name,
                "name": image_path.name,
                "content_hash": hashlib.sha1(image_bytes).hexdigest(),
                "width": features.get("width"),
                "height": features.get("height"),
                "features": features,
            })
        image_records, skipped_watermarks = ImageWatermarkDetector.split_images(
            image_records,
            enabled=exclude_watermark_images,
            deduplicate_repeated_images=deduplicate_repeated_images,
        )
        if not image_records:
            return [], skipped_watermarks
        assets_dir = await AssetStore.ensure(output_dir)
        assets: list[DocumentAsset] = []
        safe_prefix = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in source_prefix).strip("_") or "document"
        for index, image in enumerate(image_records, start=1):
            image_path = Path(str(image["path"]))
            target_name = f"{safe_prefix}_image_{index:04d}{image_path.suffix.lower()}"
            target_path = assets_dir / target_name
            await async_copy2(image_path, target_path)
            assets.append(DocumentAsset(
                asset_id=f"asset_{index:04d}",
                asset_type="image",
                path=str(target_path.relative_to(output_dir)),
                title=image_path.name,
                source_range="all",
                metadata={
                    "original_path": str(image_path),
                    "original_name": image_path.name,
                    "content_hash": image.get("content_hash"),
                    "features": image.get("features"),
                },
            ))
        return assets, skipped_watermarks

    @staticmethod
    def _remove_skipped_image_links(content: str, images_dir: str, skipped_assets: list[dict]) -> str:
        if not images_dir or not skipped_assets:
            return content
        images_dir_name = re.escape(Path(images_dir).name)
        names = [re.escape(str(asset.get("original_name"))) for asset in skipped_assets if asset.get("original_name")]
        if not names:
            return content
        name_pattern = "|".join(names)
        markdown_image_line = re.compile(
            rf"^[ \t]*!\[[^\]]*]\((?:\./)?{images_dir_name}/(?:{name_pattern})\)[ \t]*$",
            re.MULTILINE,
        )
        return markdown_image_line.sub("", content)

    @staticmethod
    def _rewrite_image_links_to_assets(content: str, images_dir: str, assets: list[DocumentAsset]) -> str:
        if not images_dir or not assets:
            return content
        images_dir_name = Path(images_dir).name
        by_original_name = {asset.metadata.get("original_name"): asset.path for asset in assets}
        updated = content
        for original_name, asset_path in by_original_name.items():
            if not original_name:
                continue
            updated = updated.replace(f"./{images_dir_name}/{original_name}", asset_path)
            updated = updated.replace(f"{images_dir_name}/{original_name}", asset_path)
        return updated

    @staticmethod
    def _append_missing_image_links(content: str, assets: list[DocumentAsset]) -> str:
        missing_assets = [asset for asset in assets if f"]({asset.path})" not in content]
        if not missing_assets:
            return content
        lines = [content.rstrip(), "", "## Extracted Images", ""]
        for asset in missing_assets:
            lines.append(f"![{asset.title}]({asset.path})")
        return "\n".join(lines).rstrip()

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
