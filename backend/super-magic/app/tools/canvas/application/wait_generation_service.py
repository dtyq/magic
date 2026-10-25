"""异步生成等待用例服务。"""

from __future__ import annotations

import asyncio
import time

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application.element_sizing_service import CanvasElementSizingService
from app.tools.canvas.application.results import WaitGenerationResult, WaitGenerationResultItem
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.content_fields.generated_media_protocol import (
    find_generation_request,
    generation_request_field,
)
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.generation import (
    CanvasGenerationResultApplier,
    GenerationCapabilityRegistry,
    GenerationQueryRequest,
    GenerationTask,
    GenerationTaskPoller,
    GenerationTaskRepository,
)
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.infrastructure.workspace import CanvasFileReadinessChecker
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive


class WaitGenerationService:
    """Canvas WaitGenerationService 用例服务。"""

    def __init__(self, repository: CanvasRepositoryInterface, unit_of_work: CanvasUnitOfWork, generation_capabilities: GenerationCapabilityRegistry, generation_tasks: GenerationTaskRepository, generation_poller: GenerationTaskPoller, generation_result_applier: CanvasGenerationResultApplier, element_sizing: CanvasElementSizingService | None = None):
        """显式绑定等待用例所需的仓储、事务、能力、任务和结果端口。"""
        self.repository = repository
        self.unit_of_work = unit_of_work
        self.generation_capabilities = generation_capabilities
        self.generation_result_applier = generation_result_applier
        self.generation_tasks = generation_tasks
        self.generation_poller = generation_poller
        self.element_sizing = element_sizing
        self.file_readiness = CanvasFileReadinessChecker(repository.workspace)

    async def wait(
        self,
        project_path: str,
        task_ids: list[str],
        max_wait_seconds: int = 60,
        tool_context: ToolContext | None = None,
    ) -> WaitGenerationResult:
        """轮询异步任务并在终态回写 Content。"""
        if len(task_ids) != len(set(task_ids)):
            raise CanvasDomainError("GENERATION_TASK_ID_INVALID", "generation_task_id values must be unique within a wait call.")
        keep_alive_task = start_tool_keep_alive(tool_context) if tool_context is not None else None
        try:
            deadline = time.monotonic() + max_wait_seconds
            results = await asyncio.gather(
                *(self._wait_one_safely(project_path, task_id, deadline, tool_context) for task_id in task_ids)
            )
            return WaitGenerationResult(list(results))
        finally:
            stop_tool_keep_alive(keep_alive_task)

    async def _wait_one_safely(
        self,
        project_path: str,
        task_id: str,
        deadline: float,
        tool_context: ToolContext | None,
    ) -> WaitGenerationResultItem:
        """隔离单个等待任务的查询或持久化异常，避免拖垮同批其他任务。"""
        try:
            return await self._wait_one(project_path, task_id, deadline, tool_context)
        except CanvasDomainError as error:
            if error.code in {"CONTENT_NOT_FOUND", "ELEMENT_NOT_FOUND"}:
                return WaitGenerationResultItem(task_id, "not_found", error=error.message)
            return WaitGenerationResultItem(
                task_id,
                "processing",
                query_error="Generation status is temporarily unavailable.",
                next_action="Call wait_canvas_generation again with the same generation_task_id.",
            )
        except Exception:
            return WaitGenerationResultItem(
                task_id,
                "processing",
                query_error="Generation status is temporarily unavailable.",
                next_action="Call wait_canvas_generation again with the same generation_task_id.",
            )

    async def _wait_one(
        self,
        project_path: str,
        task_id: str,
        deadline: float,
        tool_context: ToolContext | None,
    ) -> WaitGenerationResultItem:
        """在共享等待窗口内查询并幂等回写一个异步任务。"""
        record = await self.generation_tasks.get(task_id)
        if record is None:
            record = await self._recover_generation_task(project_path, task_id)
        if record is None or record.project_path != project_path:
            return WaitGenerationResultItem(task_id, "not_found")
        if record.status in {"completed", "failed"}:
            return WaitGenerationResultItem(
                task_id,
                record.status,
                element_id=record.element_id,
                content_id=record.content_id,
                output_uri=record.output_uri,
                error=record.error,
                already_finalized=True,
            )
        if record.element_type in {"frame", "group"}:
            return WaitGenerationResultItem(
                task_id,
                "not_applicable",
                element_id=record.element_id,
                content_id=record.content_id,
                error_code="FRAME_GENERATION_NOT_APPLICABLE",
                error="Frame and Group Elements do not have generation tasks.",
                next_action="Do not wait for this Element; use Canvas layout or query tools instead.",
            )
        capability = self.generation_capabilities.get_by_name(
            record.capability_name,
            record.element_type,
        )
        if capability.query_port is None:
            return WaitGenerationResultItem(task_id, "processing", timed_out=True)
        query_result = await self.generation_poller.poll(
            capability.query_port,
            GenerationQueryRequest(
                provider_task_id=record.provider_task_id,
                project_path=record.project_path,
                element_id=record.element_id,
                content_id=record.content_id,
                output_filename=record.output_filename,
            ),
            deadline,
            tool_context,
        )
        if query_result.status not in {"completed", "failed"}:
            return WaitGenerationResultItem(
                task_id,
                query_result.status,
                element_id=record.element_id,
                content_id=record.content_id,
                timed_out=True,
                next_action="Call wait_canvas_generation again with the same generation_task_id.",
            )

        final_status = query_result.status
        if final_status == "completed" and query_result.output_uri:
            output_ready = await self.file_readiness.wait_for_uri(
                project_path,
                query_result.output_uri,
                deadline=deadline,
            )
            if not output_ready:
                return WaitGenerationResultItem(
                    task_id,
                    "processing",
                    element_id=record.element_id,
                    content_id=record.content_id,
                    timed_out=time.monotonic() >= deadline,
                    next_action="Call wait_canvas_generation again with the same generation_task_id.",
                )
        output_dimensions = None
        if final_status == "completed" and self.element_sizing is not None:
            output_dimensions = await self.element_sizing.inspect_generated_media(
                project_path,
                record.element_type,
                query_result.output_uri,
            )

        def finalize(project: CanvasProject, metadata: dict) -> tuple[None, dict]:
            """在同一项目事务中完成异步结果和任务元数据回写。"""
            result_metadata = None
            if record.element_type == "video":
                element = project.canvas.get_element(record.element_id)
                content = element.get_content(record.content_id) if element is not None else None
                fields = content.fields if content is not None else None
                existing = (
                    fields.video_generation_result_meta
                    if isinstance(fields, VideoContentFields)
                    and isinstance(fields.video_generation_result_meta, dict)
                    else {}
                )
                result_metadata = ContentMetadataService.merge_video_result_metadata(
                    existing,
                    query_result.result_metadata,
                    final_status,
                )
            self.generation_result_applier.apply(
                project,
                record.element_id,
                record.content_id,
                final_status,
                query_result.output_uri,
                query_result.error_message,
                result_metadata,
            )
            element = project.canvas.get_element(record.element_id)
            if element is not None:
                CanvasElementSizingService.apply(element, output_dimensions)
            detail = CanvasApplicationOperations.get_content_detail(metadata, record.element_id, record.content_id)
            detail_update = {
                **detail,
                "generationStatus": final_status,
                "outputUri": query_result.output_uri,
                "errorMessage": query_result.error_message,
            }
            if find_generation_request(detail) is None:
                parameters = detail.get("generationParameters") or {}
                if isinstance(parameters, dict):
                    from pathlib import Path
                    if query_result.output_uri:
                        parameters = {**parameters, "image_id": Path(query_result.output_uri).stem}
                    request_key = generation_request_field(record.element_type)
                    if request_key:
                        detail_update[request_key] = ContentMetadataService.build_public_generation_request(
                            parameters,
                            record.element_type,
                            project_path=project_path,
                        )
            CanvasApplicationOperations.set_content_detail(metadata, record.element_id, record.content_id, detail_update)
            return None, metadata

        await self.unit_of_work.transaction_with_sidecar(project_path, finalize)
        record.status = final_status
        record.error = query_result.error_message
        record.output_uri = query_result.output_uri
        await self.generation_tasks.update(record)
        return WaitGenerationResultItem(
            task_id,
            final_status,
            element_id=record.element_id,
            content_id=record.content_id,
            output_uri=query_result.output_uri,
            error=query_result.error_message,
            next_action="Call query_canvas_element_details to verify the persisted Content.",
        )

    async def _recover_generation_task(
        self, project_path: str, generation_task_id: str
    ) -> GenerationTask | None:
        """从 sidecar 恢复进程重启后仍未完成的异步任务绑定。"""
        metadata = await self.repository.read_sidecar(project_path)
        metadata["__canvas_runtime__"] = await self.repository.read_sidecar_runtime(project_path)
        project = await self.repository.read(project_path)
        for element in project.canvas.iter_elements():
            for content in element.contents:
                detail = CanvasApplicationOperations.get_content_detail(metadata, element.element_id, content.content_id)
                if detail.get("generationTaskId") != generation_task_id:
                    continue
                provider_task_id = detail.get("providerTaskId")
                if not isinstance(provider_task_id, str) or not provider_task_id:
                    return None
                parameters = detail.get("generationParameters") or {}
                try:
                    capability_name = self.generation_capabilities.get(
                        element.element_type,
                        parameters.get("model_id"),
                    ).name
                except CanvasDomainError:
                    capability_name = "recovered"
                record = GenerationTask(
                    generation_task_id=generation_task_id,
                    provider_task_id=provider_task_id,
                    project_path=project_path,
                    element_id=element.element_id,
                    content_id=content.content_id,
                    element_type=element.element_type,
                    capability_name=capability_name,
                    retry_count=int(detail.get("retryCount", 0)),
                    status=str(detail.get("generationStatus") or content.fields.generation_status or "processing"),
                    error=detail.get("errorMessage") or content.fields.error_message,
                    output_uri=detail.get("outputUri") or content.fields.asset_path,
                    output_filename=detail.get("outputFilename") if isinstance(detail.get("outputFilename"), str) else None,
                )
                await self.generation_tasks.put(record)
                return record
        return None
