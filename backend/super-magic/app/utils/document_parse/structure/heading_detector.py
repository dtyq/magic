"""Simple heading detection for text-like documents."""

from __future__ import annotations

import re
from typing import List

from ..models import DocumentNode


class HeadingDetector:
    """Detect markdown and common numbered headings."""

    _numbered_heading = re.compile(r"^\s*((第[一二三四五六七八九十百千]+[章节篇])|(\d+(\.\d+)*[、.．]\s+)).{1,80}$")

    @classmethod
    def detect(cls, text: str, max_headings: int = 200) -> List[DocumentNode]:
        nodes: List[DocumentNode] = []
        for line_no, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                marker = stripped.split(" ", 1)[0]
                if set(marker) == {"#"}:
                    title = stripped[len(marker):].strip() or stripped
                    nodes.append(DocumentNode(
                        node_id=f"heading_{len(nodes) + 1}",
                        title=title[:120],
                        level=min(len(marker), 6),
                        source_range=f"line:{line_no}",
                    ))
            elif cls._numbered_heading.match(stripped):
                nodes.append(DocumentNode(
                    node_id=f"heading_{len(nodes) + 1}",
                    title=stripped[:120],
                    level=1,
                    source_range=f"line:{line_no}",
                ))
            if len(nodes) >= max_headings:
                break
        return nodes
