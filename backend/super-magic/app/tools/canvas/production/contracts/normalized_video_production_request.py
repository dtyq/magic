"""规范化视频产出请求。"""

from dataclasses import dataclass

from app.tools.canvas.application.commands import GenerationParameters
from app.tools.canvas.production.contracts.cost_estimate_request_interface import CostEstimateRequestInterface


@dataclass(frozen=True)
class NormalizedVideoProductionRequest(CostEstimateRequestInterface):
    """保存视频预估和真实提交共同使用的规范化参数。"""

    _project_path: str
    _item_ref: str
    parameters: GenerationParameters
    _request_fingerprint: str

    @property
    def project_path(self) -> str:
        """返回请求所属项目路径。"""
        return self._project_path

    @property
    def item_ref(self) -> str:
        """返回批次短引用。"""
        return self._item_ref

    @property
    def production_rule(self) -> str:
        """返回视频生成规则名称。"""
        return "video_generation"

    @property
    def request_fingerprint(self) -> str:
        """返回规范化参数指纹。"""
        return self._request_fingerprint
