"""Progressive document sampling service.

Internal responsibility:
- Creates small Markdown samples before expensive extraction or full export.
- Writes samples under samples/ so formal chunks/ remain reserved for committed reads.
- Records enough signals for the model to choose the next reading strategy.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.utils.async_file_utils import async_mkdir, async_write_text

from ..constants import SAMPLES_DIRNAME
from ..models import ExtractionResult
from ..structure.range_parser import RangeParser, compact_numeric_ranges
from .document_extractor import DocumentExtractor
from .document_inspector import DocumentInspector
from .reading_state import ReadingStateStore


class DocumentSampler:
    """Build bounded sample Markdown artifacts for large-document planning."""

    async def sample(
        self,
        input_path: Path,
        output_dir: Path,
        *,
        strategy: str = "auto",
        ranges: str | None = None,
        max_units: int = 5,
        include_images: bool = True,
    ) -> dict[str, Any]:
        profile = await DocumentInspector().inspect(input_path)
        max_units = max(1, min(int(max_units or 5), 20))
        sample_range = self._select_sample_range(profile.total_units, ranges, max_units)
        samples_dir = output_dir / SAMPLES_DIRNAME
        await async_mkdir(samples_dir, parents=True, exist_ok=True)

        extraction: ExtractionResult | None = None
        if profile.unit_type in {"page", "slide"} or profile.file_type in {"pdf", "image", "markdown", "text"}:
            extraction = await DocumentExtractor().extract(
                input_path,
                samples_dir,
                ranges=sample_range,
                mode="local_text" if profile.file_type == "pdf" else "auto",
                max_chars=12000,
                extract_images=include_images,
            )
            content = self._sample_content_from_extraction(profile.file_name, extraction)
        else:
            content = self._sample_content_from_profile(profile)

        text_signal = self._text_signal(content)
        recommendations = self._recommend(profile.file_type, profile.unit_type, text_signal, include_images)
        sample_name = self._sample_file_name(profile.unit_type, sample_range)
        sample_path = samples_dir / sample_name
        await async_write_text(sample_path, content)

        state = await ReadingStateStore().mark_sampled(
            output_dir,
            source_path=str(input_path),
            total_units=profile.total_units,
            unit_type=profile.unit_type,
            file_type=profile.file_type,
            sampled_range=sample_range or "sample",
            sample_path=str(sample_path.relative_to(output_dir)),
            recommendations=recommendations,
            metadata={
                "last_sample": {
                    "strategy": strategy,
                    "sample_path": str(sample_path.relative_to(output_dir)),
                    "range": sample_range or "sample",
                    "has_extractable_text": text_signal["has_extractable_text"],
                    "image_dominant": text_signal["image_dominant"],
                    "image_count": text_signal["image_count"],
                }
            },
        )

        return {
            "profile": profile,
            "sample_path": str(sample_path),
            "sample_range": sample_range or "sample",
            "content": content,
            "text_signal": text_signal,
            "recommendations": recommendations,
            "state": state,
            "extraction": extraction,
        }

    @staticmethod
    def _select_sample_range(total_units: int, ranges: str | None, max_units: int) -> str | None:
        if total_units <= 0:
            return ranges
        if ranges:
            selected = RangeParser.parse_numeric(ranges, total_units)[:max_units]
            return compact_numeric_ranges(selected)
        if total_units <= max_units:
            return compact_numeric_ranges(list(range(1, total_units + 1)))
        candidates: list[int] = []
        candidates.extend(range(1, min(3, total_units) + 1))
        candidates.append(max(1, total_units // 2))
        candidates.append(total_units)
        unique = []
        for value in candidates:
            if value not in unique:
                unique.append(value)
        return compact_numeric_ranges(unique[:max_units])

    @staticmethod
    def _sample_content_from_extraction(file_name: str, extraction: ExtractionResult) -> str:
        lines = [f"# Sample: {file_name}", ""]
        for chunk in extraction.chunks:
            lines.extend([f"## {chunk.title}", "", chunk.content.strip(), ""])
        if extraction.assets:
            lines.extend(["## Sample Assets", ""])
            for asset in extraction.assets[:50]:
                lines.append(f"- `{asset.path}` ({asset.source_range or 'unknown range'})")
        return "\n".join(lines).strip() + "\n"

    @staticmethod
    def _sample_content_from_profile(profile) -> str:
        lines = [f"# Sample: {profile.file_name}", ""]
        lines.extend([
            f"- Type: `{profile.file_type}`",
            f"- Structure unit: `{profile.unit_type}`",
            f"- Unit count: {profile.total_units}",
            f"- Recommended strategy: {profile.recommended_strategy}",
            "",
        ])
        if profile.outline:
            lines.extend(["## Outline", ""])
            for node in profile.outline[:20]:
                lines.append(f"- {node.title} ({node.source_range})")
            lines.append("")
        if profile.samples:
            lines.extend(["## Representative Samples", ""])
            for sample in profile.samples[:10]:
                lines.append(f"- {sample}")
        return "\n".join(lines).strip() + "\n"

    @staticmethod
    def _text_signal(content: str) -> dict[str, Any]:
        image_count = len(re.findall(r"!\[[^\]]*]\([^)]+\)", content))
        text = re.sub(r"!\[[^\]]*]\([^)]+\)", "", content)
        text = text.replace("(本页未提取到文本)", "")
        text = re.sub(r"#+\s*Images\b", "", text, flags=re.IGNORECASE)
        text = re.sub(r"^#+\s+.*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"^-\s+`[^`]+`.*$", "", text, flags=re.MULTILINE)
        body_chars = len(re.sub(r"\s+", "", text))
        has_extractable_text = body_chars >= 40
        return {
            "body_chars": body_chars,
            "image_count": image_count,
            "has_extractable_text": has_extractable_text,
            "image_dominant": image_count > 0 and not has_extractable_text,
        }

    @staticmethod
    def _recommend(file_type: str, unit_type: str, signal: dict[str, Any], include_images: bool) -> list[str]:
        if signal["image_dominant"]:
            return [
                "Use understand_document_images for the sampled image pages before summarizing.",
                "Continue in small batches; do not run full-document visual understanding in one call.",
            ]
        if file_type == "spreadsheet":
            return ["Use sheet/range extraction after inspecting sheet names, headers, and sample rows."]
        if unit_type == "slide":
            return ["Extract slides in small batches and summarize slide by slide."]
        if signal["has_extractable_text"]:
            return ["Use extract_document_content with targeted ranges, then update the reading state."]
        if include_images:
            return ["Inspect assets and choose understand_document_images only for images needed by the goal."]
        return ["Build the index and choose a narrower range for the next read."]

    @staticmethod
    def _sample_file_name(unit_type: str, sample_range: str | None) -> str:
        safe_range = (sample_range or "sample").replace(",", "_").replace("-", "_")
        safe_range = re.sub(r"[^A-Za-z0-9._-]+", "_", safe_range).strip("_") or "sample"
        return f"sample_{unit_type}_{safe_range}.md"
