"""Fake 视频积分预估适配器。"""

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.production.contracts import NormalizedVideoProductionRequest
from app.tools.canvas.production.ports.video_point_estimate_port import VideoPointEstimatePort


class FakeVideoPointEstimatePort(VideoPointEstimatePort):
    """为本地调试和 mock 测试返回确定积分。"""

    def __init__(self, points: int | float = 10) -> None:
        """保存每个视频请求的固定积分。"""
        self._points = points

    async def estimate_points(
        self,
        request: NormalizedVideoProductionRequest,
        tool_context: ToolContext | None,
    ) -> int | float:
        """返回固定积分，不访问外部服务。"""
        return self._points
