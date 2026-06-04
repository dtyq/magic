"""Outline normalization helpers."""

from __future__ import annotations

from typing import Iterable, List

from ..models import DocumentNode


class OutlineBuilder:
    """Normalize flat heading nodes into a tree."""

    @staticmethod
    def build_tree(nodes: Iterable[DocumentNode]) -> List[DocumentNode]:
        roots: List[DocumentNode] = []
        stack: List[DocumentNode] = []
        for node in nodes:
            node.children = node.children or []
            while stack and stack[-1].level >= node.level:
                stack.pop()
            if stack:
                stack[-1].children.append(node)
            else:
                roots.append(node)
            stack.append(node)
        return roots
