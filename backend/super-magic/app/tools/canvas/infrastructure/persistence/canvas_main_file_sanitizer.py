"""Canvas 主文件写入前的协议字段净化。"""

from __future__ import annotations

from app.tools.canvas.domain.content_fields import GeneratedMediaContentFields
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService


class CanvasMainFileSanitizer:
    """从前端主文件中移除只属于后端 sidecar 的生成请求字段。"""

    def sanitize(self, project: CanvasProject) -> CanvasProject:
        """返回不包含后端托管生成请求的项目副本。"""
        sanitized = project.clone()
        for element in sanitized.canvas.iter_elements():
            for content in element.contents:
                fields = content.fields
                if isinstance(fields, GeneratedMediaContentFields):
                    fields.clear_sidecar_fields()
        return sanitized

    def synchronize_sidecar(self, project: CanvasProject, sidecar: dict) -> dict:
        """把仍存在于领域对象中的后端托管字段补入 sidecar。"""
        updated = dict(sidecar)
        for element in project.canvas.iter_elements():
            for content in element.contents:
                fields = content.fields
                managed = self._managed_fields(content.fields)
                if not managed:
                    continue
                detail = ContentMetadataService.get(updated, element.element_id, content.content_id)
                detail.update(managed)
                ContentMetadataService.set(updated, element.element_id, content.content_id, detail)
        return updated

    @staticmethod
    def _managed_fields(fields) -> dict[str, object]:
        """提取不应进入主文件的生成请求字段。"""
        if isinstance(fields, GeneratedMediaContentFields):
            managed: dict[str, object] = {}
            request_field = fields.generated_request_field
            request = fields.to_dict().get(request_field) if request_field else None
            if fields.status == "completed" and isinstance(request, dict):
                managed[request_field] = request
            if fields.visual_understanding is not None:
                managed["visualUnderstanding"] = fields.visual_understanding
            return managed
        return {}
