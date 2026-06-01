"""Structured document parsing domain models."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class DocumentRange:
    """A normalized range within a document."""

    kind: str
    values: List[str] = field(default_factory=list)
    raw: Optional[str] = None


@dataclass
class DocumentAsset:
    """A non-text resource extracted from a document."""

    asset_id: str
    asset_type: str
    path: str
    title: str = ""
    source_range: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentChunk:
    """A readable markdown chunk with source metadata."""

    chunk_id: str
    title: str
    content: str
    source_range: str
    path: str = ""
    parent_node_id: Optional[str] = None
    previous_chunk_id: Optional[str] = None
    next_chunk_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentNode:
    """A node in the document outline tree."""

    node_id: str
    title: str
    level: int = 1
    source_range: str = ""
    summary: str = ""
    chunk_ids: List[str] = field(default_factory=list)
    children: List["DocumentNode"] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentProfile:
    """Low-cost document inspection result."""

    source_path: str
    file_name: str
    file_type: str
    file_extension: str
    file_size: int
    unit_type: str
    total_units: int = 0
    title: str = ""
    outline: List[DocumentNode] = field(default_factory=list)
    samples: List[Dict[str, Any]] = field(default_factory=list)
    recommended_strategy: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentStructure:
    """Machine-readable document index."""

    document_id: str
    source_path: str
    file_type: str
    title: str
    unit_type: str
    total_units: int = 0
    nodes: List[DocumentNode] = field(default_factory=list)
    chunks: List[DocumentChunk] = field(default_factory=list)
    assets: List[DocumentAsset] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ExtractionResult:
    """Result returned by document content extraction."""

    document_id: str
    source_path: str
    output_dir: str
    chunks: List[DocumentChunk] = field(default_factory=list)
    assets: List[DocumentAsset] = field(default_factory=list)
    nodes: List[DocumentNode] = field(default_factory=list)
    pages_processed: int = 0
    total_units: int = 0
    next_range: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_structure(self, file_type: str, title: str, unit_type: str) -> DocumentStructure:
        return DocumentStructure(
            document_id=self.document_id,
            source_path=self.source_path,
            file_type=file_type,
            title=title,
            unit_type=unit_type,
            total_units=self.total_units,
            nodes=self.nodes,
            chunks=self.chunks,
            assets=self.assets,
            metadata=self.metadata,
        )


def stable_document_id(path: Path) -> str:
    """Return a deterministic document id for a path."""

    import hashlib

    digest = hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:12]
    return f"doc_{digest}"
