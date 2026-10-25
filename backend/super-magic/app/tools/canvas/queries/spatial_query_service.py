"""按有限空间查询画布；清单分页不改变查看范围。"""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Literal

from pydantic import ConfigDict, Field, model_validator

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.services.spatial_geometry import CanvasRect, CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.core.base_tool_params import BaseToolParams


class RegionInput(BaseToolParams):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class SpatialQuery(BaseToolParams):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    scope: Literal["around", "frame", "region", "all"] = "around"
    anchor_element_ids: list[str] = Field(default_factory=list)
    frame_element_id: str | None = None
    region: RegionInput | None = None
    context_scale: float = Field(3, ge=1)
    view_width: float | None = Field(None, gt=0)
    view_height: float | None = Field(None, gt=0)
    query: str | None = None
    include_hidden: bool = False
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=100)

    @model_validator(mode="after")
    def validate_scope(self) -> SpatialQuery:
        common = {"project_path", "scope", "query", "include_hidden", "page", "limit"}
        allowed = {
            "around": {"anchor_element_ids", "context_scale", "view_width", "view_height"},
            "frame": {"frame_element_id"},
            "region": {"region"},
            "all": set(),
        }
        if self.model_fields_set - common - allowed[self.scope]:
            raise ValueError("Parameters for different query scopes must not be mixed")
        if self.scope == "around" and not self.anchor_element_ids:
            raise ValueError("around requires anchor_element_ids")
        if self.scope == "frame" and not self.frame_element_id:
            raise ValueError("frame requires frame_element_id")
        if self.scope == "region" and self.region is None:
            raise ValueError("region requires region")
        if (self.view_width is None) != (self.view_height is None):
            raise ValueError("view_width and view_height must be specified together")
        if self.view_width is not None and "context_scale" in self.model_fields_set:
            raise ValueError("Use either view dimensions or context_scale")
        return self


class SpatialQueryService:
    def __init__(self, repository: CanvasRepositoryInterface):
        self.repository = repository

    async def query(self, project_path: str, request: SpatialQuery) -> JsonObject:
        project = await self.repository.read(project_path)
        geometry = CanvasSpatialGeometry(project.canvas)
        area = self._area(geometry, request)
        anchor = (
            CanvasRect.enclosing([geometry.bounds(value) for value in request.anchor_element_ids])
            if request.anchor_element_ids
            else None
        )
        matched: list[JsonObject] = []
        warnings: list[str] = []
        hidden_count = 0
        for element in geometry.elements.values():
            visible = geometry.visible(element.element_id)
            if not visible:
                hidden_count += 1
                if not request.include_hidden:
                    continue
            if request.scope == "frame" and element.element_id != request.frame_element_id:
                if request.frame_element_id not in [e.element_id for e in geometry.ancestors(element.element_id)]:
                    continue
            content = element.get_content(element.active_content_id)
            asset_path = content.fields.asset_path if content else None
            file_name = PurePosixPath(asset_path).name if asset_path else None
            if (
                request.query
                and request.query.casefold() not in f"{element.properties.name or ''}\n{file_name or ''}".casefold()
            ):
                continue
            rect: CanvasRect | None = None
            displayed: CanvasRect | None = None
            try:
                rect = geometry.bounds(element.element_id)
                displayed = geometry.visible_bounds(element.element_id)
                if not request.include_hidden and displayed is None:
                    continue
            except CanvasDomainError:
                rect = None
                warnings.append(f"Element {element.element_id} has unavailable display geometry.")
                if area is not None:
                    continue
            if (
                rect is not None
                and area is not None
                and not (rect if request.include_hidden else displayed).intersects(area)
            ):
                continue
            item: JsonObject = {
                "element_id": element.element_id,
                "type": element.element_type,
                "name": element.properties.name,
                "parent_element_id": geometry.parents[element.element_id],
                "position": {"x": element.properties.x, "y": element.properties.y},
                "world_bounds": rect.to_dict() if rect else None,
                "visible_bounds": displayed.to_dict() if rect and displayed else None,
                "visible": visible,
                "locked": any(e.properties.locked is True for e in [element, *geometry.ancestors(element.element_id)]),
                "content_count": len(element.contents),
                "active_content_id": element.active_content_id,
                "main_content_id": element.main_content_id,
                "file_name": file_name,
                "status": content.fields.generation_status if content else None,
                "cropped": bool(
                    rect
                    and area
                    and (rect.x < area.x or rect.y < area.y or rect.right > area.right or rect.bottom > area.bottom)
                ),
            }
            if anchor and rect and element.element_id not in request.anchor_element_ids:
                item["relation"] = self._relation(anchor, rect)
            matched.append(item)
        start = (request.page - 1) * request.limit
        return {
            "project_path": project_path,
            "scope": request.scope,
            "anchor_element_ids": request.anchor_element_ids,
            "world_bounds": area.to_dict() if area else None,
            "anchor_bounds": anchor.to_dict() if anchor else None,
            "total_elements": len(geometry.elements),
            "matched": len(matched),
            "hidden_elements": hidden_count,
            "page": request.page,
            "limit": request.limit,
            "has_more": start + request.limit < len(matched),
            "elements": matched[start : start + request.limit],
            "geometry_complete": not warnings
            and not project.canvas.opaque_elements
            and not any(e.opaque_children for e in geometry.elements.values()),
            "warnings": warnings,
        }

    @staticmethod
    def _area(geometry: CanvasSpatialGeometry, request: SpatialQuery) -> CanvasRect | None:
        if request.scope == "around":
            if not request.anchor_element_ids:
                raise CanvasDomainError(
                    "ANCHOR_REQUIRED",
                    "around requires exact anchor_element_ids; find it with the text overview first.",
                )
            anchor = CanvasRect.enclosing([geometry.bounds(value) for value in request.anchor_element_ids])
            width = request.view_width if request.view_width is not None else anchor.width * request.context_scale
            height = request.view_height if request.view_height is not None else anchor.height * request.context_scale
            return CanvasRect(
                anchor.x + (anchor.width - width) / 2, anchor.y + (anchor.height - height) / 2, width, height
            )
        if request.scope == "frame":
            if not request.frame_element_id or geometry.require(request.frame_element_id).element_type != "frame":
                raise CanvasDomainError("FRAME_REQUIRED", "frame requires an exact Frame Element ID.")
            return geometry.bounds(request.frame_element_id)
        if request.scope == "region":
            if request.region is None:
                raise CanvasDomainError("REGION_REQUIRED", "region requires explicit world-coordinate bounds.")
            return CanvasRect(**request.region.model_dump())
        return None

    @staticmethod
    def _relation(anchor: CanvasRect, rect: CanvasRect) -> JsonObject:
        # 空间斜向可以同时满足左右和上下；不要把它伪装成业务依赖。
        if anchor.intersects(rect):
            return {"overlaps": True}
        result: JsonObject = {"overlaps": False}
        if rect.x >= anchor.right:
            result["horizontal"] = "right"
            result["horizontal_gap"] = rect.x - anchor.right
        elif rect.right <= anchor.x:
            result["horizontal"] = "left"
            result["horizontal_gap"] = anchor.x - rect.right
        if rect.y >= anchor.bottom:
            result["vertical"] = "below"
            result["vertical_gap"] = rect.y - anchor.bottom
        elif rect.bottom <= anchor.y:
            result["vertical"] = "above"
            result["vertical_gap"] = anchor.y - rect.bottom
        return result
