"""Models shared by document format converters."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class ConversionCapability:
    source_extensions: set[str]
    target_formats: set[str]
    converter_name: str
    description: str


@dataclass(frozen=True)
class ConversionRequest:
    input_path: Path
    output_dir: Path
    target_format: str
    ranges: Optional[str] = None

    @property
    def source_extension(self) -> str:
        return self.input_path.suffix.lower()

    @property
    def normalized_target(self) -> str:
        return self.target_format.lower().lstrip(".")


@dataclass(frozen=True)
class ConversionResult:
    output_files: list[Path]
    converter_name: str


class UnsupportedConversionError(ValueError):
    """Raised when no registered converter can handle the requested route."""

