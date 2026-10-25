"""可复用图片资产筛选。"""

from __future__ import annotations

from typing import Any

from .image_watermark_detector import ImageWatermarkDetector


class ReusableImageSelector:
    """从 PDF 或 Office 图片候选中筛选适合独立复用的资产。"""

    MIN_DISPLAY_AREA_RATIO = 0.01
    MIN_DISPLAY_SHORT_SIDE = 12.0
    MIN_ASPECT_RATIO_FOR_FRAGMENT = 8.0

    @classmethod
    def select(
        cls,
        images: list[dict[str, Any]],
        selected_unit_count: int = 0,
        deduplicate_repeated_images: bool = True,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """返回可复用图片和被过滤的图片记录。"""

        kept, skipped = ImageWatermarkDetector.split_images(
            images,
            selected_unit_count=selected_unit_count,
            enabled=True,
            deduplicate_repeated_images=deduplicate_repeated_images,
        )
        selected: list[dict[str, Any]] = []
        for image in kept:
            if cls._is_layout_fragment(image):
                skipped.append(
                    ImageWatermarkDetector._skipped_record(image, "low-value layout fragment")
                )
                continue
            selected.append(image)
        return selected, skipped

    @classmethod
    def _is_layout_fragment(cls, image: dict[str, Any]) -> bool:
        """根据页面显示区域识别高概率版式碎片。"""

        if ImageWatermarkDetector._has_protected_keyword(image):
            return False
        rects = image.get("rects") or []
        if not rects:
            return False
        display_area = max(float(rect.get("area_ratio") or 0) for rect in rects)
        displayed_short_side = max(
            min(
                max(float(item.get("x1") or 0) - float(item.get("x0") or 0), 0),
                max(float(item.get("y1") or 0) - float(item.get("y0") or 0), 0),
            )
            for item in rects
        )
        width = float(image.get("width") or 0)
        height = float(image.get("height") or 0)
        aspect_ratio = max(width, height) / max(min(width, height), 1)
        return (
            display_area < cls.MIN_DISPLAY_AREA_RATIO
            and displayed_short_side < cls.MIN_DISPLAY_SHORT_SIDE
        ) or (
            display_area < cls.MIN_DISPLAY_AREA_RATIO
            and aspect_ratio >= cls.MIN_ASPECT_RATIO_FOR_FRAGMENT
        )
