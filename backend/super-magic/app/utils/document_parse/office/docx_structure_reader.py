"""DOCX heading reader."""

from __future__ import annotations

from pathlib import Path
from typing import List

from ..models import DocumentNode


class DocxStructureReader:
    @staticmethod
    def read_headings(path: Path) -> List[DocumentNode]:
        try:
            from docx import Document
        except Exception:
            return []

        nodes: List[DocumentNode] = []
        doc = Document(str(path))
        for para_index, paragraph in enumerate(doc.paragraphs, start=1):
            style_name = getattr(paragraph.style, "name", "") or ""
            if style_name.lower().startswith("heading") and paragraph.text.strip():
                level = 1
                for token in style_name.split():
                    if token.isdigit():
                        level = int(token)
                        break
                nodes.append(DocumentNode(
                    node_id=f"docx_heading_{len(nodes) + 1}",
                    title=paragraph.text.strip()[:120],
                    level=level,
                    source_range=f"paragraph:{para_index}",
                ))
        return nodes
