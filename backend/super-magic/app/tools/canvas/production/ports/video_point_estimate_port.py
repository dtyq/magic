"""视频积分预估外部端口。"""

from abc import ABC, abstractmethod

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.production.contracts import NormalizedVideoProductionRequest


class VideoPointEstimatePort(ABC):
    """隔离视频积分估算的外部调用细节。"""

    @abstractmethod
    async def estimate_points(
        self,
        request: NormalizedVideoProductionRequest,
        tool_context: ToolContext | None,
    ) -> int | float:
        """返回明确的积分数字。"""
