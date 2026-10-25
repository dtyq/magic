"""布局策略变更计划。"""

from dataclasses import dataclass

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasDocument
from app.tools.canvas.domain.models.element_properties import ElementProperties


@dataclass(frozen=True)
class LayoutMutationPlan:
    """封装布局策略计算出的最小字段变更。"""

    element_id: str
    properties: ElementProperties

    def apply(self, canvas: CanvasDocument) -> None:
        """把布局变更应用到当前内存 Canvas 快照。"""
        element = canvas.get_element(self.element_id)
        if element is None:
            raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {self.element_id} does not exist.")
        current = element.properties
        if self.properties.x is not None:
            current.x = self.properties.x
        if self.properties.y is not None:
            current.y = self.properties.y
        if self.properties.width is not None:
            current.width = self.properties.width
        if self.properties.height is not None:
            current.height = self.properties.height
        if self.properties.scale_x is not None:
            current.scale_x = self.properties.scale_x
        if self.properties.scale_y is not None:
            current.scale_y = self.properties.scale_y
        if self.properties.z_index is not None:
            current.z_index = self.properties.z_index
