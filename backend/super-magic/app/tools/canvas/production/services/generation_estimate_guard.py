"""真实生成前的积分预估确认门。"""

from dataclasses import replace

from agentlang.logger import get_logger
from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.estimation import (
    CostEstimateRepositoryInterface,
    CostEstimateRequestNormalizerRegistry,
)

logger = get_logger(__name__)


class GenerationEstimateGuard:
    """校验 billable 内容的 estimate_id、item_ref 和请求指纹。"""

    def __init__(
        self,
        estimate_records: CostEstimateRepositoryInterface,
        normalizers: CostEstimateRequestNormalizerRegistry,
    ) -> None:
        """显式绑定预估凭证仓储和视频请求规范化器。"""
        self._estimate_records = estimate_records
        self._normalizers = normalizers

    async def resolve_and_validate(
        self,
        project_path: str,
        item_ref: str | None,
        production_rule: str | None,
        parameters: GenerationParameters,
    ) -> GenerationParameters:
        """校验预估凭证并返回预估时冻结的标准生成参数。"""
        if not production_rule:
            raise CanvasDomainError(
                "POINT_ESTIMATE_UNAVAILABLE",
                "This billable generation capability has no configured content production rule.",
            )
        if not item_ref:
            raise CanvasDomainError("POINT_ESTIMATE_REQUIRED", "Billable generation requires a stable item_ref and estimate_id.")
        if parameters.skip_point_estimate:
            if parameters.estimate_id:
                raise CanvasDomainError(
                    "POINT_ESTIMATE_CONFLICT",
                    "skip_point_estimate cannot be combined with estimate_id.",
                )
            logger.warning(
                "Canvas 计费生成跳过积分预估: project_path={} item_ref={} production_rule={}",
                project_path,
                item_ref,
                production_rule,
            )
            return parameters
        estimate_id = parameters.estimate_id
        if not estimate_id:
            raise CanvasDomainError("POINT_ESTIMATE_REQUIRED", "Estimate content points and obtain user confirmation before generation.")
        record = await self._estimate_records.get(estimate_id)
        if record is None:
            raise CanvasDomainError("POINT_ESTIMATE_NOT_FOUND", "The point estimate is missing or expired. Estimate again before generation.")
        if record.project_path != project_path or record.production_rule != production_rule:
            raise CanvasDomainError("POINT_ESTIMATE_MISMATCH", "The point estimate does not belong to this project or production rule.")
        record_item = record.get_item(item_ref)
        if record_item is None or record_item.status not in {"estimated", "not_billable"}:
            raise CanvasDomainError("POINT_ESTIMATE_MISMATCH", "The point estimate does not contain an eligible result for this item_ref.")
        current = self._normalizers.get(production_rule).normalize(project_path, item_ref, parameters)
        supplied_is_reference_only = self._is_estimate_reference_only(parameters)
        if not supplied_is_reference_only and current.request_fingerprint != record_item.request_fingerprint:
            raise CanvasDomainError("POINT_ESTIMATE_MISMATCH", "Video parameters changed after estimation. Estimate again before generation.")
        return replace(
            record_item.canonical_parameters,
            estimate_id=estimate_id,
            name=parameters.name or record_item.canonical_parameters.name,
        )

    @staticmethod
    def _is_estimate_reference_only(parameters: GenerationParameters) -> bool:
        """判断调用方是否只提供了 estimate_id 和非计费展示名称。"""
        payload = parameters.to_dict()
        payload.pop("estimate_id", None)
        payload.pop("skip_point_estimate", None)
        payload.pop("name", None)
        return not any(value not in (None, "", [], {}) for value in payload.values())

    async def validate(
        self,
        project_path: str,
        item_ref: str | None,
        production_rule: str | None,
        parameters: GenerationParameters,
    ) -> None:
        """兼容旧调用方，仅执行预估凭证校验。"""
        await self.resolve_and_validate(project_path, item_ref, production_rule, parameters)
