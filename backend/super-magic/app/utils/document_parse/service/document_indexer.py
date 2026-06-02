"""Build document index and outline files."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_exists, async_read_json, async_read_text
from ..constants import INDEX_FILENAME
from ..drivers import get_document_driver_registry
from ..models import DocumentAsset, DocumentChunk, DocumentNode, DocumentStructure, ExtractionResult, stable_document_id
from ..output.index_writer import IndexWriter
from ..output.outline_writer import OutlineWriter


class DocumentIndexer:
    async def build_from_extraction(self, path: Path, output_dir: Path, extraction: ExtractionResult) -> DocumentStructure:
        driver = get_document_driver_registry().get_driver(path)
        profile = await driver.inspect(path)
        structure = extraction.to_structure(
            file_type=profile.file_type,
            title=profile.title,
            unit_type=profile.unit_type,
        )
        existing = await self._read_mergeable_existing(output_dir, structure)
        if existing:
            structure = await self._merge_structures(output_dir, existing, structure)
        await IndexWriter.write(output_dir, structure)
        await OutlineWriter.write(output_dir, structure)
        return structure

    async def read(self, index_path: Path) -> DocumentStructure:
        data = await async_read_json(index_path)
        return self._structure_from_dict(data)

    async def build_empty(self, path: Path, output_dir: Path) -> DocumentStructure:
        driver = get_document_driver_registry().get_driver(path)
        profile = await driver.inspect(path)
        structure = DocumentStructure(
            document_id=stable_document_id(path),
            source_path=str(path),
            file_type=profile.file_type,
            title=profile.title,
            unit_type=profile.unit_type,
            total_units=profile.total_units,
            nodes=profile.outline,
            metadata=profile.metadata,
        )
        await IndexWriter.write(output_dir, structure)
        await OutlineWriter.write(output_dir, structure)
        return structure

    @staticmethod
    def default_index_path(output_dir: Path) -> Path:
        return output_dir / INDEX_FILENAME

    async def _read_mergeable_existing(self, output_dir: Path, structure: DocumentStructure) -> DocumentStructure | None:
        index_path = self.default_index_path(output_dir)
        if not await async_exists(index_path):
            return None
        data = await async_read_json(index_path)
        if str(data.get("source_path") or "") != structure.source_path and str(data.get("document_id") or "") != structure.document_id:
            return None
        return self._structure_from_dict(data)

    async def _merge_structures(
        self,
        output_dir: Path,
        existing: DocumentStructure,
        current: DocumentStructure,
    ) -> DocumentStructure:
        chunks = await self._merge_chunks(output_dir, existing.chunks, current.chunks)
        assets = self._merge_assets(existing.assets, current.assets)
        nodes = self._merge_nodes(existing.nodes, current.nodes)
        return DocumentStructure(
            document_id=current.document_id,
            source_path=current.source_path,
            file_type=current.file_type,
            title=current.title,
            unit_type=current.unit_type,
            total_units=max(existing.total_units or 0, current.total_units or 0),
            nodes=nodes,
            chunks=chunks,
            assets=assets,
            metadata={
                **existing.metadata,
                **current.metadata,
                "merged_extractions": True,
            },
        )

    @staticmethod
    async def _merge_chunks(output_dir: Path, existing: list[DocumentChunk], current: list[DocumentChunk]) -> list[DocumentChunk]:
        chunks: list[DocumentChunk] = []
        seen: set[str] = set()
        for chunk in [*existing, *current]:
            if chunk.chunk_id in seen:
                continue
            if chunk.path:
                chunk_path = output_dir / chunk.path
                if await async_exists(chunk_path):
                    chunk.content = await async_read_text(chunk_path, errors="ignore")
            chunks.append(chunk)
            seen.add(chunk.chunk_id)
        for index, chunk in enumerate(chunks):
            chunk.previous_chunk_id = chunks[index - 1].chunk_id if index > 0 else None
            chunk.next_chunk_id = chunks[index + 1].chunk_id if index + 1 < len(chunks) else None
        return chunks

    @staticmethod
    def _merge_assets(existing: list[DocumentAsset], current: list[DocumentAsset]) -> list[DocumentAsset]:
        by_path: dict[str, DocumentAsset] = {}
        for asset in existing:
            by_path[asset.path] = asset
        for asset in current:
            previous = by_path.get(asset.path)
            if previous:
                previous.metadata = {**asset.metadata, **previous.metadata}
                previous.source_range = previous.source_range or asset.source_range
                previous.title = previous.title or asset.title
                previous.asset_type = previous.asset_type or asset.asset_type
            else:
                by_path[asset.path] = asset
        assets = list(by_path.values())
        for index, asset in enumerate(assets, start=1):
            asset.asset_id = f"asset_{index:04d}"
        return assets

    @staticmethod
    def _merge_nodes(existing: list[DocumentNode], current: list[DocumentNode]) -> list[DocumentNode]:
        by_key: dict[str, DocumentNode] = {}
        ordered_keys: list[str] = []

        def key_for(node: DocumentNode) -> str:
            return node.node_id or f"{node.level}:{node.source_range}:{node.title}"

        def add_node(node: DocumentNode) -> None:
            key = key_for(node)
            if key not in by_key:
                by_key[key] = node
                ordered_keys.append(key)
                return
            target = by_key[key]
            target.chunk_ids = list(dict.fromkeys([*target.chunk_ids, *node.chunk_ids]))
            target.summary = target.summary or node.summary
            target.metadata = {**node.metadata, **target.metadata}
            target.children = DocumentIndexer._merge_nodes(target.children, node.children)

        for node in [*existing, *current]:
            add_node(node)
        return [by_key[key] for key in ordered_keys]

    @staticmethod
    def _structure_from_dict(data: dict) -> DocumentStructure:
        return DocumentStructure(
            document_id=str(data.get("document_id") or ""),
            source_path=str(data.get("source_path") or ""),
            file_type=str(data.get("file_type") or ""),
            title=str(data.get("title") or ""),
            unit_type=str(data.get("unit_type") or ""),
            total_units=int(data.get("total_units") or 0),
            nodes=[DocumentIndexer._node_from_dict(item) for item in data.get("nodes") or []],
            chunks=[DocumentIndexer._chunk_from_dict(item) for item in data.get("chunks") or []],
            assets=[DocumentIndexer._asset_from_dict(item) for item in data.get("assets") or []],
            metadata=dict(data.get("metadata") or {}),
        )

    @staticmethod
    def _node_from_dict(data: dict) -> DocumentNode:
        return DocumentNode(
            node_id=str(data.get("node_id") or ""),
            title=str(data.get("title") or ""),
            level=int(data.get("level") or 1),
            source_range=str(data.get("source_range") or ""),
            summary=str(data.get("summary") or ""),
            chunk_ids=[str(item) for item in data.get("chunk_ids") or []],
            children=[DocumentIndexer._node_from_dict(item) for item in data.get("children") or []],
            metadata=dict(data.get("metadata") or {}),
        )

    @staticmethod
    def _chunk_from_dict(data: dict) -> DocumentChunk:
        return DocumentChunk(
            chunk_id=str(data.get("chunk_id") or ""),
            title=str(data.get("title") or ""),
            content=str(data.get("content") or ""),
            source_range=str(data.get("source_range") or ""),
            path=str(data.get("path") or ""),
            parent_node_id=data.get("parent_node_id"),
            previous_chunk_id=data.get("previous_chunk_id"),
            next_chunk_id=data.get("next_chunk_id"),
            metadata=dict(data.get("metadata") or {}),
        )

    @staticmethod
    def _asset_from_dict(data: dict) -> DocumentAsset:
        return DocumentAsset(
            asset_id=str(data.get("asset_id") or ""),
            asset_type=str(data.get("asset_type") or ""),
            path=str(data.get("path") or ""),
            title=str(data.get("title") or ""),
            source_range=data.get("source_range"),
            metadata=dict(data.get("metadata") or {}),
        )
