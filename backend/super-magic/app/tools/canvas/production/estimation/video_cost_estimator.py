"""视频内容积分估算器。"""

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.contracts import (
    CostEstimateItemResult,
    CostEstimateRequestInterface,
    NormalizedVideoProductionRequest,
)
from app.tools.canvas.production.estimation.content_production_cost_estimator_interface import (
    ContentProductionCostEstimatorInterface,
)
from app.tools.canvas.production.ports.video_point_estimate_port import VideoPointEstimatePort


class VideoCostEstimator(ContentProductionCostEstimatorInterface):
    """通过独立端口估算 video_generation 规则积分。"""

    def __init__(self, estimate_port: VideoPointEstimatePort) -> None:
        """显式绑定视频积分预估端口。"""
        self._estimate_port = estimate_port

    @property
    def production_rule(self) -> str:
        """返回视频生成规则名称。"""
        return "video_generation"

    async def estimate(
        self,
        request: CostEstimateRequestInterface,
        tool_context: ToolContext | None,
    ) -> CostEstimateItemResult:
        """把端口结果转换为通用逐项结果。"""
        if not isinstance(request, NormalizedVideoProductionRequest):
            raise CanvasDomainError(
                "POINT_ESTIMATE_REQUEST_INVALID",
                "The video estimator received an incompatible normalized request.",
            )
        try:
            points = await self._estimate_port.estimate_points(request, tool_context)
        except Exception as error:
            reason = str(error).strip() or "The current video request could not be estimated."
            return CostEstimateItemResult(
                item_ref=request.item_ref,
                status="unavailable",
                reason=reason[:500],
                request_fingerprint=request.request_fingerprint,
            )
        return CostEstimateItemResult(
            item_ref=request.item_ref,
            status="estimated",
            points=points,
            request_fingerprint=request.request_fingerprint,
        )
