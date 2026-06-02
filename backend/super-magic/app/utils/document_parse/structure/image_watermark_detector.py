"""High-confidence image watermark detection for parsed document assets.

This detector is shared by PDF, Office, and other drivers. It is conservative:
drivers may provide different evidence, so only strong signals are filtered.
Weak signals should be recorded in metadata by the caller instead of deleting
an image that may be useful document content.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable


class ImageWatermarkDetector:
    """Detect image records that are safe to skip as watermarks."""

    KEYWORDS = ("watermark", "draft", "confidential", "do-not-copy", "do_not_copy")
    BLANK_KEYWORDS = ("blank", "spacer", "pixel", "tracking", "background")
    MIN_AREA_RATIO = 0.18
    MIN_CENTER_OVERLAP_RATIO = 0.35
    MIN_UNIT_COVERAGE_RATIO = 0.5
    PROTECTED_KEYWORDS = ("signature", "stamp", "seal", "chop")

    @classmethod
    def split_images(
        cls,
        images: Iterable[dict[str, Any]],
        selected_unit_count: int = 0,
        enabled: bool = True,
        deduplicate_repeated_images: bool = True,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Return kept records and skipped high-confidence watermark records."""

        image_list = list(images)
        if not enabled and not deduplicate_repeated_images:
            return image_list, []

        watermark_keys = cls._watermark_keys(image_list, selected_unit_count) if enabled else {}
        kept: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        duplicate_keys = cls._duplicate_keys(image_list, selected_unit_count) if deduplicate_repeated_images else set()
        for image in image_list:
            key = cls._image_key(image)
            invalid_reason = cls._invalid_image_reason(image)
            if key in watermark_keys:
                skipped.append(cls._skipped_record(image, watermark_keys[key]))
            elif invalid_reason:
                skipped.append(cls._skipped_record(image, invalid_reason))
            elif key in duplicate_keys and key in seen_keys:
                skipped.append(cls._skipped_record(image, "duplicate repeated image kept once"))
            else:
                kept.append(image)
                seen_keys.add(key)
        return kept, skipped

    @classmethod
    def _watermark_keys(cls, images: list[dict[str, Any]], selected_unit_count: int) -> dict[str, str]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for image in images:
            grouped[cls._image_key(image)].append(image)

        watermark_keys: dict[str, str] = {}
        for key, group in grouped.items():
            name_hit = any(cls._has_watermark_keyword(image) for image in group)
            units = {str(image.get("unit") or image.get("page") or image.get("source_range") or "") for image in group}
            units.discard("")
            unit_coverage = len(units) / max(selected_unit_count, 1) if selected_unit_count else 0
            max_area_ratio = max((cls._max_area_ratio(image) for image in group), default=0)
            centered_count = sum(1 for image in group if cls._is_centered(image))
            repeated = len(group) >= 2 or len(units) >= 2

            if name_hit and repeated:
                watermark_keys[key] = "repeated image with watermark-like name"
                continue
            if (
                selected_unit_count >= 2
                and len(units) >= 2
                and unit_coverage >= cls.MIN_UNIT_COVERAGE_RATIO
                and max_area_ratio >= cls.MIN_AREA_RATIO
                and centered_count / max(len(group), 1) >= cls.MIN_CENTER_OVERLAP_RATIO
            ):
                watermark_keys[key] = (
                    "watermark-like repeated large centered image "
                    f"(units={len(units)}, unit_coverage={unit_coverage:.2f}, area_ratio={max_area_ratio:.2f})"
                )
        return watermark_keys

    @classmethod
    def _duplicate_keys(cls, images: list[dict[str, Any]], selected_unit_count: int) -> set[str]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for image in images:
            grouped[cls._image_key(image)].append(image)
        duplicates: set[str] = set()
        for key, group in grouped.items():
            units = {str(image.get("unit") or image.get("page") or image.get("source_range") or "") for image in group}
            units.discard("")
            if selected_unit_count >= 2:
                unit_coverage = len(units) / max(selected_unit_count, 1)
                if len(units) >= 2 and unit_coverage >= cls.MIN_UNIT_COVERAGE_RATIO:
                    duplicates.add(key)
            elif len(group) >= 2:
                duplicates.add(key)
        return duplicates

    @staticmethod
    def _image_key(image: dict[str, Any]) -> str:
        return str(image.get("content_hash") or f"path:{image.get('path') or image.get('original_name')}")

    @classmethod
    def _has_watermark_keyword(cls, image: dict[str, Any]) -> bool:
        haystack = " ".join(
            str(image.get(field) or "")
            for field in ("name", "title", "original_name")
        ).lower()
        return any(keyword in haystack for keyword in cls.KEYWORDS)

    @classmethod
    def _has_protected_keyword(cls, image: dict[str, Any]) -> bool:
        haystack = " ".join(
            str(image.get(field) or "")
            for field in ("name", "title", "original_name")
        ).lower()
        return any(keyword in haystack for keyword in cls.PROTECTED_KEYWORDS)

    @classmethod
    def _has_blank_keyword(cls, image: dict[str, Any]) -> bool:
        haystack = " ".join(
            str(image.get(field) or "")
            for field in ("name", "title", "original_name")
        ).lower()
        return any(keyword in haystack for keyword in cls.BLANK_KEYWORDS)

    @classmethod
    def _invalid_image_reason(cls, image: dict[str, Any]) -> str | None:
        if cls._has_protected_keyword(image):
            return None
        features = image.get("features") or {}
        if features.get("is_transparent"):
            return "invalid transparent image"
        if features.get("is_tiny"):
            return "invalid tiny image"
        if features.get("is_decorative_line"):
            return "invalid decorative line image"
        if features.get("is_solid_or_blank") and cls._has_blank_keyword(image):
            return "invalid solid or blank image"
        return None

    @staticmethod
    def _max_area_ratio(image: dict[str, Any]) -> float:
        rects = image.get("rects") or []
        return max((float(rect.get("area_ratio") or 0) for rect in rects), default=0)

    @classmethod
    def _is_centered(cls, image: dict[str, Any]) -> bool:
        rects = image.get("rects") or []
        return any(float(rect.get("center_overlap_ratio") or 0) >= cls.MIN_CENTER_OVERLAP_RATIO for rect in rects)

    @staticmethod
    def _skipped_record(image: dict[str, Any], reason: str) -> dict[str, Any]:
        return {
            "page": image.get("page"),
            "unit": image.get("unit"),
            "source_range": image.get("source_range"),
            "image_index": image.get("image_index"),
            "xref": image.get("xref"),
            "path": image.get("path"),
            "original_name": image.get("original_name") or image.get("name"),
            "width": image.get("width"),
            "height": image.get("height"),
            "reason": reason,
            "features": image.get("features"),
        }
