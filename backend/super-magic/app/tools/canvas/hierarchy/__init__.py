"""Canvas 层级能力的兼容导出入口。"""

from app.tools.canvas.domain.services.coordinate_space_resolver import CoordinateSpaceResolver
from app.tools.canvas.domain.services.element_reference_resolver import ElementReferenceResolver
from app.tools.canvas.domain.services.element_tree_index import ElementTreeIndex
from app.tools.canvas.hierarchy.mutation_plan import HierarchyMutationPlan
from app.tools.canvas.strategies.hierarchy import (
    FrameSelectionPlan,
    FrameSelectionRequest,
    FrameSelectionStrategy,
    HierarchyStrategyRegistry,
)

__all__ = [
    "CoordinateSpaceResolver",
    "ElementReferenceResolver",
    "ElementTreeIndex",
    "FrameSelectionPlan",
    "FrameSelectionRequest",
    "FrameSelectionStrategy",
    "HierarchyMutationPlan",
    "HierarchyStrategyRegistry",
]
