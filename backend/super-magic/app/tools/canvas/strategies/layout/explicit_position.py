"""显式坐标布局策略。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasDocument, CanvasElement
from app.tools.canvas.domain.models.element_properties import ElementProperties
from app.tools.canvas.strategies.layout.geometry import next_z_index, number
from app.tools.canvas.strategies.layout.interface import LayoutStrategyInterface
from app.tools.canvas.strategies.layout.plan import LayoutMutationPlan
from app.tools.canvas.strategies.layout.request import LayoutStrategyRequest


class ExplicitPositionLayoutStrategy(LayoutStrategyInterface):
    """只在用户明确提供坐标时写入显式位置。"""

    name = "explicit_position"

    def plan(
        self,
        canvas: CanvasDocument,
        element: CanvasElement,
        request: LayoutStrategyRequest,
    ) -> LayoutMutationPlan:
        """校验并写入用户提供的 x、y 坐标。"""
        position = request.options.position
        if position is None:
            raise CanvasDomainError("EXPLICIT_POSITION_REQUIRED", "Explicit positioning requires x and y.")
        changes = ElementProperties(x=position[0], y=position[1])
        if number(element.properties.z_index) is None:
            changes.z_index = next_z_index(canvas, element)
        return LayoutMutationPlan(element.element_id, changes)
