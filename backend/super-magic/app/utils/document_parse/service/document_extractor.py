"""Document content extraction service."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.utils.async_file_utils import async_mkdir

from ..drivers import get_document_driver_registry
from ..models import ExtractionResult
from .document_batch_planner import DocumentBatchPlanner
from .extraction_result_merger import ExtractionResultMerger


class DocumentExtractor:
    async def extract(
        self,
        path: Path,
        output_dir: Path,
        ranges: Optional[str] = None,
        mode: str = "auto",
        max_chars: int = 12000,
        **kwargs,
    ) -> ExtractionResult:
        """按驱动能力拆分请求，并聚合各批次的结构化结果。"""

        await async_mkdir(output_dir, parents=True, exist_ok=True)
        driver = get_document_driver_registry().get_driver(path)
        profile = await driver.inspect(path)
        batches = DocumentBatchPlanner.plan(profile, ranges, kwargs.get("asset_strategy"))
        if len(batches) == 1:
            return await driver.extract(
                path,
                output_dir,
                ranges=batches[0].ranges,
                mode=mode,
                max_chars=max_chars,
                **kwargs,
            )

        results = []
        for batch in batches:
            results.append(
                await driver.extract(
                    path,
                    output_dir,
                    ranges=batch.ranges,
                    mode=mode,
                    max_chars=max_chars,
                    **kwargs,
                )
            )
        return ExtractionResultMerger.merge(results, batches)
