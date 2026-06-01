"""Select the output artifact mode for Markdown export.

Internal responsibility:
- Keeps small-file/simple-output policy separate from tool orchestration.
- Returns whether export should create a flat document.md or full progressive artifacts.
"""

from __future__ import annotations

from ..constants import DEFAULT_CHUNK_MAX_CHARS, DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS
from ..models import DocumentProfile


class DocumentArtifactModeSelector:
    """Choose simple or progressive export mode from inspection metadata."""

    VALID_MODES = {"auto", "simple", "progressive"}

    @classmethod
    def resolve(cls, requested_mode: str, profile: DocumentProfile, max_chars: int = DEFAULT_CHUNK_MAX_CHARS) -> str:
        mode = (requested_mode or "auto").strip().lower()
        if mode not in cls.VALID_MODES:
            raise ValueError("Unsupported artifact_mode. Use auto, simple, or progressive.")
        if mode == "simple" and not cls.is_small_document(profile, max_chars=max_chars):
            raise ValueError(cls.simple_mode_not_allowed_message(profile, max_chars=max_chars))
        if mode != "auto":
            return mode
        return "simple" if cls.is_small_document(profile, max_chars=max_chars) else "progressive"

    @staticmethod
    def is_small_document(profile: DocumentProfile, max_chars: int = DEFAULT_CHUNK_MAX_CHARS) -> bool:
        file_type = profile.file_type
        total_units = int(profile.total_units or 0)
        if file_type in {"pdf", "word", "powerpoint", "image"}:
            return 0 < total_units <= DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS
        if file_type in {"text", "markdown", "html"}:
            return profile.file_size <= max_chars * 4
        return False

    @staticmethod
    def simple_mode_not_allowed_message(profile: DocumentProfile, max_chars: int = DEFAULT_CHUNK_MAX_CHARS) -> str:
        unit_type = profile.unit_type or "unit"
        total_units = int(profile.total_units or 0)
        if profile.file_type in {"pdf", "word", "powerpoint", "image"} and total_units:
            return (
                "artifact_mode=simple is only allowed for small documents. "
                f"This document has {total_units} {unit_type}(s), which exceeds the simple-mode limit "
                f"of {DEFAULT_SIMPLE_DOCUMENT_MAX_UNITS}. Use artifact_mode=progressive, or extract a bounded range."
            )
        if profile.file_type in {"text", "markdown", "html"}:
            return (
                "artifact_mode=simple is only allowed for small text-like documents. "
                f"This file is too large for simple mode with max_chars={max_chars}. "
                "Use artifact_mode=progressive, or extract a bounded range."
            )
        return (
            "artifact_mode=simple is not supported for this document type. "
            "Use artifact_mode=progressive, or extract a bounded range."
        )
