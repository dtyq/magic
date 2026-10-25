"""内容积分预估用例服务。"""

import uuid
from collections.abc import Sequence

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.production.contracts import (
    ContentProductionRuleRegistry,
    CostEstimateRecord,
    CostEstimateRecordItem,
    CostEstimateResult,
    VideoPointEstimateItem,
)
from app.tools.canvas.production.estimation import (
    ContentProductionCostEstimatorRegistry,
    CostEstimateRepositoryInterface,
    CostEstimateRequestNormalizerRegistry,
)


class EstimateContentPointsService:
    """执行无副作用批量积分预估并保存确认凭证。"""

    def __init__(
        self,
        repository: CanvasRepositoryInterface,
        rules: ContentProductionRuleRegistry,
        estimators: ContentProductionCostEstimatorRegistry,
        estimate_records: CostEstimateRepositoryInterface,
        normalizers: CostEstimateRequestNormalizerRegistry,
    ) -> None:
        """显式绑定项目读取、估算器、凭证仓储和规范化器。"""
        self._repository = repository
        self._rules = rules
        self._estimators = estimators
        self._estimate_records = estimate_records
        self._normalizers = normalizers

    async def estimate(
        self,
        project_path: str,
        production_rule: str,
        items: Sequence[VideoPointEstimateItem],
        tool_context: ToolContext | None,
    ) -> CostEstimateResult:
        """校验项目后逐项预估，不写 Canvas、Content 或生成任务。"""
        await self._repository.read(project_path)
        self._rules.get(production_rule)
        normalizer = self._normalizers.get(production_rule)
        estimator = self._estimators.get(production_rule)
        item_list = tuple(items)
        item_refs = [item.item_ref for item in item_list]
        if len(item_refs) != len(set(item_refs)):
            raise CanvasDomainError("DUPLICATE_ITEM_REF", "Each estimate item_ref must be unique.")
        results = []
        normalized_items = []
        for item in item_list:
            normalized = normalizer.normalize(project_path, item.item_ref, item.parameters)
            normalized_items.append(normalized)
            results.append(await estimator.estimate(normalized, tool_context))
        can_continue = bool(results) and all(item.can_continue for item in results)
        total_points = (
            sum(item.points or 0 for item in results if item.status == "estimated")
            if can_continue
            else None
        )
        estimate_id = f"estimate-{uuid.uuid4().hex}" if can_continue else None
        fingerprints = {
            item.item_ref: item.request_fingerprint or ""
            for item in results
            if item.request_fingerprint
        }
        if estimate_id is not None:
            record_items = tuple(
                CostEstimateRecordItem(
                    item_ref=result.item_ref,
                    status=result.status,
                    request_fingerprint=result.request_fingerprint or "",
                    points=result.points,
                    canonical_parameters=GenerationParameters.from_dict(
                        normalized.parameters.to_dict()
                    ),
                )
                for result, normalized in zip(results, normalized_items, strict=True)
            )
            await self._estimate_records.put(
                CostEstimateRecord.create(
                    estimate_id=estimate_id,
                    project_path=project_path,
                    production_rule=production_rule,
                    items=record_items,
                )
            )
        return CostEstimateResult(
            production_rule=production_rule,
            items=tuple(results),
            total_points=total_points,
            estimate_id=estimate_id,
            can_continue=can_continue,
            request_fingerprints=fingerprints,
        )
