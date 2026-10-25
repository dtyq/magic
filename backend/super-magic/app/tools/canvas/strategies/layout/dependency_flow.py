"""依赖流布局策略。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasDocument, CanvasElement
from app.tools.canvas.domain.models.element_properties import ElementProperties
from app.tools.canvas.strategies.layout.geometry import height, next_z_index, number, overlaps, width
from app.tools.canvas.strategies.layout.interface import LayoutStrategyInterface
from app.tools.canvas.strategies.layout.plan import LayoutMutationPlan
from app.tools.canvas.strategies.layout.request import LayoutStrategyRequest


class DependencyFlowLayoutStrategy(LayoutStrategyInterface):
    """根据直接上游语义提供稳定的流程布局。"""

    name = "dependency_flow"
    horizontal_gap = 560.0
    vertical_gap = 240.0

    def plan(
        self,
        canvas: CanvasDocument,
        element: CanvasElement,
        request: LayoutStrategyRequest,
    ) -> LayoutMutationPlan:
        """把目标放在直接上游右侧，并向下避让碰撞。"""
        parent_id = canvas.parent_map().get(element.element_id)
        occupied = [
            item
            for item in canvas.siblings(element.element_id)
            if item.element_id != element.element_id
            and number(item.properties.x) is not None
            and number(item.properties.y) is not None
        ]
        source_ids = [
            connection.source_element_id
            for connection in canvas.connections
            if connection.target_element_id == element.element_id
        ]
        sources = [canvas.get_element(source_id) for source_id in dict.fromkeys(source_ids)]
        sources = [source for source in sources if source is not None]
        parent_map = canvas.parent_map()
        if any(parent_map.get(source.element_id) != parent_id for source in sources):
            raise CanvasDomainError(
                "LAYOUT_CROSS_CONTAINER_UNSUPPORTED",
                "Dependency layout requires all connected Elements to share the same direct parent.",
            )
        if sources:
            if any(number(source.properties.x) is None or number(source.properties.y) is None for source in sources):
                raise CanvasDomainError("LAYOUT_SOURCE_UNPOSITIONED", "Dependency layout requires positioned upstream Elements.")
            preferred_x = max(float(source.properties.x or 0.0) + width(source) for source in sources) + self.horizontal_gap
            source_top = min(float(source.properties.y or 0.0) for source in sources)
            source_bottom = max(
                float(source.properties.y or 0.0) + height(source)
                for source in sources
            )
            preferred_y = source_top + max(
                0.0,
                (source_bottom - source_top - height(element)) / 2,
            )
        else:
            preferred_x = 0.0
            root_column = [item for item in occupied if abs(float(item.properties.x or 0.0)) < 1.0]
            preferred_y = (
                max(float(item.properties.y or 0.0) + height(item) for item in root_column) + self.vertical_gap
                if root_column
                else 0.0
            )
        x, y = self._find_available(element, preferred_x, preferred_y, occupied)
        changes = ElementProperties(x=x, y=y)
        if number(element.properties.z_index) is None:
            changes.z_index = next_z_index(canvas, element)
        return LayoutMutationPlan(element.element_id, changes)

    def _find_available(
        self,
        element: CanvasElement,
        preferred_x: float,
        preferred_y: float,
        occupied: list[CanvasElement],
    ) -> tuple[float, float]:
        """从首选位置开始只向下寻找无碰撞位置。"""
        candidate_y = preferred_y
        while True:
            collisions = [item for item in occupied if overlaps(element, preferred_x, candidate_y, item)]
            if not collisions:
                return preferred_x, candidate_y
            candidate_y = max(float(item.properties.y or 0.0) + height(item) for item in collisions) + self.vertical_gap
