"""分批文档抽取结果聚合。"""

from __future__ import annotations

from dataclasses import replace

from ..models import DocumentAsset, DocumentNode, ExtractionResult
from ..structure.range_parser import RangeParser, compact_numeric_ranges
from .document_batch_planner import DocumentExtractionBatch


class ExtractionResultMerger:
    """将同一文档的多个安全批次合并为一次逻辑抽取结果。"""

    @classmethod
    def merge(
        cls,
        results: list[ExtractionResult],
        batches: list[DocumentExtractionBatch],
    ) -> ExtractionResult:
        """合并批次内容，并恢复完整范围、稳定资产编号和节点引用。"""

        if not results:
            raise ValueError("Cannot merge empty document extraction results.")
        first = results[0]
        assets = cls._merge_assets(results)
        nodes = cls._merge_nodes([node for result in results for node in result.nodes])
        metadata = dict(first.metadata)
        metadata["source_range"] = cls._combined_range(batches)
        metadata["execution_batches"] = [
            {"ranges": batch.ranges, "unit_count": batch.unit_count} for batch in batches
        ]
        metadata["execution_batch_count"] = len(batches)
        metadata["execution_max_units_per_call"] = max(batch.unit_count for batch in batches)
        max_units_per_call = next(
            (batch.max_units_per_call for batch in batches if batch.max_units_per_call),
            None,
        )
        if max_units_per_call:
            metadata["execution_limits"] = {
                "max_units_per_call": max_units_per_call,
                "requires_batching": len(batches) > 1,
                "recommended_ranges": [batch.ranges for batch in batches],
            }
        return ExtractionResult(
            document_id=first.document_id,
            source_path=first.source_path,
            output_dir=first.output_dir,
            chunks=[chunk for result in results for chunk in result.chunks],
            assets=assets,
            nodes=nodes,
            pages_processed=sum(result.pages_processed for result in results),
            total_units=max(result.total_units for result in results),
            next_range=None,
            metadata=metadata,
        )

    @staticmethod
    def _merge_assets(results: list[ExtractionResult]) -> list[DocumentAsset]:
        """按资产路径去重并重新分配稳定编号。"""

        by_path: dict[str, DocumentAsset] = {}
        for result in results:
            for asset in result.assets:
                by_path[asset.path] = asset
        return [
            replace(asset, asset_id=f"asset_{index:04d}")
            for index, asset in enumerate(by_path.values(), start=1)
        ]

    @classmethod
    def _merge_nodes(cls, nodes: list[DocumentNode]) -> list[DocumentNode]:
        """按节点身份合并批次产生的目录和 chunk 引用。"""

        by_key: dict[str, DocumentNode] = {}
        ordered_keys: list[str] = []
        for node in nodes:
            key = node.node_id or f"{node.level}:{node.source_range}:{node.title}"
            if key not in by_key:
                by_key[key] = replace(
                    node,
                    chunk_ids=list(node.chunk_ids),
                    children=cls._merge_nodes(list(node.children)),
                    metadata=dict(node.metadata),
                )
                ordered_keys.append(key)
                continue
            target = by_key[key]
            target.chunk_ids = list(dict.fromkeys([*target.chunk_ids, *node.chunk_ids]))
            target.summary = target.summary or node.summary
            target.metadata = {**node.metadata, **target.metadata}
            target.children = cls._merge_nodes([*target.children, *node.children])
        return [by_key[key] for key in ordered_keys]

    @staticmethod
    def _combined_range(batches: list[DocumentExtractionBatch]) -> str:
        """将所有批次范围还原为一个紧凑范围表达式。"""

        units: list[int] = []
        for batch in batches:
            if batch.ranges:
                units.extend(RangeParser.parse_numeric(batch.ranges))
        return compact_numeric_ranges(units) or "all"
