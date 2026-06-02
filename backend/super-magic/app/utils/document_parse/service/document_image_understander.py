"""Understand document image assets and write results back into chunks.

Internal responsibility:
- Runs staggered bounded visual understanding for images that already belong to a document output directory.
- Preserves visual-results/ as a per-image recognition record after chunk write-back.
- Updates chunk Markdown and document.index.json as each image result becomes available.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.utils.async_file_utils import async_exists, async_mkdir, async_read_text, async_write_json, async_write_text

from ..constants import (
    DEFAULT_IMAGE_UNDERSTANDING_CONCURRENCY,
    DEFAULT_IMAGE_UNDERSTANDING_STAGGER_SECONDS,
    INDEX_FILENAME,
    VISUAL_RESULTS_DIRNAME,
)
from ..structure.range_parser import RangeParser
from .reading_state import ReadingStateStore


class DocumentImageUnderstander:
    """Run visual understanding for selected document assets."""

    WRITE_MODE_APPEND = "append_after_image"
    WRITE_MODE_METADATA_ONLY = "metadata_only"
    WRITE_MODE_ALIASES = {
        "append_after_image": WRITE_MODE_APPEND,
        "write_back": WRITE_MODE_APPEND,
        "metadata_only": WRITE_MODE_METADATA_ONLY,
        "index_only": WRITE_MODE_METADATA_ONLY,
    }

    async def understand(
        self,
        output_dir: Path,
        *,
        images: list[Path] | None = None,
        ranges: str | None = None,
        chunk_ids: list[str] | None = None,
        query: str | None = None,
        write_mode: str = "append_after_image",
        max_images: int = 10,
        force: bool = False,
    ) -> dict[str, Any]:
        if max_images > 10:
            raise ValueError("understand_document_images supports at most 10 images per call.")
        normalized_write_mode = self._normalize_write_mode(write_mode)
        index_path = output_dir / INDEX_FILENAME
        if not await async_exists(index_path):
            raise FileNotFoundError(f"document.index.json does not exist: {index_path}")
        import json

        index = json.loads(await async_read_text(index_path))
        assets = self._select_assets(
            index,
            output_dir,
            images or [],
            ranges,
            chunk_ids,
            force,
        )
        assets = assets[:max(1, max_images)]
        if not assets:
            return {
                "processed": [],
                "skipped": [],
                "index_path": str(index_path),
                "message": "No matching document image assets need visual understanding.",
            }

        semaphore = asyncio.Semaphore(max(1, min(DEFAULT_IMAGE_UNDERSTANDING_CONCURRENCY, 10)))
        chunk_locks: dict[str, asyncio.Lock] = {}
        index_lock = asyncio.Lock()
        state_lock = asyncio.Lock()
        processed: list[dict[str, Any]] = []
        state_store = ReadingStateStore()
        await state_store.initialize(
            output_dir,
            source_path=str(index.get("source_path") or ""),
            total_units=int(index.get("total_units") or 0),
            unit_type=str(index.get("unit_type") or ""),
            file_type=str(index.get("file_type") or ""),
        )

        async def run(position: int, asset: dict[str, Any]) -> dict[str, Any]:
            if position > 0 and DEFAULT_IMAGE_UNDERSTANDING_STAGGER_SECONDS > 0:
                await asyncio.sleep(position * DEFAULT_IMAGE_UNDERSTANDING_STAGGER_SECONDS)
            async with semaphore:
                result = await self._understand_or_reuse_asset(output_dir, asset, query, force=force)
            if normalized_write_mode == self.WRITE_MODE_APPEND:
                await self._write_one_back(output_dir, index_path, index, result, chunk_locks, index_lock)
            else:
                await self._write_index_metadata(index_path, index, result, index_lock, written_to_chunk=False)
            if result.get("ok"):
                async with state_lock:
                    await state_store.mark_images_understood(
                        output_dir,
                        image_paths=[result["asset_path"]],
                        result_paths=[result.get("result_path") or ""],
                        recommendations=["Read the updated chunks before summarizing or planning the next image batch."],
                    )
            return result

        tasks = [asyncio.create_task(run(position, asset)) for position, asset in enumerate(assets)]
        for task in asyncio.as_completed(tasks):
            processed.append(await task)
        state = await state_store.load(output_dir)
        return {
            "processed": processed,
            "skipped": [],
            "index_path": str(index_path),
            "state": state,
        }

    @staticmethod
    def _select_assets(
        index: dict[str, Any],
        output_dir: Path,
        images: list[Path],
        ranges: str | None,
        chunk_ids: list[str] | None,
        force: bool,
    ) -> list[dict[str, Any]]:
        assets = [asset for asset in index.get("assets", []) if asset.get("asset_type") == "image" and asset.get("path")]
        if not force:
            assets = [asset for asset in assets if not DocumentImageUnderstander._asset_written_to_chunk(asset)]
        if images:
            requested = {str(path.resolve()) for path in images}
            assets = [asset for asset in assets if str((output_dir / asset["path"]).resolve()) in requested]
        if ranges:
            total = int(index.get("total_units") or 0)
            selected_units = set(RangeParser.parse_numeric(ranges, total)) if total else set()
            assets = [asset for asset in assets if DocumentImageUnderstander._asset_unit(asset) in selected_units]
        if chunk_ids:
            chunk_id_set = set(chunk_ids)
            chunk_ranges = [
                chunk.get("source_range", "")
                for chunk in index.get("chunks", [])
                if chunk.get("chunk_id") in chunk_id_set
            ]
            assets = [asset for asset in assets if DocumentImageUnderstander._asset_in_chunk_ranges(asset, chunk_ranges, int(index.get("total_units") or 0))]
        return assets

    @staticmethod
    def _asset_written_to_chunk(asset: dict[str, Any]) -> bool:
        visual = (asset.get("metadata") or {}).get("visual_understanding") or {}
        return visual.get("status") == "completed" and bool(visual.get("written_to_chunk"))

    @staticmethod
    def _asset_unit(asset: dict[str, Any]) -> int | None:
        metadata = asset.get("metadata") or {}
        page = metadata.get("page") or metadata.get("slide")
        if isinstance(page, int):
            return page
        source_range = str(asset.get("source_range") or "")
        match = re.search(r"(\d+)", source_range)
        return int(match.group(1)) if match else None

    @staticmethod
    def _asset_in_chunk_ranges(asset: dict[str, Any], chunk_ranges: list[str], total_units: int) -> bool:
        unit = DocumentImageUnderstander._asset_unit(asset)
        if unit is None:
            return False
        for source_range in chunk_ranges:
            normalized = str(source_range).removeprefix("pages:").removeprefix("slides:")
            if unit in RangeParser.parse_numeric(normalized, total_units):
                return True
        return False

    @classmethod
    def _normalize_write_mode(cls, write_mode: str) -> str:
        normalized = (write_mode or cls.WRITE_MODE_APPEND).strip().lower()
        if normalized not in cls.WRITE_MODE_ALIASES:
            raise ValueError("Unsupported write_mode. Use append_after_image, write_back, or metadata_only.")
        return cls.WRITE_MODE_ALIASES[normalized]

    @staticmethod
    async def _understand_or_reuse_asset(output_dir: Path, asset: dict[str, Any], query: str | None, *, force: bool) -> dict[str, Any]:
        visual_metadata = (asset.get("metadata") or {}).get("visual_understanding") or {}
        existing_result_path = visual_metadata.get("result_path")
        if existing_result_path and not force:
            stored_result_path = output_dir / str(existing_result_path)
            if await async_exists(stored_result_path):
                stored_content = await async_read_text(stored_result_path)
                return {
                    "ok": visual_metadata.get("status") != "failed",
                    "asset_path": asset["path"],
                    "asset_title": asset.get("title") or "",
                    "source_range": asset.get("source_range") or "",
                    "result_path": str(existing_result_path),
                    "content": DocumentImageUnderstander._stored_result_body(stored_content),
                    "error": visual_metadata.get("error") or "",
                    "reused": True,
                }
        return await DocumentImageUnderstander._understand_asset(output_dir, asset, query)

    @staticmethod
    async def _understand_asset(output_dir: Path, asset: dict[str, Any], query: str | None) -> dict[str, Any]:
        from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

        asset_path = output_dir / asset["path"]
        visual_dir = output_dir / VISUAL_RESULTS_DIRNAME
        await async_mkdir(visual_dir, parents=True, exist_ok=True)
        prompt = query or (
            "Convert this document image into structured Markdown. Preserve visible text, headings, "
            "tables, stamps, signatures, charts, and layout cues that are important for later document reading."
        )
        result = await VisualUnderstanding().execute_purely(
            VisualUnderstandingParams(images=[str(asset_path)], query=prompt),
            include_download_info_in_content=False,
            include_dimensions_info_in_content=False,
        )
        file_stem = DocumentImageUnderstander._safe_result_stem(asset.get("path") or asset_path.name)
        result_path = visual_dir / f"{file_stem}.md"
        if result.ok:
            content = "\n".join([
                f"# Visual Understanding: {asset.get('title') or asset_path.name}",
                "",
                f"- Image: `{asset.get('path')}`",
                f"- Source range: `{asset.get('source_range') or ''}`",
                "",
                result.content.strip(),
                "",
            ])
        else:
            content = "\n".join([
                f"# Visual Understanding Failed: {asset.get('title') or asset_path.name}",
                "",
                f"- Image: `{asset.get('path')}`",
                f"- Error: {result.content}",
                "",
            ])
        await async_write_text(result_path, content)
        return {
            "ok": bool(result.ok),
            "asset_path": asset["path"],
            "asset_title": asset.get("title") or "",
            "source_range": asset.get("source_range") or "",
            "result_path": str(result_path.relative_to(output_dir)),
            "content": result.content.strip() if result.ok else "",
            "error": "" if result.ok else result.content,
        }

    @staticmethod
    async def _write_one_back(
        output_dir: Path,
        index_path: Path,
        index: dict[str, Any],
        result: dict[str, Any],
        chunk_locks: dict[str, asyncio.Lock],
        index_lock: asyncio.Lock,
    ) -> None:
        written_to_chunk = False
        written_chunk_path = ""
        if result.get("ok"):
            for chunk in index.get("chunks", []):
                chunk_path_text = str(chunk.get("path") or "")
                if not chunk_path_text:
                    continue
                chunk_path = output_dir / chunk_path_text
                if not await async_exists(chunk_path):
                    continue
                lock = chunk_locks.setdefault(chunk_path_text, asyncio.Lock())
                async with lock:
                    content = await async_read_text(chunk_path)
                    marker = f"<!-- document-converter-visual:{result['asset_path']} -->"
                    if marker in content:
                        written_to_chunk = True
                        written_chunk_path = chunk_path_text
                        continue
                    if result["asset_path"] not in content:
                        continue
                    block = DocumentImageUnderstander._chunk_visual_block(marker, result)
                    image_line_pattern = re.compile(rf"^.*!\[[^\]]*]\({re.escape(result['asset_path'])}\).*$", re.MULTILINE)
                    match = image_line_pattern.search(content)
                    if match:
                        updated = content[:match.end()] + "\n\n" + block + content[match.end():]
                    else:
                        updated = content.rstrip() + "\n\n" + block + "\n"
                    await async_write_text(chunk_path, updated)
                    chunk["content"] = updated
                    chunk.setdefault("metadata", {})["visual_understanding_updated_at"] = datetime.now(timezone.utc).isoformat()
                    written_to_chunk = True
                    written_chunk_path = chunk_path_text

        await DocumentImageUnderstander._write_index_metadata(
            index_path,
            index,
            result,
            index_lock,
            written_to_chunk=written_to_chunk,
            chunk_path=written_chunk_path,
        )

    @staticmethod
    async def _write_index_metadata(
        index_path: Path,
        index: dict[str, Any],
        result: dict[str, Any],
        index_lock: asyncio.Lock,
        *,
        written_to_chunk: bool,
        chunk_path: str = "",
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        async with index_lock:
            for asset in index.get("assets", []):
                if asset.get("path") != result.get("asset_path"):
                    continue
                metadata = asset.setdefault("metadata", {})
                visual_metadata = {
                    "status": "completed" if result.get("ok") else "failed",
                    "written_to_chunk": bool(written_to_chunk),
                    "chunk_path": chunk_path,
                    "asset_path": result.get("asset_path") or "",
                    "updated_at": now,
                    **({"error": result["error"]} if result.get("error") else {}),
                }
                if result.get("result_path"):
                    visual_metadata["result_path"] = result["result_path"]
                metadata["visual_understanding"] = visual_metadata
                break
            await async_write_json(index_path, index, ensure_ascii=False, indent=2)

    @staticmethod
    def _chunk_visual_block(marker: str, result: dict[str, Any]) -> str:
        if result["ok"]:
            return "\n".join([
                marker,
                "#### Visual Understanding",
                "",
                result["content"],
                "",
            ]).strip()
        return "\n".join([
            marker,
            "#### Visual Understanding",
            "",
            f"Visual understanding failed. See `{result['result_path']}`.",
        ]).strip()

    @staticmethod
    def _safe_result_stem(asset_path: str) -> str:
        stem = Path(asset_path).stem
        return re.sub(r"[^A-Za-z0-9._-]+", "_", stem).strip("._") or "image"

    @staticmethod
    def _stored_result_body(content: str) -> str:
        lines = content.strip().splitlines()
        if lines and lines[0].startswith("# Visual Understanding"):
            for index, line in enumerate(lines[1:], start=1):
                if line.strip() == "":
                    continue
                if line.startswith("- "):
                    continue
                return "\n".join(lines[index:]).strip()
        return content.strip()
