"""Canvas 视频合成应用服务。"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path, PurePosixPath

from app.tools.canvas.application.results import CanvasVideoCompositionResult
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.video_resolution import parse_resolution_short_side
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.infrastructure.workspace import CanvasFileReadinessChecker
from app.tools.canvas.production.contracts import (
    CompositionInputSpec,
    CompositionOutput,
    CompositionPreparation,
    ContentProductionRuleInterface,
    ProductionResultType,
)
from app.tools.canvas.production.ports import VideoCompositionPort, VideoCompositionRequest, VideoCompositionResult
from app.tools.canvas.repository import CanvasUnitOfWork
from app.utils.async_file_utils import async_exists


class VideoCompositionService:
    """解析独立合成请求、管理 processing Content 并执行合成端口。"""

    def __init__(self, unit_of_work: CanvasUnitOfWork, composition_port: VideoCompositionPort, production_rule: ContentProductionRuleInterface, workspace: Path) -> None:
        """显式绑定事务、合成端口和工作区。"""
        self._unit_of_work = unit_of_work
        self._composition_port = composition_port
        if production_rule.result_type is not ProductionResultType.SINGLE_CONTENT:
            raise ValueError("video_composition must produce a single Content result")
        self._production_rule = production_rule
        self._workspace = workspace
        self._file_readiness = CanvasFileReadinessChecker(workspace)

    async def compose(
        self,
        project_path: str,
        result_name: str,
        result_element_id: str,
        tool_context=None,
        result_content_id: str | None = None,
        retry_count: int = 0,
        input_spec: CompositionInputSpec | None = None,
    ) -> CanvasVideoCompositionResult:
        """创建 processing Content、同步合成并写回完成或失败状态。"""
        if not result_content_id:
            raise CanvasDomainError(
                "CONTENT_NOT_FOUND",
                "Composition requires the Content created by add_canvas_elements.",
            )
        output_path = await self._output_path(project_path, result_name)
        preparation: CompositionPreparation | None = None
        try:
            preparation = await self._unit_of_work.transaction_with_sidecar(
                project_path,
                lambda project, metadata: self._prepare(
                    project,
                    metadata,
                    result_name,
                    result_element_id,
                    output_path,
                    result_content_id,
                    retry_count,
                    input_spec,
                ),
            )
            input_spec = preparation.input_spec
            video_paths = tuple(self._resolve_media(project_path, source) for source in input_spec.video_sources)
            audio_path = (
                self._resolve_media(project_path, input_spec.audio_sources[0])
                if input_spec.audio_policy == "preserve" and input_spec.audio_sources
                else None
            )
            media_paths = video_paths + ((audio_path,) if audio_path else ())
            for path in media_paths:
                if not await self._file_readiness.wait_for_path(path):
                    raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", f"Composition input file is missing or empty: {path.name}.")
            result = await self._composition_port.compose(
                VideoCompositionRequest(
                    video_paths=video_paths,
                    audio_path=audio_path,
                    output_path=self._resolve_media(project_path, output_path),
                    width=input_spec.output_width,
                    height=input_spec.output_height,
                    audio_policy=input_spec.audio_policy,
                ),
                interruption_event=self._interruption_event(tool_context),
            )
            await self._unit_of_work.transaction_with_sidecar(
                project_path,
                lambda project, metadata: self._complete(project, metadata, preparation, result),
            )
        except BaseException as error:
            message = str(error)[:500]
            if preparation is not None:
                await self._mark_failed(project_path, preparation, message)
            else:
                await self._mark_unprepared_failed(
                    project_path,
                    result_element_id,
                    result_content_id,
                    message,
                )
            if isinstance(error, asyncio.CancelledError):
                raise
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", message) from error
        return CanvasVideoCompositionResult(
            result_element_id=preparation.result_element_id,
            result_content_id=preparation.result_content_id,
            status="completed",
            src=preparation.relative_output_path,
            width=result.width,
            height=result.height,
            duration_seconds=result.duration_seconds,
            has_audio=result.has_audio,
        )

    def _prepare(
        self,
        project: CanvasProject,
        metadata: dict,
        result_name: str,
        result_element_id: str,
        output_path: str,
        result_content_id: str | None,
        retry_count: int,
        input_spec: CompositionInputSpec | None,
    ):
        """在事务内解析输入并创建 processing 结果 Content。"""
        if input_spec is None:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Composition requires a complete input snapshot.")
        spec = input_spec
        element = project.canvas.get_element(result_element_id)
        if element is None or element.element_type != "video":
            raise CanvasDomainError("ELEMENT_NOT_FOUND", "The result Element must be a video Element.")
        if element.properties.name is None:
            element.properties.name = result_name
        previous_active_content_id = element.active_content_id
        previous_main_content_id = element.main_content_id
        existing_content = element.get_content(result_content_id) if result_content_id else None
        if existing_content is None:
            raise CanvasDomainError("CONTENT_NOT_FOUND", "The requested result Content does not exist.")
        if not isinstance(existing_content.fields, VideoContentFields):
            raise CanvasDomainError("CONTENT_NOT_FOUND", "The requested result Content is not a video Content.")
        content_id = existing_content.content_id
        existing_content.fields.status = "processing"
        existing_content.fields.stored_error_message = None
        detail = ContentMetadataService.get(metadata, element.element_id, content_id)
        ContentMetadataService.set(
            metadata,
            element.element_id,
            content_id,
            {
                **detail,
                "elementId": element.element_id,
                "source": "generated",
                "productionRule": "video_composition",
                "generationStatus": "processing",
                "outputUri": output_path,
                "retryCount": retry_count if retry_count > 0 else int(detail.get("retryCount", 0)),
                "errorMessage": None,
                "composition": {
                    "videoSequence": list(spec.video_element_ids),
                    "audioSequence": list(spec.audio_element_ids),
                    "output": spec.output.to_dict(),
                    "resolvedVideos": list(spec.video_sources),
                    "resolvedAudios": list(spec.audio_sources),
                    "resolvedWidth": spec.output_width,
                    "resolvedHeight": spec.output_height,
                },
            },
        )
        return (CompositionPreparation(element.element_id, content_id, output_path, spec, previous_active_content_id, previous_main_content_id), metadata)

    def _complete(self, project: CanvasProject, metadata: dict, preparation: CompositionPreparation, result: VideoCompositionResult):
        """在事务内写入完成状态和主 Content 指针。"""
        element = project.canvas.get_element(preparation.result_element_id)
        content = element.get_content(preparation.result_content_id) if element else None
        if element is None or content is None or not isinstance(content.fields, VideoContentFields):
            raise CanvasDomainError("CONTENT_NOT_FOUND", "Composition result Content no longer exists.")
        video_content = content.fields
        element.properties.width = result.width
        element.properties.height = result.height
        video_content.update_generation_result("completed", preparation.relative_output_path, None)
        video_content.video_generation_result_meta = {
            "durationSeconds": result.duration_seconds,
            "hasAudio": result.has_audio,
        }
        element.main_content_id = preparation.result_content_id
        detail = ContentMetadataService.get(metadata, element.element_id, preparation.result_content_id)
        ContentMetadataService.set(
            metadata,
            element.element_id,
            preparation.result_content_id,
            {
                **detail,
                "generationStatus": "completed",
                "outputUri": preparation.relative_output_path,
                "durationSeconds": result.duration_seconds,
                "hasAudio": result.has_audio,
            },
        )
        return {"result_element_id": element.element_id, "result_content_id": preparation.result_content_id}, metadata

    async def _mark_failed(self, project_path: str, preparation: CompositionPreparation, message: str) -> None:
        """尽力将本次合成结果保留为 failed。"""
        try:
            await self._unit_of_work.transaction_with_sidecar(
                project_path,
                lambda project, metadata: self._fail(project, metadata, preparation, message),
            )
        except Exception:
            return

    async def _mark_unprepared_failed(
        self,
        project_path: str,
        result_element_id: str,
        result_content_id: str,
        message: str,
    ) -> None:
        """在输入解析尚未完成时，将已创建的结果 Content 标记为 failed。"""
        try:
            await self._unit_of_work.transaction_with_sidecar(
                project_path,
                lambda project, metadata: self._fail_unprepared(
                    project,
                    metadata,
                    result_element_id,
                    result_content_id,
                    message,
                ),
            )
        except Exception:
            return

    async def mark_unprepared_failed(
        self,
        project_path: str,
        result_element_id: str,
        result_content_id: str,
        message: str,
    ) -> None:
        """将已创建但尚未开始合成的结果 Content 标记为失败。"""
        await self._mark_unprepared_failed(project_path, result_element_id, result_content_id, message)

    def _fail_unprepared(
        self,
        project: CanvasProject,
        metadata: dict,
        result_element_id: str,
        result_content_id: str,
        message: str,
    ):
        """在事务内更新尚未进入 processing 状态的结果 Content。"""
        element = project.canvas.get_element(result_element_id)
        content = element.get_content(result_content_id) if element else None
        if element is not None and content is not None and isinstance(content.fields, VideoContentFields):
            content.fields.update_generation_result("failed", None, message)
            detail = ContentMetadataService.get(metadata, result_element_id, result_content_id)
            ContentMetadataService.set(
                metadata,
                result_element_id,
                result_content_id,
                {**detail, "generationStatus": "failed", "errorMessage": message},
            )
        return {"status": "failed"}, metadata

    def _fail(self, project: CanvasProject, metadata: dict, preparation: CompositionPreparation, message: str):
        """在事务内写入失败状态。"""
        element = project.canvas.get_element(preparation.result_element_id)
        content = element.get_content(preparation.result_content_id) if element else None
        if element is not None and content is not None and isinstance(content.fields, VideoContentFields):
            video_content = content.fields
            video_content.update_generation_result("failed", None, message)
            if preparation.previous_active_content_id is not None:
                element.active_content_id = preparation.previous_active_content_id
            if preparation.previous_main_content_id is not None:
                element.main_content_id = preparation.previous_main_content_id
            detail = ContentMetadataService.get(metadata, element.element_id, preparation.result_content_id)
            ContentMetadataService.set(metadata, element.element_id, preparation.result_content_id, {**detail, "generationStatus": "failed", "errorMessage": message})
        return {"status": "failed"}, metadata

    def inspect_inputs(
        self,
        project: CanvasProject,
        video_element_ids: tuple[str, ...],
        *,
        audio_element_ids: tuple[str, ...] = (),
        composition_output: CompositionOutput | None = None,
    ) -> CompositionInputSpec:
        """校验 Element 顺序并解析本次导出的媒体路径和规格。"""
        if not video_element_ids:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "composition.videoSequence must contain at least one Video Element ID.")
        output = composition_output or CompositionOutput()
        normalized_video_ids = self._normalize_element_ids(video_element_ids, "composition.videoSequence")
        normalized_audio_ids = self._normalize_element_ids(audio_element_ids, "composition.audioSequence", max_length=1)
        normalized_videos = tuple(
            self._resolve_element_media(project, element_id, "video", "composition.videoSequence")
            for element_id in normalized_video_ids
        )
        normalized_audios = tuple(
            self._resolve_element_media(project, element_id, "audio", "composition.audioSequence")
            for element_id in normalized_audio_ids
        )
        width, height = self._resolve_dimensions(
            output.aspect_ratio or "16:9",
            output.resolution or "1080p",
            output.width,
            output.height,
        )
        return CompositionInputSpec(
            video_element_ids=normalized_video_ids,
            audio_element_ids=normalized_audio_ids,
            video_sources=normalized_videos,
            audio_sources=normalized_audios,
            output_width=width,
            output_height=height,
            audio_policy=output.audio_policy,
            output=output,
        )

    @staticmethod
    def _normalize_element_ids(
        element_ids: tuple[str, ...],
        field_name: str,
        *,
        max_length: int | None = None,
    ) -> tuple[str, ...]:
        """校验并规范化合成请求中的 Element ID 序列。"""
        normalized = tuple(str(element_id).strip() for element_id in element_ids if str(element_id).strip())
        if len(normalized) != len(element_ids):
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", f"{field_name} must contain non-empty Element IDs.")
        if len(normalized) != len(set(normalized)):
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", f"{field_name} must contain unique Element IDs.")
        if max_length is not None and len(normalized) > max_length:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", f"{field_name} supports at most {max_length} Element ID.")
        return normalized

    @staticmethod
    def _resolve_element_media(
        project: CanvasProject,
        element_id: str,
        expected_type: str,
        field_name: str,
    ) -> str:
        """从 Element 的 main Content 解析已完成的项目媒体路径。"""
        element = project.canvas.get_element(element_id)
        if element is None:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", f"{field_name} references a missing Element: {element_id}.")
        if element.element_type != expected_type:
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_FAILED",
                f"{field_name} must reference {expected_type.title()} Elements: {element_id}.",
            )
        content_id = element.main_content_id or element.active_content_id
        content = element.get_content(content_id)
        if content is None or not content.fields.asset_path:
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_FAILED",
                f"{field_name} references an Element without a usable main media Content: {element_id}.",
            )
        status = content.fields.generation_status
        if status not in {None, "completed"}:
            raise CanvasDomainError(
                "VIDEO_COMPOSITION_FAILED",
                f"{field_name} references a media Element that is not completed: {element_id}.",
            )
        return str(content.fields.asset_path)

    def _resolve_media(self, project_path: str, source: str | None) -> Path:
        """解析项目相对或工作区相对媒体路径，并限制在当前项目内。"""
        if not source:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Media source is empty.")
        normalized = source.replace("\\", "/")
        while normalized.startswith("./"):
            normalized = normalized[2:]
        project_relative = PurePosixPath(project_path.replace("\\", "/"))
        source_path = PurePosixPath(normalized)
        project_parts = project_relative.parts
        if source_path.parts[: len(project_parts)] == project_parts:
            relative = PurePosixPath(*source_path.parts[len(project_parts) :])
        else:
            relative = source_path
        if relative.is_absolute() or ".." in relative.parts:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Media source must stay inside the project.")
        if not relative.parts:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Media source is empty.")
        return self._workspace / project_path / relative

    @classmethod
    def _resolve_dimensions(
        cls,
        aspect_ratio: str,
        resolution: str,
        width: object | None = None,
        height: object | None = None,
    ) -> tuple[int, int]:
        """优先使用明确宽高，否则按比例和短边分辨率计算输出尺寸。"""
        if width is not None or height is not None:
            if (
                isinstance(width, bool)
                or not isinstance(width, int)
                or width < 2
                or isinstance(height, bool)
                or not isinstance(height, int)
                or height < 2
            ):
                raise CanvasDomainError(
                    "VIDEO_COMPOSITION_FAILED",
                    "Output width and height must be positive pixel integers.",
                )
            return cls._even(width), cls._even(height)
        try:
            left, right = aspect_ratio.split(":", 1)
            ratio = Fraction(int(left), int(right))
        except (ValueError, ZeroDivisionError) as error:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Invalid output aspect ratio.") from error
        if ratio <= 0:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Invalid output aspect ratio.")
        short_side = parse_resolution_short_side(resolution)
        if short_side is None:
            raise CanvasDomainError("VIDEO_COMPOSITION_FAILED", "Unsupported output resolution.")
        if ratio >= 1:
            height = short_side
            width = round(short_side * float(ratio))
        else:
            width = short_side
            height = round(short_side / float(ratio))
        return cls._even(width), cls._even(height)

    @staticmethod
    def _even(value: int) -> int:
        """返回不小于 2 的偶数。"""
        value = max(2, value)
        return value if value % 2 == 0 else value + 1

    @staticmethod
    def _safe_name(name: str) -> str:
        """清理输出文件名中的路径字符。"""
        return "".join(character if character.isalnum() or character in "-_" else "_" for character in name).strip("_") or "canvas-video"

    async def _output_path(self, project_path: str, result_name: str) -> str:
        """优先保留结果原名，只有目标已存在时才追加可读时间戳。"""
        filename = f"{self._safe_name(result_name)}.mp4"
        candidate = self._workspace / project_path / "videos" / filename
        if not await async_exists(candidate):
            return f"./videos/{filename}"
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        return f"./videos/{self._safe_name(result_name)}-{timestamp}.mp4"

    @staticmethod
    def _interruption_event(tool_context):
        """从工具上下文读取用户中断事件。"""
        if tool_context is None:
            return None
        agent_context = tool_context.get_extension("agent_context")
        return agent_context.get_interruption_event() if agent_context is not None else None
