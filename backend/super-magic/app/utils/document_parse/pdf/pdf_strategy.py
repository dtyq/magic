"""PDF 混合抽取策略。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from ..constants import DEFAULT_PAGE_SNAPSHOT_MAX_PAGES


@dataclass(frozen=True)
class PdfExtractionDecision:
    """一次 PDF 抽取请求的执行决策。"""

    pages: list[int]
    extract_text_layer: bool
    extract_embedded_images: bool
    extract_page_snapshots: bool
    page_snapshot_pages: list[int]
    visual_understanding_pages: list[int]
    reason: str


class PdfExtractionStrategy:
    """根据元数据和用户意图选择 PDF 抽取层。"""

    def decide(
        self,
        *,
        pages: list[int],
        metadata: dict[str, Any],
        extract_embedded_images: bool,
        page_snapshot_policy: Literal["auto", "always", "never"] = "auto",
        visual_hint: Literal["auto", "none", "page_snapshot", "layout_required"] = "auto",
        page_snapshot_max_pages: int = DEFAULT_PAGE_SNAPSHOT_MAX_PAGES,
    ) -> PdfExtractionDecision:
        """返回选中页面的混合抽取决策。"""

        if page_snapshot_policy not in {"auto", "always", "never"}:
            raise ValueError("Unsupported page_snapshot_policy. Use auto, always, or never.")
        if visual_hint not in {"auto", "none", "page_snapshot", "layout_required"}:
            raise ValueError("Unsupported visual_hint. Use auto, none, page_snapshot, or layout_required.")

        should_snapshot = self._should_extract_snapshots(metadata, page_snapshot_policy, visual_hint)
        snapshot_pages = pages if should_snapshot else []
        if len(snapshot_pages) > page_snapshot_max_pages:
            raise ValueError(
                f"Page snapshot rendering supports at most {page_snapshot_max_pages} pages per call; "
                f"requested {len(snapshot_pages)}."
            )

        visual_pages = snapshot_pages if visual_hint == "layout_required" else []
        reason = self._reason(metadata, page_snapshot_policy, visual_hint, should_snapshot)
        return PdfExtractionDecision(
            pages=pages,
            extract_text_layer=True,
            extract_embedded_images=extract_embedded_images,
            extract_page_snapshots=should_snapshot,
            page_snapshot_pages=snapshot_pages,
            visual_understanding_pages=visual_pages,
            reason=reason,
        )

    @staticmethod
    def _should_extract_snapshots(
        metadata: dict[str, Any],
        page_snapshot_policy: str,
        visual_hint: str,
    ) -> bool:
        """判断选中页面是否需要生成整页快照资产。"""

        if page_snapshot_policy == "always":
            return True
        if page_snapshot_policy == "never" or visual_hint == "none":
            return False
        if visual_hint in {"page_snapshot", "layout_required"}:
            return True
        return bool(
            metadata.get("is_scanned_like")
            or metadata.get("text_density") == "low"
            or int(metadata.get("full_page_image_pages_in_sample") or 0) > 0
        )

    @staticmethod
    def _reason(
        metadata: dict[str, Any],
        page_snapshot_policy: str,
        visual_hint: str,
        should_snapshot: bool,
    ) -> str:
        """返回可读的抽取决策原因。"""

        if page_snapshot_policy != "auto":
            return f"page_snapshot_policy={page_snapshot_policy}"
        if visual_hint != "auto":
            return f"visual_hint={visual_hint}"
        if should_snapshot:
            if metadata.get("is_scanned_like"):
                return "scanned_like_pdf"
            if metadata.get("text_density") == "low":
                return "low_text_density"
            if int(metadata.get("full_page_image_pages_in_sample") or 0) > 0:
                return "full_page_image_in_sample"
        return "text_layer_sufficient"
