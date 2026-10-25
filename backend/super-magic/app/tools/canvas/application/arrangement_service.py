"""已有元素的相对排列；位置计算不依赖模型估算坐标。"""

from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field, model_validator

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.models.element_properties import ElementProperties
from app.tools.canvas.domain.services.spatial_geometry import CanvasRect, CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.strategies.layout.geometry import DEFAULT_ELEMENT_SPACING
from app.tools.canvas.strategies.layout.plan import LayoutMutationPlan
from app.tools.core.base_tool_params import BaseToolParams


class Arrangement(BaseToolParams):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    element_ids: list[str] = Field(min_length=1)
    operation: Literal["arrange", "align", "distribute"] = "arrange"
    pattern: Literal["row", "column", "grid"] = "row"
    anchor_element_ids: list[str] | None = None
    side: Literal["left", "right", "above", "below"] = "right"
    alignment: Literal["start", "center", "end"] = "start"
    columns: int | None = Field(None, ge=1)
    gap: float = Field(DEFAULT_ELEMENT_SPACING, ge=0)
    direction: Literal["left", "center", "right", "top", "middle", "bottom", "horizontal", "vertical"] = "left"
    dry_run: bool = False
    scope: Literal["selection", "children"] = "selection"

    @model_validator(mode="after")
    def validate_operation(self) -> "Arrangement":
        common = {"project_path", "element_ids", "operation", "dry_run"}
        allowed = {
            "arrange": {"pattern", "anchor_element_ids", "side", "alignment", "columns", "gap"},
            "align": {"direction", "scope"},
            "distribute": {"direction", "scope", "gap", "anchor_element_ids", "side", "alignment"},
        }
        if self.model_fields_set - common - allowed[self.operation]:
            raise ValueError("Parameters for arrangement, alignment and distribution must not be mixed")
        if self.operation == "arrange" and ((self.pattern == "grid") != (self.columns is not None)):
            raise ValueError("columns is required only for grid")
        if self.operation == "distribute" and self.direction not in {"horizontal", "vertical"}:
            raise ValueError("Distribution requires horizontal/vertical direction")
        return self


