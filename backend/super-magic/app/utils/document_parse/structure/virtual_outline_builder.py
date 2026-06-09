"""Fallback outline builders when native structure is unavailable."""

from __future__ import annotations

from typing import List

from ..constants import DEFAULT_VIRTUAL_PAGE_GROUP_SIZE
from ..models import DocumentNode


class VirtualOutlineBuilder:
    """Create a coarse but navigable outline for large documents."""

    @staticmethod
    def by_units(unit_type: str, total_units: int, group_size: int = DEFAULT_VIRTUAL_PAGE_GROUP_SIZE) -> List[DocumentNode]:
        if total_units <= 0:
            return []
        nodes: List[DocumentNode] = []
        for start in range(1, total_units + 1, group_size):
            end = min(start + group_size - 1, total_units)
            label = f"{unit_type} {start}" if start == end else f"{unit_type} {start}-{end}"
            nodes.append(DocumentNode(
                node_id=f"virtual_{len(nodes) + 1}",
                title=label,
                level=1,
                source_range=f"{start}-{end}",
            ))
        return nodes

    @staticmethod
    def by_names(unit_type: str, names: list[str]) -> List[DocumentNode]:
        return [
            DocumentNode(
                node_id=f"virtual_{index + 1}",
                title=name or f"{unit_type} {index + 1}",
                level=1,
                source_range=str(index + 1),
            )
            for index, name in enumerate(names)
        ]
