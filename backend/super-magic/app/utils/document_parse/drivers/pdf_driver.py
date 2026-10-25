"""PDF 混合解析驱动。

PDF 抽取会保留页面边界，并把文本层、内嵌图片、可选整页快照组合成统一的结构化输出。
"""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any, Iterable, List, Optional

from app.utils.async_file_utils import async_stat, async_write_bytes

from ..constants import (
    DEFAULT_PAGE_SNAPSHOT_MAX_PAGES,
    DEFAULT_VIRTUAL_PAGE_GROUP_SIZE,
    PDF_EXTENSIONS,
)
from ..models import (
    DocumentAsset,
    DocumentAssetType,
    DocumentChunk,
    DocumentNode,
    DocumentProfile,
    ExtractionResult,
    stable_document_id,
)
from ..pdf.pdf_file_validator import PdfFileValidator
from ..pdf.pdf_metadata import PdfMetadata
from ..pdf.pdf_outline_reader import PdfOutlineReader
from ..pdf.pdf_page_snapshot_extractor import PdfPageSnapshotExtractor
from ..pdf.pdf_strategy import PdfExtractionStrategy
from ..pdf.pdf_text_extractor import PdfTextExtractor
from ..service.asset_strategy import AssetExtractionOptions, AssetStrategyResolver
from ..service.reading_state import ReadingStateStore
from ..structure.asset_store import AssetStore
from ..structure.chunk_store import ChunkStore
from ..structure.image_feature_analyzer import ImageFeatureAnalyzer
from ..structure.image_watermark_detector import ImageWatermarkDetector
from ..structure.outline_builder import OutlineBuilder
from ..structure.range_parser import RangeParser, compact_numeric_ranges
from ..structure.reusable_image_selector import ReusableImageSelector
from ..structure.virtual_outline_builder import VirtualOutlineBuilder
from .base import DocumentDriver


