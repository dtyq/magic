"""视频产出请求规范化器。"""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING

from app.tools.canvas.production.contracts import NormalizedVideoProductionRequest
from app.tools.canvas.production.estimation.cost_estimate_request_normalizer_interface import (
    CostEstimateRequestNormalizerInterface,
)

if TYPE_CHECKING:
    from app.tools.canvas.application.commands import GenerationParameters


class VideoProductionRequestNormalizer(CostEstimateRequestNormalizerInterface):
    """为积分预估和真实视频提交生成同一份稳定请求指纹。"""

    @property
    def production_rule(self) -> str:
        """返回视频生成规则名称。"""
        return "video_generation"

    def normalize(
        self,
        project_path: str,
        item_ref: str,
        parameters: GenerationParameters,
    ) -> NormalizedVideoProductionRequest:
        """规范化请求并排除只用于确认门的 estimate_id。"""
        parameter_payload = parameters.to_dict()
        parameter_payload.pop("estimate_id", None)
        payload = {
            "project_path": project_path,
            "production_rule": "video_generation",
            "item_ref": item_ref,
            "parameters": parameter_payload,
        }
        serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        fingerprint = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return NormalizedVideoProductionRequest(
            _project_path=project_path,
            _item_ref=item_ref,
            parameters=parameters,
            _request_fingerprint=fingerprint,
        )
