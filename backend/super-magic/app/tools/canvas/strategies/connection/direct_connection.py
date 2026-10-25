"""直接连线策略。"""

import uuid

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasConnection, CanvasDocument
from app.tools.canvas.strategies.connection.interface import ConnectionStrategyInterface
from app.tools.canvas.strategies.connection.plan import ConnectionMutationPlan
from app.tools.canvas.strategies.connection.request import ConnectionStrategyRequest


class DirectConnectionStrategy(ConnectionStrategyInterface):
    """处理 Element 之间的直接有向关系。"""

    name = "direct"

    def plan(
        self,
        canvas: CanvasDocument,
        request: ConnectionStrategyRequest,
    ) -> ConnectionMutationPlan:
        """新增或幂等返回同向关系的变更计划。"""
        source = request.source_element_id
        target = request.target_element_id
        if canvas.get_element(source) is None or canvas.get_element(target) is None:
            raise CanvasDomainError("ELEMENT_NOT_FOUND", "Connection endpoints must reference existing Elements.")
        if source == target:
            raise CanvasDomainError("INVALID_CONNECTION", "A Connection cannot point to the same Element.")
        existing = next(
            (item for item in canvas.connections if item.source_element_id == source and item.target_element_id == target),
            None,
        )
        if existing is not None:
            return ConnectionMutationPlan(existing, already_exists=True)
        return ConnectionMutationPlan(CanvasConnection(f"connection-{uuid.uuid4().hex[:16]}", source, target))
