"""Video Edit Content 的项目语义校验服务。"""

from app.tools.canvas.domain.content_fields.video_edit import VideoEditContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject


class VideoEditContentValidator:
    """校验 Video Edit 引用的媒体类型和显式输入连线。"""

    @classmethod
    def validate(
        cls,
        project: CanvasProject,
        video_edit_element_id: str,
        fields: VideoEditContentFields,
    ) -> None:
        """在项目事务内校验序列引用及媒体到 Video Edit 的 Connection。"""
        fields.validate()
        video_edit = project.canvas.get_element(video_edit_element_id)
        if video_edit is None or video_edit.element_type != "video-edit":
            raise CanvasDomainError(
                "VIDEO_EDIT_ELEMENT_INVALID",
                f"Video Edit Element does not exist: {video_edit_element_id}.",
            )

        cls._validate_element_types(project, fields.video_sequence, "video", "videoSequence")
        cls._validate_element_types(project, fields.audio_sequence, "audio", "audioSequence")

        connected_sources = {
            connection.source_element_id
            for connection in project.canvas.connections
            if connection.target_element_id == video_edit_element_id
        }
        required_sources = [*fields.video_sequence, *fields.audio_sequence]
        missing_sources = [element_id for element_id in required_sources if element_id not in connected_sources]
        if missing_sources:
            raise CanvasDomainError(
                "VIDEO_EDIT_CONNECTION_MISSING",
                "Video Edit inputs must be connected when the Content is created: "
                + ", ".join(missing_sources)
                + ".",
            )

    @staticmethod
    def _validate_element_types(
        project: CanvasProject,
        element_ids: list[str],
        expected_type: str,
        field_name: str,
    ) -> None:
        """保证序列中的 Element 存在且类型与字段语义一致。"""
        for element_id in element_ids:
            element = project.canvas.get_element(element_id)
            if element is None:
                raise CanvasDomainError(
                    "VIDEO_EDIT_INPUT_NOT_FOUND",
                    f"{field_name} references a missing Element: {element_id}.",
                )
            if element.element_type != expected_type:
                raise CanvasDomainError(
                    "VIDEO_EDIT_INPUT_TYPE_MISMATCH",
                    f"{field_name} must reference {expected_type.title()} Elements: {element_id}.",
                )
