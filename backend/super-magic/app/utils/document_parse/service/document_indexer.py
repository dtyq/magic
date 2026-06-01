"""Build document index and outline files."""

from __future__ import annotations

from pathlib import Path

from app.utils.async_file_utils import async_read_json
from ..constants import INDEX_FILENAME
from ..drivers import get_document_driver_registry
from ..models import DocumentStructure, ExtractionResult, stable_document_id
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
        await IndexWriter.write(output_dir, structure)
        await OutlineWriter.write(output_dir, structure)
        return structure

    async def read(self, index_path: Path) -> DocumentStructure:
        data = await async_read_json(index_path)
        return DocumentStructure(**data)

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
