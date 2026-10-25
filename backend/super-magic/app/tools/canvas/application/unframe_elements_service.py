"""取消画框只释放子元素；不递归删除内容或文件。"""

from __future__ import annotations

import math

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.services.spatial_geometry import CanvasSpatialGeometry
from app.tools.canvas.domain.types import JsonObject
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService


class UnframeElementsService:
    def __init__(self, repository: CanvasRepositoryInterface):
        self.repository = repository

    async def unframe(self, project_path: str, element_ids: list[str]) -> JsonObject:
        def change(project: CanvasProject, sidecar: dict) -> tuple[JsonObject, dict]:
            canvas = project.canvas
            geometry = CanvasSpatialGeometry(canvas)
            if not element_ids or len(set(element_ids)) != len(element_ids):
                raise CanvasDomainError("INVALID_SELECTION", "Select distinct exact Frame IDs.")
            frames = [geometry.assert_mutable(element_id) for element_id in element_ids]
            if (
                any(frame.element_type != "frame" or frame.opaque_children for frame in frames)
                or canvas.opaque_connections
            ):
                raise CanvasDomainError(
                    "FRAME_REQUIRED", "Only fully decoded Frames and connections can be unframed safely."
                )
            if any(
                parent.element_id in element_ids for frame in frames for parent in geometry.ancestors(frame.element_id)
            ):
                raise CanvasDomainError(
                    "NESTED_SELECTION", "Unframe nested Frames in separate calls, starting with the inner Frame."
                )
            results: list[JsonObject] = []
            for frame in frames:
                children = sorted(frame.children or [], key=lambda e: e.properties.z_index or 0)
                siblings = canvas.siblings(frame.element_id)
                index = next(i for i, sibling in enumerate(siblings) if sibling.element_id == frame.element_id)
                parent_id = geometry.parents[frame.element_id]
                z = frame.properties.z_index or 0
                higher = [
                    e.properties.z_index
                    for e in siblings
                    if e.properties.z_index is not None and e.properties.z_index > z
                ]
                top = min(higher) if higher else z + 1
                for child_index, child in enumerate(children):
                    geometry.assert_mutable(child.element_id)
                    transform = geometry.local_transform(frame.element_id).compose(
                        geometry.local_transform(child.element_id)
                    )
                    sx = math.hypot(transform.a, transform.b)
                    if sx == 0 or not math.isclose(
                        transform.a * transform.c + transform.b * transform.d, 0, abs_tol=1e-9
                    ):
                        raise CanvasDomainError(
                            "TRANSFORM_UNSUPPORTED",
                            "This Frame produces a shear or zero scale that cannot be preserved by the current Element protocol.",
                        )
                    child.properties.x, child.properties.y = transform.x, transform.y
                    child.properties.scale_x = sx
                    child.properties.scale_y = (transform.a * transform.d - transform.b * transform.c) / sx
                    child.extra_data["rotation"] = math.degrees(math.atan2(transform.b, transform.a))
                    child.properties.z_index = z + (top - z) * (child_index + 1) / (len(children) + 1)
                    if frame.properties.visible is False:
                        child.properties.visible = False
                    child.properties.opacity = (
                        child.properties.opacity if child.properties.opacity is not None else 1
                    ) * (frame.properties.opacity if frame.properties.opacity is not None else 1)
                frame.children = []
                canvas.remove_element(frame.element_id)
                ContentMetadataService.remove(sidecar, frame.element_id)
                for offset, child in enumerate(children):
                    canvas.insert_element(child, parent_id, index + offset)
                results.append(
                    {
                        "element_id": frame.element_id,
                        "name": frame.properties.name,
                        "status": "unframed",
                        "child_element_ids": [child.element_id for child in children],
                    }
                )
            removed = set(element_ids)
            canvas.connections = [
                connection
                for connection in canvas.connections
                if connection.source_element_id not in removed and connection.target_element_id not in removed
            ]
            return {"project_path": project_path, "items": results}, sidecar

        result = await self.repository.transaction_with_sidecar(project_path, change)
        try:
            user = await self.repository.read_sidecar(project_path, "element-details-user.json")
            if user:
                for element_id in element_ids:
                    ContentMetadataService.remove(user, element_id)
                await self.repository.write_sidecar(project_path, user, "element-details-user.json")
            result["complete"] = True
        except Exception:
            result["complete"] = False
            result["warning"] = "Frames were removed, but their user detail metadata could not be cleaned up."
            for item in result["items"]:
                item["status"] = "partial"
                item["error_code"] = "METADATA_CLEANUP_FAILED"
        return result
