"""Write model-readable document outlines.

The outline includes chunk file paths beside chunk ids so Code Mode can read the
right files directly without inferring filenames from titles.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List

from app.utils.async_file_utils import async_write_text
from ..constants import OUTLINE_FILENAME
from ..models import DocumentChunk, DocumentNode, DocumentStructure


def _render_nodes(nodes: Iterable[DocumentNode], lines: List[str], chunk_paths: Dict[str, str]) -> None:
    for node in nodes:
        indent = "  " * max(node.level - 1, 0)
        summary = f" - {node.summary}" if node.summary else ""
        range_text = f" [{node.source_range}]" if node.source_range else ""
        chunk_refs = [f"{chunk_id} (`{chunk_paths.get(chunk_id, '')}`)" for chunk_id in node.chunk_ids]
        chunk_text = f" chunks: {', '.join(chunk_refs)}" if chunk_refs else ""
        lines.append(f"{indent}- {node.title}{range_text}{summary}{chunk_text}".rstrip())
        _render_nodes(node.children, lines, chunk_paths)


def _chunk_path_map(chunks: Iterable[DocumentChunk]) -> Dict[str, str]:
    return {chunk.chunk_id: chunk.path for chunk in chunks}


class OutlineWriter:
    @staticmethod
    async def write(output_dir: Path, structure: DocumentStructure) -> Path:
        path = output_dir / OUTLINE_FILENAME
        chunk_paths = _chunk_path_map(structure.chunks)
        lines = [
            f"# {structure.title or Path(structure.source_path).name}",
            "",
            f"- Source: `{structure.source_path}`",
            f"- Type: `{structure.file_type}`",
            f"- Units: `{structure.total_units}` `{structure.unit_type}`",
            "",
            "## Outline",
        ]
        if structure.nodes:
            _render_nodes(structure.nodes, lines, chunk_paths)
        else:
            lines.append("- No outline detected")
        if structure.chunks:
            lines.extend(["", "## Chunks"])
            for chunk in structure.chunks:
                lines.append(f"- `{chunk.chunk_id}` `{chunk.path}`: {chunk.title} [{chunk.source_range}]")
        await async_write_text(path, "\n".join(lines).rstrip() + "\n")
        return path
