"""生成结果 Canvas 回写器。"""

from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject


class CanvasGenerationResultApplier:
    """校验任务目标并把生成结果写回 Canvas Content。"""

    @staticmethod
    def apply(
        project: CanvasProject,
        element_id: str,
        content_id: str,
        status: str,
        output_uri: str | None,
        error_message: str | None,
        result_metadata: dict[str, object] | None = None,
    ) -> None:
        """只修改程序托管的生成状态和结果字段。"""
        element = project.canvas.get_element(element_id)
        content = element.get_content(content_id) if element else None
        if content is None:
            raise CanvasDomainError("CONTENT_NOT_FOUND", "Generated Content no longer exists.")
        if not isinstance(content.fields, GeneratedMediaContentFields):
            raise CanvasDomainError("CONTENT_GENERATION_UNSUPPORTED", "The target Content does not support generation results.")
        content.fields.update_generation_result(status, output_uri, error_message)
        if isinstance(content.fields, VideoContentFields) and result_metadata is not None:
            content.fields.replace_generation_result_metadata(result_metadata)
