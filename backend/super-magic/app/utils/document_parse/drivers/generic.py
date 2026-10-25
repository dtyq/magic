"""Generic MarkItDown-backed document driver.

This driver is best-effort. When an external converter is unavailable, it emits
a bounded metadata chunk instead of breaking the whole document-converter flow.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import (
    async_copy2,
    async_exists,
    async_is_dir,
    async_iterdir,
    async_read_bytes,
    async_read_text,
    async_stat,
    async_unlink,
)

from ..models import DocumentAsset, DocumentChunk, DocumentProfile, ExtractionResult, stable_document_id
from ..service.asset_strategy import AssetExtractionOptions, AssetStrategyResolver
from ..structure.asset_store import AssetStore
from ..structure.chunk_store import ChunkStore
from ..structure.chunker import DocumentChunker
from ..structure.heading_detector import HeadingDetector
from ..structure.image_feature_analyzer import ImageFeatureAnalyzer
from ..structure.image_watermark_detector import ImageWatermarkDetector
from ..structure.outline_builder import OutlineBuilder
from ..structure.range_parser import RangeParser
from ..structure.reusable_image_selector import ReusableImageSelector
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .base import DocumentDriver


class GenericMarkItDownDriver(DocumentDriver):
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

        asset_options = self._resolve_asset_options(kwargs)
        parser_extract_images = asset_options.extract_embedded_images
        embedded_image_policy = asset_options.embedded_image_policy
        strategy_execution = "native"
        preserve_all_assets = (
            asset_options.resolved_strategy == "full_fidelity" and asset_options.requested_strategy != "legacy"
        )
        if asset_options.resolved_strategy == "page_visual":
            # 通用 Office 解析器没有统一的页面渲染器，用筛选后的内嵌资产保留视觉信息。
            parser_extract_images = True
            embedded_image_policy = "selected"
            strategy_execution = "selected_embedded_assets"
        document_id = stable_document_id(path)
        temp_output = output_dir / f"{path.name}.raw.md"
        parse_result = await get_file_parser().parse(
            path,
            temp_output,
            ranges=ranges,
            extract_images=parser_extract_images,
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
            exclude_watermark_images=kwargs.get("exclude_watermark_images", True) and not preserve_all_assets,
            deduplicate_repeated_images=kwargs.get("deduplicate_repeated_images", True) and not preserve_all_assets,
            embedded_image_policy=embedded_image_policy,
        )
        content = self._remove_skipped_image_links(content, parse_result.output_images_dir, skipped_images)
        content = self._rewrite_image_links_to_assets(content, parse_result.output_images_dir, assets)
        self._assign_asset_units_from_markdown(content, assets)
        content = self._append_missing_image_links(content, assets)
        chunks = DocumentChunker.chunk_text(content, path.name, ranges or "all", max_chars=max_chars)
        chunks = await ChunkStore.write_chunks(output_dir, chunks, [asset.path for asset in assets])
        total_units = self._resolve_total_units(path, content, parse_result, chunks)
        processed_units = self._resolve_processed_units(ranges, total_units, chunks)
        nodes = OutlineBuilder.build_tree(HeadingDetector.detect(content)) or VirtualOutlineBuilder.by_units(self.unit_type, total_units, 1)
        self._attach_chunks_to_nodes(nodes, chunks, total_units)
        return ExtractionResult(
            document_id=document_id,
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            assets=assets,
            nodes=nodes,
            total_units=total_units,
            pages_processed=processed_units,
            metadata={
                "mode": mode,
                "raw_markdown_path": str(temp_output.relative_to(output_dir)),
                "source_range": ranges or "all",
                "skipped_images": skipped_images,
                "skipped_watermark_images": [item for item in skipped_images if "watermark" in str(item.get("reason", ""))],
                "asset_strategy": {**asset_options.to_dict(), "execution": strategy_execution},
            },
        )

    def _resolve_asset_options(self, kwargs: dict) -> AssetExtractionOptions:
        """解析通用驱动的高层资产策略，并兼容旧参数。"""

        if "asset_strategy" in kwargs:
            profile = DocumentProfile(
                source_path="",
                file_name="",
                file_type=self.file_type,
                file_extension="",
                file_size=0,
                unit_type=self.unit_type,
            )
            return AssetStrategyResolver.resolve(
                kwargs.get("asset_strategy"),
                profile=profile,
                goal=str(kwargs.get("goal") or ""),
            )
        legacy_extract_images = bool(kwargs.get("extract_images", True))
        return AssetExtractionOptions(
            requested_strategy="legacy",
            resolved_strategy="full_fidelity" if legacy_extract_images else "text_only",
            extract_embedded_images=legacy_extract_images,
            embedded_image_policy="all" if legacy_extract_images else "none",
            page_snapshot_policy="never",
            visual_hint="none",
            reason="legacy extract_images compatibility mode",
            confidence="legacy",
        )

    async def _collect_image_assets(
        self,
        images_dir: str,
        output_dir: Path,
        source_prefix: str,
        exclude_watermark_images: bool = True,
        deduplicate_repeated_images: bool = True,
        embedded_image_policy: str = "all",
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
        if embedded_image_policy == "selected":
            image_records, skipped_watermarks = ReusableImageSelector.select(
                image_records,
                deduplicate_repeated_images=deduplicate_repeated_images,
            )
        else:
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

    def _assign_asset_units_from_markdown(self, content: str, assets: list[DocumentAsset]) -> None:
        """从 Markdown 标记中回填图片所属的页/幻灯片编号。"""

        if not assets:
            return
        unit_pattern = self._unit_marker_pattern()
        if unit_pattern is None:
            return
        by_link: dict[str, DocumentAsset] = {}
        for asset in assets:
            candidates = {
                str(asset.path or ""),
                f"./{asset.path}" if asset.path else "",
                str(asset.title or ""),
                str((asset.metadata or {}).get("original_name") or ""),
            }
            for candidate in candidates:
                normalized = candidate.strip()
                if normalized:
                    by_link[normalized] = asset
                    by_link[normalized.removeprefix("./")] = asset
        current_unit: int | None = None
        image_pattern = re.compile(r"!\[[^\]]*]\(([^)]+)\)")
        for line in content.splitlines():
            marker = unit_pattern.search(line)
            if marker:
                current_unit = int(marker.group(1))
            if current_unit is None:
                continue
            for image_match in image_pattern.finditer(line):
                link = image_match.group(1).strip()
                asset = by_link.get(link) or by_link.get(link.removeprefix("./"))
                if not asset or asset.metadata.get(self.unit_type):
                    continue
                asset.metadata[self.unit_type] = current_unit
                asset.source_range = f"{self._unit_range_prefix()}:{current_unit}"

    def _resolve_total_units(self, path: Path, content: str, parse_result, chunks: list[DocumentChunk]) -> int:
        """解析本次提取结果对应的文档总单元数。"""

        parser_total = self._parser_reported_total_units(parse_result)
        marker_total = self._max_marked_unit(content)
        return max(parser_total, marker_total, len(chunks), 1)

    def _resolve_processed_units(self, ranges: str | None, total_units: int, chunks: list[DocumentChunk]) -> int:
        """根据范围表达式估算本次实际处理的页/幻灯片数量。"""

        if ranges and total_units > 0:
            try:
                selected = RangeParser.parse_numeric(ranges, total_units)
                if selected:
                    return len(selected)
            except Exception:
                return len(chunks)
        return total_units or len(chunks)

    def _attach_chunks_to_nodes(self, nodes, chunks: list[DocumentChunk], total_units: int) -> None:
        """按范围关系把 chunk 挂到对应的目录节点上。"""

        if not nodes or not chunks:
            return
        for node in nodes:
            node.chunk_ids = []
        node_units = [(node, self._parse_source_units(node.source_range, total_units)) for node in nodes]
        if not any(units for _, units in node_units):
            for node, chunk in zip(nodes, chunks):
                node.chunk_ids.append(chunk.chunk_id)
            return
        for chunk in chunks:
            chunk_units = self._parse_source_units(chunk.source_range, total_units)
            attached = False
            for node, units in node_units:
                if chunk_units and units and chunk_units.isdisjoint(units):
                    continue
                if chunk.chunk_id not in node.chunk_ids:
                    node.chunk_ids.append(chunk.chunk_id)
                attached = True
            if not attached and chunk.chunk_id not in nodes[0].chunk_ids:
                nodes[0].chunk_ids.append(chunk.chunk_id)

    def _parse_source_units(self, source_range: str, total_units: int) -> set[int]:
        """把带前缀或 all 的范围表达式转为单元编号集合。"""

        normalized = str(source_range or "").strip()
        if not normalized:
            return set()
        for prefix in ("pages:", "slides:", "sections:"):
            normalized = normalized.removeprefix(prefix)
        if normalized.lower() == "all":
            return set(range(1, total_units + 1)) if total_units > 0 else set()
        try:
            return set(RangeParser.parse_numeric(normalized, total_units or None))
        except Exception:
            return set()

    def _unit_marker_pattern(self) -> re.Pattern | None:
        """返回当前文档单元在 Markdown 中的注释标记。"""

        patterns = {
            "slide": r"<!--\s*Slide number:\s*(\d+)\s*-->",
            "page": r"<!--\s*Page number:\s*(\d+)\s*-->",
        }
        pattern = patterns.get(self.unit_type)
        return re.compile(pattern, re.IGNORECASE) if pattern else None

    def _max_marked_unit(self, content: str) -> int:
        """读取 Markdown 注释中出现过的最大页/幻灯片编号。"""

        pattern = self._unit_marker_pattern()
        if pattern is None:
            return 0
        values = [int(match.group(1)) for match in pattern.finditer(content)]
        return max(values) if values else 0

    @staticmethod
    def _parser_reported_total_units(parse_result) -> int:
        """读取底层 parser 暴露的总单元数。"""

        additional_info = getattr(getattr(parse_result, "metadata", None), "additional_info", None) or {}
        for key in ("total_units", "slide_count", "page_count", "sheet_count"):
            value = additional_info.get(key)
            if isinstance(value, int) and value > 0:
                return value
        return 0

    def _unit_range_prefix(self) -> str:
        """生成 source_range 使用的单元前缀。"""

        prefixes = {
            "slide": "slides",
            "page": "pages",
            "section": "sections",
        }
        return prefixes.get(self.unit_type, f"{self.unit_type}s")

    @staticmethod
    def _remove_skipped_image_links(content: str, images_dir: str, skipped_assets: list[dict]) -> str:
        if not images_dir or not skipped_assets:
            return content
        images_dir_name = re.escape(Path(images_dir).name)
        updated = content
        for asset in skipped_assets:
            original_name = str(asset.get("original_name") or "")
            if not original_name:
                continue
            markdown_image_line = re.compile(
                rf"^[ \t]*!\[[^\]]*]\((?:\./)?{images_dir_name}/{re.escape(original_name)}\)[ \t]*$",
                re.MULTILINE,
            )
            replacement = GenericMarkItDownDriver._skipped_image_note(asset) if asset.get("reason") == "invalid solid or blank image" else ""
            updated = markdown_image_line.sub(replacement, updated)
        return updated

    @staticmethod
    def _skipped_image_note(asset: dict) -> str:
        width = asset.get("width") or "unknown"
        height = asset.get("height") or "unknown"
        name = asset.get("original_name") or "image"
        return f"- Filtered solid/blank image `{name}` ({width}x{height}); no asset was generated."

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