class ArrangementService:
    def __init__(self, repository: CanvasRepositoryInterface):
        self.repository = repository

    async def arrange(self, project_path: str, request: Arrangement) -> JsonObject:
        if request.dry_run:
            return self._calculate(await self.repository.read(project_path), request, apply=False)
        return await self.repository.transaction(
            project_path, lambda project: self._calculate(project, request, apply=True)
        )

    def _calculate(self, project: CanvasProject, request: Arrangement, *, apply: bool) -> JsonObject:
        canvas = project.canvas
        geometry = CanvasSpatialGeometry(canvas)
        frame_bounds: CanvasRect | None = None
        if request.scope == "children":
            if len(request.element_ids) != 1 or request.operation == "arrange":
                raise CanvasDomainError(
                    "FRAME_REQUIRED", "children scope requires one Frame and align/distribute operation."
                )
            frame = geometry.assert_mutable(request.element_ids[0])
            if frame.element_type != "frame" or frame.opaque_children:
                raise CanvasDomainError("FRAME_REQUIRED", "Select a fully decoded Frame.")
            geometry.bounds(frame.element_id)
            frame_bounds = CanvasRect(0, 0, float(frame.properties.width), float(frame.properties.height))
            request = request.model_copy(
                update={
                    "element_ids": [
                        child.element_id for child in frame.children or [] if geometry.visible(child.element_id)
                    ]
                }
            )
        ids = request.element_ids
        if not ids or len(set(ids)) != len(ids):
            raise CanvasDomainError("INVALID_SELECTION", "Select distinct, exact Element IDs.")
        targets = [geometry.assert_mutable(element_id) for element_id in ids]
        if any(not geometry.visible(element_id) for element_id in ids):
            raise CanvasDomainError("ELEMENT_HIDDEN", "Hidden Elements cannot be arranged; reveal them manually first.")
        anchors = request.anchor_element_ids or []
        if set(anchors) & set(ids):
            raise CanvasDomainError("INVALID_ANCHOR", "Reference Elements must not also be moving Elements.")
        for anchor_id in anchors:
            geometry.require(anchor_id)
        if len({geometry.parents[element_id] for element_id in [*ids, *anchors]}) != 1:
            raise CanvasDomainError(
                "DIFFERENT_PARENTS", "Moving and reference Elements must have the same immediate parent."
            )
        rectangles = [geometry.bounds(element_id, world=frame_bounds is None) for element_id in ids]
        if frame_bounds is not None and request.operation == "distribute":
            # Frame ID 没有显式子元素顺序，沿目标轴保留现有空间顺序；普通选择按传入 ID 排列。
            ordered = sorted(
                zip(ids, targets, rectangles),
                key=lambda item: item[2].x if request.direction == "horizontal" else item[2].y,
            )
            ids = [item[0] for item in ordered]
            targets = [item[1] for item in ordered]
            rectangles = [item[2] for item in ordered]
        original = CanvasRect.enclosing(rectangles)
        layout_request = request
        if request.operation == "distribute":
            # 例：宽 600/1000/700、间距 200，横排宽度为 2700；旧范围 1900 不限制新排列。
            # 复用行列布局与避让，不能通过压缩间距把大图挤进旧包围盒或当前视口。
            layout_request = request.model_copy(
                update={"pattern": "row" if request.direction == "horizontal" else "column"}
            )
        if request.operation != "align":
            parent_id = geometry.parents[ids[0]]
            if (parent_id and geometry.require(parent_id).opaque_children) or (
                parent_id is None and canvas.opaque_elements
            ):
                raise CanvasDomainError(
                    "GEOMETRY_UNAVAILABLE",
                    "Some sibling Elements cannot be decoded; collision-free placement cannot be calculated safely.",
                )
            positions = self._pattern(rectangles, layout_request)
            group = CanvasRect.enclosing(
                [CanvasRect(x, y, r.width, r.height) for r, (x, y) in zip(rectangles, positions)]
            )
            reference = (
                CanvasRect.enclosing([geometry.bounds(a, world=frame_bounds is None) for a in anchors])
                if anchors
                else original
            )
            origin = self._origin(reference, group, layout_request) if anchors else (original.x, original.y)
            positions = [(x + origin[0], y + origin[1]) for x, y in positions]
            obstacles = [
                geometry.bounds(e.element_id, world=frame_bounds is None)
                for e in canvas.siblings(ids[0])
                if e.element_id not in ids and geometry.visible(e.element_id)
            ]
            positions = self._avoid(rectangles, positions, obstacles, layout_request, bool(anchors))
        else:
            positions = self._aligned(rectangles, original, request)
        changes: list[JsonObject] = []
        for element, rectangle, (x, y) in zip(targets, rectangles, positions):
            current = element.properties
            dx, dy = x - rectangle.x, y - rectangle.y
            parent_id = geometry.parents[element.element_id]
            if parent_id and frame_bounds is None:
                parent_transform = geometry.world_transform(parent_id)
                determinant = parent_transform.a * parent_transform.d - parent_transform.b * parent_transform.c
                if determinant == 0:
                    raise CanvasDomainError("GEOMETRY_UNAVAILABLE", "The parent transform is not invertible.")
                dx, dy = (
                    (parent_transform.d * dx - parent_transform.c * dy) / determinant,
                    (-parent_transform.b * dx + parent_transform.a * dy) / determinant,
                )
            new_x, new_y = float(current.x) + dx, float(current.y) + dy
            if parent_id and geometry.require(parent_id).element_type == "frame":
                geometry.bounds(parent_id)
                local = geometry.bounds(element.element_id, world=False)
                parent = geometry.require(parent_id).properties
                if (
                    local.x + dx < 0
                    or local.y + dy < 0
                    or local.right + dx > float(parent.width)
                    or local.bottom + dy > float(parent.height)
                ):
                    raise CanvasDomainError(
                        "LAYOUT_OUTSIDE_FRAME",
                        "The requested layout does not fit inside the parent Frame; no Elements were moved.",
                    )
            changed = new_x != current.x or new_y != current.y
            changes.append(
                {
                    "element_id": element.element_id,
                    "name": current.name,
                    "before": {"x": current.x, "y": current.y},
                    "after": {"x": new_x, "y": new_y},
                    "status": "changed" if changed else "unchanged",
                    "size_source": "placeholder"
                    if any(c.fields.generation_status in {"pending", "processing"} for c in element.contents)
                    else "document",
                }
            )
            if apply and changed:
                LayoutMutationPlan(element.element_id, ElementProperties(x=new_x, y=new_y)).apply(canvas)
        return {
            "operation": request.operation,
            "dry_run": request.dry_run,
            "items": changes,
            "bounds_coordinate_space": "frame-local" if frame_bounds else "world",
            "before_bounds": original.to_dict(),
            "direction": request.direction if request.operation == "align" else layout_request.pattern,
            **({"gap": request.gap} if request.operation != "align" else {}),
            "bounds": CanvasRect.enclosing(
                [CanvasRect(x, y, r.width, r.height) for r, (x, y) in zip(rectangles, positions)]
            ).to_dict(),
        }

    @staticmethod
    def _pattern(rectangles: list[CanvasRect], request: Arrangement) -> list[tuple[float, float]]:
        columns = len(rectangles) if request.pattern == "row" else 1
        if request.pattern == "grid":
            if request.columns is None or request.columns < 1:
                raise CanvasDomainError("COLUMNS_REQUIRED", "Grid arrangement requires a positive column count.")
            columns = min(request.columns, len(rectangles))
        rows = (len(rectangles) + columns - 1) // columns
        widths = [max(r.width for i, r in enumerate(rectangles) if i % columns == column) for column in range(columns)]
        heights = [max(r.height for r in rectangles[row * columns : (row + 1) * columns]) for row in range(rows)]
        return [
            (
                sum(widths[: i % columns]) + request.gap * (i % columns),
                sum(heights[: i // columns]) + request.gap * (i // columns),
            )
            for i in range(len(rectangles))
        ]

    @staticmethod
    def _origin(anchor: CanvasRect, group: CanvasRect, request: Arrangement) -> tuple[float, float]:
        fraction = {"start": 0, "center": 0.5, "end": 1}[request.alignment]
        x, y = anchor.x + (anchor.width - group.width) * fraction, anchor.y + (anchor.height - group.height) * fraction
        if request.side == "right":
            x = anchor.right + request.gap
        elif request.side == "left":
            x = anchor.x - group.width - request.gap
        elif request.side == "below":
            y = anchor.bottom + request.gap
        else:
            y = anchor.y - group.height - request.gap
        return x, y

    @staticmethod
    def _avoid(
        rectangles: list[CanvasRect],
        positions: list[tuple[float, float]],
        obstacles: list[CanvasRect],
        request: Arrangement,
        can_shift: bool,
    ) -> list[tuple[float, float]]:
        # 保留整组结构，只向用户指定的一侧平移；每次越过一个障碍边界，循环有有限上限。
        for _ in range(len(obstacles) + 1):
            moved = [CanvasRect(x, y, r.width, r.height) for r, (x, y) in zip(rectangles, positions)]
            collisions = [o for o in obstacles if any(r.intersects(o) for r in moved)]
            if not collisions:
                return positions
            if not can_shift:
                raise CanvasDomainError(
                    "LAYOUT_COLLISION",
                    "The arrangement overlaps unselected Elements. Choose a reference Element and placement side.",
                )
            group = CanvasRect.enclosing(moved)
            dx = dy = 0.0
            if request.side == "right":
                dx = max(o.right for o in collisions) + request.gap - group.x
            elif request.side == "left":
                dx = min(o.x for o in collisions) - request.gap - group.right
            elif request.side == "below":
                dy = max(o.bottom for o in collisions) + request.gap - group.y
            else:
                dy = min(o.y for o in collisions) - request.gap - group.bottom
            positions = [(x + dx, y + dy) for x, y in positions]
        raise CanvasDomainError("LAYOUT_COLLISION", "No collision-free relative placement was found.")

    @staticmethod
    def _aligned(rectangles: list[CanvasRect], group: CanvasRect, request: Arrangement) -> list[tuple[float, float]]:
        direction = request.direction
        if direction not in {"left", "center", "right", "top", "middle", "bottom"}:
            raise CanvasDomainError("INVALID_ALIGNMENT", "Alignment requires left/center/right/top/middle/bottom.")
        return [
            (
                group.x
                if direction == "left"
                else group.x + (group.width - r.width) / 2
                if direction == "center"
                else group.right - r.width
                if direction == "right"
                else r.x,
                group.y
                if direction == "top"
                else group.y + (group.height - r.height) / 2
                if direction == "middle"
                else group.bottom - r.height
                if direction == "bottom"
                else r.y,
            )
            for r in rectangles
        ]
