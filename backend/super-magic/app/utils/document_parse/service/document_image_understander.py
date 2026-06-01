"""Understand document image assets and write results back into chunks.

Internal responsibility:
- Runs bounded visual understanding for images that already belong to a document output directory.
- Persists each recognition result under visual-results/.
- Updates chunk Markdown and document.index.json so future reads can reuse the result.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.utils.async_file_utils import async_exists, async_mkdir, async_read_text, async_write_json, async_write_text

from ..constants import INDEX_FILENAME, VISUAL_RESULTS_DIRNAME
from ..structure.range_parser import RangeParser
from .reading_state import ReadingStateStore


class DocumentImageUnderstander:
    """Run visual understanding for selected document assets."""

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
        concurrency: int = 5,
        force: bool = False,
    ) -> dict[str, Any]:
        if max_images > 10:
            raise ValueError("understand_document_images supports at most 10 images per call.")
        index_path = output_dir / INDEX_FILENAME
        if not await async_exists(index_path):
            raise FileNotFoundError(f"document.index.json does not exist: {index_path}")
        import json

        index = json.loads(await async_read_text(index_path))
        assets = self._select_assets(index, output_dir, images or [], ranges, chunk_ids, force)
        assets = assets[:max(1, max_images)]
        if not assets:
            return {
                "processed": [],
                "skipped": [],
                "index_path": str(index_path),
                "message": "No matching document image assets need visual understanding.",
            }

        semaphore = asyncio.Semaphore(max(1, min(concurrency, 10)))

        async def run(asset: dict[str, Any]) -> dict[str, Any]:
            async with semaphore:
                return await self._understand_asset(output_dir, asset, query)

        results = await asyncio.gather(*(run(asset) for asset in assets))
        await self._write_back(output_dir, index, results, write_mode)
        await async_write_json(index_path, index, ensure_ascii=False, indent=2)
        state_store = ReadingStateStore()
        await state_store.initialize(
            output_dir,
            source_path=str(index.get("source_path") or ""),
            total_units=int(index.get("total_units") or 0),
            unit_type=str(index.get("unit_type") or ""),
            file_type=str(index.get("file_type") or ""),
        )
        state = await state_store.mark_images_understood(
            output_dir,
            image_paths=[item["asset_path"] for item in results if item.get("ok")],
            result_paths=[item["result_path"] for item in results if item.get("ok")],
            recommendations=["Read the updated chunks before summarizing or planning the next image batch."],
        )
        return {
            "processed": results,
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
            assets = [asset for asset in assets if not ((asset.get("metadata") or {}).get("visual_understanding") or {}).get("result_path")]
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
    async def _write_back(output_dir: Path, index: dict[str, Any], results: list[dict[str, Any]], write_mode: str) -> None:
        by_asset_path = {item["asset_path"]: item for item in results}
        now = datetime.now(timezone.utc).isoformat()
        for asset in index.get("assets", []):
            result = by_asset_path.get(asset.get("path"))
            if not result:
                continue
            metadata = asset.setdefault("metadata", {})
            metadata["visual_understanding"] = {
                "status": "completed" if result["ok"] else "failed",
                "result_path": result["result_path"],
                "updated_at": now,
                **({"error": result["error"]} if result.get("error") else {}),
            }

        if write_mode != "append_after_image":
            return

        for chunk in index.get("chunks", []):
            chunk_path = output_dir / str(chunk.get("path") or "")
            if not chunk.get("path") or not await async_exists(chunk_path):
                continue
            content = await async_read_text(chunk_path)
            updated = content
            for asset_path, result in by_asset_path.items():
                if asset_path not in updated:
                    continue
                marker = f"<!-- document-converter-visual:{asset_path} -->"
                if marker in updated:
                    continue
                block = DocumentImageUnderstander._chunk_visual_block(marker, result)
                image_line_pattern = re.compile(rf"^.*!\[[^\]]*]\({re.escape(asset_path)}\).*$", re.MULTILINE)
                match = image_line_pattern.search(updated)
                if match:
                    updated = updated[:match.end()] + "\n\n" + block + updated[match.end():]
                else:
                    updated = updated.rstrip() + "\n\n" + block + "\n"
            if updated != content:
                await async_write_text(chunk_path, updated)
                chunk["content"] = updated
                chunk.setdefault("metadata", {})["visual_understanding_updated_at"] = now

    @staticmethod
    def _chunk_visual_block(marker: str, result: dict[str, Any]) -> str:
        if result["ok"]:
            return "\n".join([
                marker,
                "#### Visual Understanding",
                "",
                result["content"],
                "",
                f"[Saved result]({result['result_path']})",
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