class PdfDocumentDriver(DocumentDriver):
    file_type = "pdf"
    unit_type = "page"
    supported_extensions = PDF_EXTENSIONS

    async def inspect(self, path: Path) -> DocumentProfile:
        validation = await PdfFileValidator().validate(path)
        if not validation.ok:
            raise ValueError(validation.error_message)
        metadata = await PdfMetadata.inspect(path)
        outline = OutlineBuilder.build_tree(await PdfOutlineReader.read(path))
        if not outline:
            outline = VirtualOutlineBuilder.by_units("page", metadata["page_count"])
        if metadata.get("is_scanned_like"):
            strategy = "sample first; use hybrid extraction with page snapshots and understand_document_images in batches of at most 10 assets"
        else:
            strategy = "sample first; use hybrid extraction, adding page snapshots only for pages that need visual evidence"
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
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        validation = await PdfFileValidator().validate(path)
        if not validation.ok:
            raise ValueError(validation.error_message)
        metadata = await PdfMetadata.inspect(path)
        total_pages = metadata["page_count"]
        pages = RangeParser.parse_numeric(ranges, total_pages) or list(range(1, total_pages + 1))
        source_range = compact_numeric_ranges(pages)
        profile = DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type=self.file_type,
            file_extension=path.suffix.lower(),
            file_size=0,
            unit_type=self.unit_type,
            total_units=total_pages,
            title=path.name,
            metadata=metadata,
        )
        asset_options = self._resolve_asset_options(kwargs, profile)
        preserve_all_assets = (
            asset_options.resolved_strategy == "full_fidelity" and asset_options.requested_strategy != "legacy"
        )
        decision = PdfExtractionStrategy().decide(
            pages=pages,
            metadata=metadata,
            extract_embedded_images=asset_options.extract_embedded_images,
            page_snapshot_policy=asset_options.page_snapshot_policy,
            visual_hint=asset_options.visual_hint,
            page_snapshot_max_pages=int(kwargs.get("page_snapshot_max_pages", DEFAULT_PAGE_SNAPSHOT_MAX_PAGES)),
        )

        skipped_images: list[dict[str, Any]] = []
        assets: list[DocumentAsset] = []
        if decision.extract_embedded_images:
            embedded_assets, skipped_images = await self._extract_image_assets(
                path,
                output_dir,
                pages,
                exclude_watermark_images=kwargs.get("exclude_watermark_images", True) and not preserve_all_assets,
                deduplicate_repeated_images=kwargs.get("deduplicate_repeated_images", True) and not preserve_all_assets,
                embedded_image_policy=asset_options.embedded_image_policy,
            )
            assets.extend(embedded_assets)
        if decision.extract_page_snapshots:
            snapshot_assets = await PdfPageSnapshotExtractor().extract(
                path,
                output_dir,
                decision.page_snapshot_pages,
                dpi=int(kwargs.get("page_snapshot_dpi", 120)),
                image_format=str(kwargs.get("page_snapshot_format", "jpg")),
                render_reason=decision.reason,
                start_index=len(assets) + 1,
            )
            assets.extend(snapshot_assets)
            await ReadingStateStore().mark_page_snapshots_rendered(
                output_dir,
                snapshots=[
                    {
                        "asset_path": asset.path,
                        "source_range": asset.source_range or "",
                        "page": asset.metadata.get("page"),
                        "render_reason": asset.metadata.get("render_reason") or "",
                    }
                    for asset in snapshot_assets
                ],
                recommendations=["Run understand_document_images for rendered page snapshots that require layout-level reading."],
            )
        assets = self._renumber_assets(assets)

        segments = await PdfTextExtractor.extract_page_segments(path, pages)
        chunks = self._chunk_page_segments(segments, path.name, max_chars, assets, skipped_images)
        chunks = await ChunkStore.write_chunks(output_dir, chunks, [asset.path for asset in assets])
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
                "mode": "hybrid",
                "requested_mode": mode,
                "source_range": source_range,
                "extraction_decision": asdict(decision),
                "validation": {
                    "page_count": validation.page_count,
                },
                "skipped_images": skipped_images,
                "skipped_watermark_images": [item for item in skipped_images if "watermark" in str(item.get("reason", ""))],
                "asset_strategy": asset_options.to_dict(),
                **metadata,
            },
        )

    @staticmethod
    def _resolve_asset_options(kwargs: dict[str, Any], profile: DocumentProfile) -> AssetExtractionOptions:
        """解析新策略参数，并兼容旧的 extract_images 参数。"""

        if "asset_strategy" in kwargs:
            return AssetStrategyResolver.resolve(
                kwargs.get("asset_strategy"),
                profile=profile,
                sample_signal=kwargs.get("sample_signal"),
                goal=str(kwargs.get("goal") or ""),
            )
        legacy_extract_images = bool(kwargs.get("extract_images", True))
        return AssetExtractionOptions(
            requested_strategy="legacy",
            resolved_strategy="full_fidelity" if legacy_extract_images else "text_only",
            extract_embedded_images=legacy_extract_images,
            embedded_image_policy="all" if legacy_extract_images else "none",
            page_snapshot_policy=str(kwargs.get("page_snapshot_policy", "auto")),
            visual_hint=str(kwargs.get("visual_hint", "auto")),
            reason="legacy extract_images compatibility mode",
            confidence="legacy",
        )

    @staticmethod
    def _renumber_assets(assets: list[DocumentAsset]) -> list[DocumentAsset]:
        """在组合多层抽取结果后重新分配稳定的资产编号。"""

        for index, asset in enumerate(assets, start=1):
            asset.asset_id = f"asset_{index:04d}"
        return assets

    @staticmethod
    async def _extract_image_assets(
        path: Path,
        output_dir: Path,
        pages: Iterable[int],
        exclude_watermark_images: bool = True,
        deduplicate_repeated_images: bool = True,
        embedded_image_policy: str = "all",
    ) -> tuple[List[DocumentAsset], list[dict[str, Any]]]:
        page_list = list(pages)
        images = await PdfDocumentDriver._read_page_images(path, page_list)
        if not images:
            return [], []
        if embedded_image_policy == "selected":
            images, skipped_watermarks = ReusableImageSelector.select(
                images,
                selected_unit_count=len(page_list),
                deduplicate_repeated_images=deduplicate_repeated_images,
            )
        else:
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
                asset_type=DocumentAssetType.EMBEDDED_IMAGE.value,
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
    def _chunk_page_segments(
        segments: Iterable[tuple[int, str]],
        title: str,
        max_chars: int,
        assets: Optional[List[DocumentAsset]] = None,
        skipped_images: Optional[list[dict[str, Any]]] = None,
    ) -> List[DocumentChunk]:
        assets_by_page: dict[int, list[DocumentAsset]] = {}
        for asset in assets or []:
            page = asset.metadata.get("page")
            if isinstance(page, int):
                assets_by_page.setdefault(page, []).append(asset)
        skipped_solid_by_page: dict[int, list[dict[str, Any]]] = {}
        for skipped_image in skipped_images or []:
            if skipped_image.get("reason") != "invalid solid or blank image":
                continue
            page = skipped_image.get("page")
            if isinstance(page, int):
                skipped_solid_by_page.setdefault(page, []).append(skipped_image)
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
            page_markdown = PdfDocumentDriver._page_markdown(
                page_no,
                page_text,
                assets_by_page.get(page_no, []),
                skipped_solid_by_page.get(page_no, []),
            )
            page_len = len(page_markdown) + 2
            if current_parts and current_pages and (page_no - current_pages[0]) >= DEFAULT_VIRTUAL_PAGE_GROUP_SIZE:
                flush()
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
    def _page_markdown(page_no: int, page_text: str, assets: List[DocumentAsset], skipped_solid_images: Optional[list[dict[str, Any]]] = None) -> str:
        parts = [f"## 第 {page_no} 页", "", page_text.strip()]
        snapshot_assets = [asset for asset in assets if asset.asset_type == DocumentAssetType.PAGE_SNAPSHOT.value]
        embedded_assets = [asset for asset in assets if asset.asset_type == DocumentAssetType.EMBEDDED_IMAGE.value]
        if snapshot_assets:
            parts.extend(["", "### Page Snapshot"])
            for asset in snapshot_assets:
                parts.append(f"![{asset.title}]({asset.path})")
        if embedded_assets:
            parts.extend(["", "### Embedded Images"])
            for asset in embedded_assets:
                parts.append(f"![{asset.title}]({asset.path})")
        if skipped_solid_images:
            parts.extend(["", "### Filtered Images"])
            for image in skipped_solid_images:
                image_index = image.get("image_index")
                width = image.get("width") or "unknown"
                height = image.get("height") or "unknown"
                label = f"image {image_index}" if image_index else "image"
                parts.append(f"- Filtered solid/blank {label} ({width}x{height}); no asset was generated.")
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
