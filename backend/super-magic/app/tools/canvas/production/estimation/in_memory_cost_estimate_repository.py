"""内存积分预估凭证仓储。"""

from app.tools.canvas.production.contracts import CostEstimateRecord
from app.tools.canvas.production.estimation.cost_estimate_repository_interface import CostEstimateRepositoryInterface


class InMemoryCostEstimateRepository(CostEstimateRepositoryInterface):
    """为单进程运行时保存不可变预估凭证。"""

    def __init__(self) -> None:
        """初始化空记录集合。"""
        self._records: dict[str, CostEstimateRecord] = {}

    async def put(self, record: CostEstimateRecord) -> None:
        """按 estimate_id 保存记录。"""
        self._records[record.estimate_id] = record

    async def get(self, estimate_id: str) -> CostEstimateRecord | None:
        """按 estimate_id 返回记录。"""
        return self._records.get(estimate_id)
