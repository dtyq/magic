"""文档抽取批次规划。"""

from __future__ import annotations

from dataclasses import dataclass

from ..constants import DEFAULT_PAGE_SNAPSHOT_MAX_PAGES
from ..models import DocumentProfile
from ..structure.range_parser import RangeParser, compact_numeric_ranges
from .asset_strategy import AssetStrategyResolver


@dataclass(frozen=True)
class DocumentExtractionBatch:
    """表示一次驱动调用需要处理的结构化范围。"""

    ranges: str | None
    unit_count: int
    max_units_per_call: int | None = None


class DocumentBatchPlanner:
    """根据文档能力和资产策略规划安全的抽取批次。"""

    @classmethod
    def plan(
        cls,
        profile: DocumentProfile,
        ranges: str | None,
        asset_strategy: str | None,
    ) -> list[DocumentExtractionBatch]:
        """为当前请求生成批次，并保证页面视觉渲染不超过驱动上限。"""

        units = RangeParser.parse_numeric(ranges, profile.total_units) or list(
            range(1, profile.total_units + 1)
        )
        if not units:
            return [DocumentExtractionBatch(ranges=ranges, unit_count=0)]

        resolved = AssetStrategyResolver.resolve(asset_strategy, profile).resolved_strategy
        max_units = cls._max_units_per_call(profile, resolved)
        if not max_units or len(units) <= max_units:
            return [
                DocumentExtractionBatch(
                    ranges=ranges,
                    unit_count=len(units),
                    max_units_per_call=max_units,
                )
            ]
        return [
                DocumentExtractionBatch(
                    ranges=compact_numeric_ranges(units[index : index + max_units]),
                    unit_count=len(units[index : index + max_units]),
                    max_units_per_call=max_units,
                )
            for index in range(0, len(units), max_units)
        ]

    @staticmethod
    def _max_units_per_call(profile: DocumentProfile, resolved_strategy: str) -> int | None:
        """返回当前驱动和策略允许的单次最大结构单元数。"""

        if profile.file_type == "pdf" and resolved_strategy in {"page_visual", "full_fidelity"}:
            return DEFAULT_PAGE_SNAPSHOT_MAX_PAGES
        return None
