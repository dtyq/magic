"""积分预估凭证仓储接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.production.contracts import CostEstimateRecord


class CostEstimateRepositoryInterface(ABC):
    """定义预估确认凭证的最小存取能力。"""

    @abstractmethod
    async def put(self, record: CostEstimateRecord) -> None:
        """保存预估记录。"""

    @abstractmethod
    async def get(self, estimate_id: str) -> CostEstimateRecord | None:
        """读取预估记录。"""
