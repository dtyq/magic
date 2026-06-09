"""Image structured parsing driver.

Images should not fail the document-converter pipeline just because a visual
LLM is unavailable. The driver always emits image metadata and stores the image
as an asset; richer visual text can be added later by an explicit visual path.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.utils.async_file_utils import async_copy2, async_read_bytes, async_stat

from ..constants import IMAGE_EXTENSIONS
from ..models import DocumentAsset, DocumentChunk, DocumentNode, DocumentProfile, ExtractionResult, stable_document_id
from ..structure.asset_store import AssetStore
from ..structure.chunk_store import ChunkStore
from ..structure.image_feature_analyzer import ImageFeatureAnalyzer
from ..structure.image_watermark_detector import ImageWatermarkDetector
from .base import DocumentDriver


class ImageDocumentDriver(DocumentDriver):
    file_type = "image"
    unit_type = "image"
    supported_extensions = IMAGE_EXTENSIONS

    async def inspect(self, path: Path) -> DocumentProfile:
        file_stat = await async_stat(path)
        metadata = await asyncio.to_thread(self._read_image_metadata, path)
        node = DocumentNode(
            node_id="image_1",
            title=path.name,
            level=1,
            source_range="image:1",
            metadata=metadata,
        )
        return DocumentProfile(
            source_path=str(path),
            file_name=path.name,
            file_type=self.file_type,
            file_extension=path.suffix.lower(),
            file_size=file_stat.st_size,
            unit_type=self.unit_type,
            total_units=1,
            title=path.name,
            outline=[node],
            samples=[{"range": "image:1", "metadata": metadata}],
            recommended_strategy="use image metadata by default; use visual mode only when semantic image understanding is required",
            metadata=metadata,
        )

    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: str | None = None,
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        metadata = await asyncio.to_thread(self._read_image_metadata, path)
        image_bytes = await async_read_bytes(path)
        features = ImageFeatureAnalyzer.analyze_bytes(image_bytes)
        image_record = {
            "path": str(path),
            "original_name": path.name,
            "name": path.name,
            "width": features.get("width"),
            "height": features.get("height"),
            "source_range": "image:1",
            "features": features,
        }
        kept_images, skipped_images = ImageWatermarkDetector.split_images([image_record])
        assets: list[DocumentAsset] = []
        asset: DocumentAsset | None = None
        if kept_images:
            assets_dir = await AssetStore.ensure(output_dir)
            asset_path = assets_dir / path.name
            await async_copy2(path, asset_path)
            asset = DocumentAsset(
                asset_id="asset_0001",
                asset_type="image",
                path=str(asset_path.relative_to(output_dir)),
                title=path.name,
                source_range="image:1",
                metadata={**metadata, "features": features},
            )
            assets.append(asset)
        content = self._metadata_markdown(path, asset, metadata, skipped_images)
        chunk = DocumentChunk(
            chunk_id="chunk_0001",
            title=path.name,
            content=content,
            source_range="image:1",
            parent_node_id="image_1",
            metadata={"asset_ids": [item.asset_id for item in assets], "skipped_images": skipped_images, **metadata},
        )
        chunks = await ChunkStore.write_chunks(output_dir, [chunk])
        node = DocumentNode(
            node_id="image_1",
            title=path.name,
            level=1,
            source_range="image:1",
            chunk_ids=[chunk.chunk_id for chunk in chunks],
            metadata=metadata,
        )
        return ExtractionResult(
            document_id=stable_document_id(path),
            source_path=str(path),
            output_dir=str(output_dir),
            chunks=chunks,
            assets=assets,
            nodes=[node],
            pages_processed=1,
            total_units=1,
            metadata={"mode": mode, "skipped_images": skipped_images, **metadata},
        )

    @staticmethod
    def _read_image_metadata(path: Path) -> dict:
        from PIL import Image

        with Image.open(path) as image:
            return {
                "format": image.format or path.suffix.lstrip(".").upper(),
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
            }

    @staticmethod
    def _metadata_markdown(path: Path, asset: DocumentAsset | None, metadata: dict, skipped_images: list[dict] | None = None) -> str:
        lines = [
            f"# {path.name}",
            "",
            "Image metadata extraction completed.",
            "",
            f"- Format: `{metadata.get('format', '')}`",
            f"- Size: `{metadata.get('width', '')}x{metadata.get('height', '')}`",
            f"- Color mode: `{metadata.get('mode', '')}`",
            "",
            "Semantic image description is not generated in the default metadata path.",
        ]
        if asset:
            lines[4:4] = [
                f"![{path.name}]({asset.path})",
                "",
                f"- Asset: `{asset.path}`",
            ]
        elif skipped_images:
            lines[4:4] = [
                (
                    "- Filtered solid/blank image; no asset was generated."
                    if skipped_images[0].get("reason") == "invalid solid or blank image"
                    else f"- Asset: not generated ({skipped_images[0].get('reason', 'skipped image')})"
                ),
            ]
        return "\n".join(lines)
