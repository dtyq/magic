"""Canvas 生成提交与结果持久化用例服务。"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, TypeVar, cast

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.tools.canvas.application.commands import GenerationSubmissionCommand
from app.tools.canvas.application.element_sizing_service import CanvasElementSizingService
from app.tools.canvas.application.results import CanvasBatchResult, CanvasResultItem, GeneratedResultItem
from app.tools.canvas.domain.content_fields.generated_media_protocol import generation_request_field
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.generation import (
    CanvasGenerationResultApplier,
    GenerationCapability,
    GenerationCapabilityRegistry,
    GenerationExecutionStrategyInterface,
    GenerationExecutionStrategyRegistry,
    GenerationRequest,
    GenerationSubmission,
    GenerationTask,
    GenerationTaskRepository,
    TaskCreatedCallback,
)
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.repository import CanvasUnitOfWork

TGeneratedItem = TypeVar("TGeneratedItem", bound=CanvasResultItem)

logger = get_logger(__name__)


@dataclass(frozen=True)
class _GenerationWorkItem:
    """保存一个生成项的不可变执行快照，避免并发阶段共享可变请求状态。"""

    submission_item: GenerationSubmissionCommand
    capability: GenerationCapability
    strategy: GenerationExecutionStrategyInterface
    request: GenerationRequest
    parameter_payload: dict[str, Any]


@dataclass(frozen=True)
class _GenerationWorkResult:
    """保存一个生成项的执行结果和可选媒体尺寸。"""

    work_item: _GenerationWorkItem
    submission: GenerationSubmission
    output_dimensions: tuple[int, int] | None = None


class GenerationSubmissionService:
    """提交生成任务并把同步或异步结果写回 Canvas。"""

    def __init__(
        self,
        unit_of_work: CanvasUnitOfWork,
        generation_capabilities: GenerationCapabilityRegistry,
        generation_tasks: GenerationTaskRepository,
        generation_execution: GenerationExecutionStrategyRegistry,
        generation_result_applier: CanvasGenerationResultApplier,
        element_sizing: CanvasElementSizingService | None = None,
        max_concurrency: int = 4,
    ) -> None:
        """显式绑定生成提交依赖，并初始化 provider 并发上限。"""
        self.unit_of_work = unit_of_work
        self.generation_capabilities = generation_capabilities
        self.generation_tasks = generation_tasks
        self.generation_execution = generation_execution
        self.generation_result_applier = generation_result_applier
        self.element_sizing = element_sizing
        self.max_concurrency = self._normalize_max_concurrency(max_concurrency)
        self._generation_semaphore = asyncio.Semaphore(self.max_concurrency)

    async def submit_generated(
        self,
        project_path: str,
        result: CanvasBatchResult[TGeneratedItem],
        generated: list[GenerationSubmissionCommand],
        tool_context: ToolContext | None,
        on_progress_updated: Callable[[CanvasBatchResult[TGeneratedItem]], Awaitable[None]] | None = None,
    ) -> CanvasBatchResult[TGeneratedItem]:
        """并发执行生成策略，再按输入顺序提交结果和持久化状态。"""
        by_content: dict[str, GeneratedResultItem] = {}
        for result_item in result.items:
            generated_item = cast(GeneratedResultItem, result_item)
            if generated_item.content_id is not None:
                by_content[generated_item.content_id] = generated_item
        if not generated:
            return result

        work_items = [
            self._build_work_item(item, project_path, result, by_content, on_progress_updated)
            for item in generated
        ]
        await self._persist_generation_start_metadata(project_path, work_items, tool_context)
        await self._execute_work_items(
            work_items,
            project_path,
            tool_context,
            by_content,
            result,
            on_progress_updated,
        )
        return result

    async def _persist_generation_start_metadata(
        self,
        project_path: str,
        work_items: list[_GenerationWorkItem],
        tool_context: ToolContext | None,
    ) -> None:
        """在 provider 调用前把最终模型和模式写入公共生成请求。"""
        for work_item in work_items:
            resolver = getattr(work_item.capability.submission_port, "resolve_request_metadata", None)
            request_metadata: dict[str, Any] = {}
            if resolver is not None:
                try:
                    request_metadata = await resolver(work_item.request, tool_context) or {}
                except Exception:
                    # 解析失败时仍写入已有参数，并交给 provider 执行。
                    request_metadata = {}

            def persist(project: CanvasProject, metadata: dict[str, Any]) -> tuple[None, dict[str, Any]]:
                """在项目事务中更新当前 Content 的公共生成请求。"""
                detail = ContentMetadataService.get(
                    metadata,
                    work_item.submission_item.element_id,
                    work_item.submission_item.content_id,
                )
                parameters = {
                    **dict(detail.get("generationParameters") or {}),
                    **work_item.parameter_payload,
                    **dict(request_metadata),
                }
                request_field = generation_request_field(work_item.submission_item.element_type)
                if not request_field:
                    return None, metadata
                detail_update = {
                    **detail,
                    "generationParameters": parameters,
                    request_field: ContentMetadataService.build_public_generation_request(
                        parameters,
                        work_item.submission_item.element_type,
                        project_path=project_path,
                    ),
                }
                if work_item.submission_item.element_type == "video":
                    existing = self._video_result_metadata(
                        project,
                        work_item.submission_item.element_id,
                        work_item.submission_item.content_id,
                    )
                    result_metadata = ContentMetadataService.merge_video_result_metadata(
                        existing,
                        ContentMetadataService.build_video_result_metadata(parameters),
                        "pending",
                    )
                    self.generation_result_applier.apply(
                        project,
                        work_item.submission_item.element_id,
                        work_item.submission_item.content_id,
                        "pending",
                        None,
                        None,
                        result_metadata,
                    )
                ContentMetadataService.set(
                    metadata,
                    work_item.submission_item.element_id,
                    work_item.submission_item.content_id,
                    detail_update,
                )
                return None, metadata

            try:
                await self.unit_of_work.transaction_with_sidecar(project_path, persist)
            except Exception:
                # 预写失败不改变 provider 的执行与原有失败收敛流程，完成阶段还会再次持久化。
                continue

    def _make_generation_timing_sink(
        self,
        submission_item: GenerationSubmissionCommand,
        project_path: str,
        result: CanvasBatchResult[TGeneratedItem],
        result_item: GeneratedResultItem,
        on_progress_updated: Callable[[CanvasBatchResult[TGeneratedItem]], Awaitable[None]] | None,
    ) -> TaskCreatedCallback:
        """构造 provider 建单后同步任务时间的回调。"""
        async def sink(
            _task_id: str,
            expected_finished_at: str | None,
            started_at: str | None,
        ) -> None:
            if expected_finished_at is None or result_item.expected_finished_at is not None:
                return
            result_item.started_at = started_at
            result_item.expected_finished_at = expected_finished_at
            await self._persist_generation_timing(
                project_path, submission_item, expected_finished_at, started_at
            )
            if on_progress_updated is not None:
                await on_progress_updated(result)

        return sink

    async def _persist_generation_timing(
        self,
        project_path: str,
        submission_item: GenerationSubmissionCommand,
        expected_finished_at: str,
        started_at: str | None,
    ) -> None:
        """把任务发起时间与预期完成时间写进当前 Content 的公共生成请求。"""
        if not generation_request_field(submission_item.element_type):
            return

        def persist(project: CanvasProject, metadata: dict[str, Any]) -> tuple[None, dict[str, Any]]:
            """在项目事务中更新当前 Content 的公共生成请求。"""
            detail = ContentMetadataService.get(
                metadata,
                submission_item.element_id,
                submission_item.content_id,
            )
            parameters = {
                **dict(detail.get("generationParameters") or {}),
                "expected_finished_at": expected_finished_at,
            }
            if started_at is not None:
                parameters["start_time"] = started_at
            request_field = generation_request_field(submission_item.element_type)
            detail_update = {
                **detail,
                "generationParameters": parameters,
                request_field: ContentMetadataService.build_public_generation_request(
                    parameters,
                    submission_item.element_type,
                    project_path=project_path,
                ),
            }
            ContentMetadataService.set(
                metadata,
                submission_item.element_id,
                submission_item.content_id,
                detail_update,
            )
            return None, metadata

        try:
            await self.unit_of_work.transaction_with_sidecar(project_path, persist)
        except Exception as e:
            # 中途写入失败不改变生成结果，元素会退回本端估算。
            logger.warning(f"写入图片生成任务时间失败: {e}")

    def _build_work_item(
        self,
        submission_item: GenerationSubmissionCommand,
        project_path: str,
        result: CanvasBatchResult[TGeneratedItem],
        by_content: dict[str, GeneratedResultItem],
        on_progress_updated: Callable[[CanvasBatchResult[TGeneratedItem]], Awaitable[None]] | None,
    ) -> _GenerationWorkItem:
        """在并发执行前固定 capability、策略、请求和参数快照。"""
        parameters = submission_item.parameters
        capability = self.generation_capabilities.get(submission_item.element_type, parameters.model_id)
        request = GenerationRequest(
            project_path=project_path,
            element_id=submission_item.element_id,
            content_id=submission_item.content_id,
            element_type=submission_item.element_type,
            parameters=parameters,
            on_task_created=self._make_generation_timing_sink(
                submission_item,
                project_path,
                result,
                by_content[submission_item.content_id],
                on_progress_updated,
            ),
        )
        return _GenerationWorkItem(
            submission_item=submission_item,
            capability=capability,
            strategy=self.generation_execution.get(capability.execution_mode),
            request=request,
            parameter_payload=parameters.to_dict(),
        )

    async def _execute_work_items(
        self,
        work_items: list[_GenerationWorkItem],
        project_path: str,
        tool_context: ToolContext | None,
        by_content: dict[str, GeneratedResultItem],
        result: CanvasBatchResult[TGeneratedItem],
        on_progress_updated: Callable[[CanvasBatchResult[TGeneratedItem]], Awaitable[None]] | None,
    ) -> None:
        """按完成事件消费生成结果，并立即提交已完成项。"""
        tasks = [asyncio.create_task(self._execute_work_item(item, project_path, tool_context)) for item in work_items]
        committed_content_ids: set[str] = set()
        try:
            for completed_task in asyncio.as_completed(tasks):
                work_result = await completed_task
                await self._commit_generation_result(project_path, by_content, work_result)
                committed_content_ids.add(work_result.work_item.submission_item.content_id)
                if on_progress_updated is not None:
                    await on_progress_updated(result)
        except BaseException as error:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            # 用户终止任务 / 转向会把 provider 调用直接取消，不会走到结果提交，元素会永远停在
            # 「生成中」。这里给还没落终态的项补一次失败收敛，再向上抛出中断。
            await self._settle_uncommitted_work_items(
                project_path, by_content, work_items, committed_content_ids, error
            )
            raise

    async def _settle_uncommitted_work_items(
        self,
        project_path: str,
        by_content: dict[str, GeneratedResultItem],
        work_items: list[_GenerationWorkItem],
        committed_content_ids: set[str],
        error: BaseException,
    ) -> None:
        """中断时把尚未落终态的生成项收敛为终态，避免画布元素卡在「生成中」。

        用户中断（CancelledError）落「已终止」终态，其余异常落「失败」终态。
        终止态不写 errorMessage：内部异常名不该成为用户可见文案，前端按状态渲染
        「已终止」措辞；失败态交给 _failed_generation_submission，沿用其兜底文案与
        长度截断，避免把裸类名（str 为空的异常）写进用户可见文案。
        收敛本身失败不能盖掉原始中断，因此逐项兜底并只记日志。
        """
        terminated = isinstance(error, asyncio.CancelledError)
        for work_item in work_items:
            if work_item.submission_item.content_id in committed_content_ids:
                continue
            submission = (
                self._terminated_generation_submission(work_item.capability.execution_mode)
                if terminated
                else self._failed_generation_submission(work_item.capability.execution_mode, error)
            )
            try:
                await self._commit_generation_result(
                    project_path,
                    by_content,
                    _GenerationWorkResult(work_item, submission),
                )
            except Exception as settle_error:
                logger.warning(
                    f"中断收敛生成项失败: element_id={work_item.submission_item.element_id}, "
                    f"content_id={work_item.submission_item.content_id}, error={settle_error}"
                )

    async def _execute_work_item(
        self,
        work_item: _GenerationWorkItem,
        project_path: str,
        tool_context: ToolContext | None,
    ) -> _GenerationWorkResult:
        """执行单个 provider 任务，并只产生不含共享写入的结果。"""
        try:
            async with self._generation_semaphore:
                try:
                    submission = await work_item.strategy.execute(
                        work_item.capability,
                        work_item.request,
                        tool_context,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as error:
                    return _GenerationWorkResult(
                        work_item,
                        self._failed_generation_submission(work_item.capability.execution_mode, error),
                    )
            output_dimensions = None
            if submission.status == "completed" and self.element_sizing is not None:
                output_dimensions = await self.element_sizing.inspect_generated_media(
                    project_path,
                    work_item.submission_item.element_type,
                    submission.output_uri,
                )
            return _GenerationWorkResult(work_item, submission, output_dimensions)
        except asyncio.CancelledError:
            raise

    async def _commit_generation_result(
        self,
        project_path: str,
        by_content: dict[str, GeneratedResultItem],
        work_result: _GenerationWorkResult,
    ) -> None:
        """按原始顺序更新结果、保存任务绑定并持久化 Canvas 状态。"""
        work_item = work_result.work_item
        submission_item = work_item.submission_item
        submission = work_result.submission
        target = by_content.get(submission_item.content_id)
        if target is not None:
            self._apply_result_item(target, submission)

        task_repository_error = await self._save_generation_task(work_item, submission, project_path)

        def persist(project: CanvasProject, metadata: dict[str, Any]) -> tuple[None, dict[str, Any]]:
            """在同一项目事务中持久化生成结果和内部任务绑定。"""
            self.generation_result_applier.apply(
                project,
                submission_item.element_id,
                submission_item.content_id,
                submission.status,
                submission.output_uri,
                submission.error_message,
                self._merged_video_result_metadata(project, work_item, submission),
            )
            element = project.canvas.get_element(submission_item.element_id)
            if element is not None:
                CanvasElementSizingService.apply(element, work_result.output_dimensions)
            detail = ContentMetadataService.get(metadata, submission_item.element_id, submission_item.content_id)
            public_request = ContentMetadataService.build_public_generation_request(
                {
                    **dict(detail.get("generationParameters") or {}),
                    **work_item.parameter_payload,
                    **dict(submission.request_metadata or {}),
                },
                submission_item.element_type,
                project_path=project_path,
            )
            detail_update: dict[str, Any] = {
                **detail,
                "elementId": submission_item.element_id,
                "source": "generated",
                "retryCount": submission_item.retry_count,
                "providerTaskId": submission.provider_task_id,
                "generationTaskId": submission.generation_task_id,
                "generationStatus": submission.status,
                "outputUri": submission.output_uri,
                "outputFilename": self._output_filename(submission),
                "errorMessage": submission.error_message,
            }
            request_field = generation_request_field(submission_item.element_type)
            if request_field:
                if submission_item.element_type == "image":
                    public_request = ContentMetadataService.complete_image_generation_request(
                        public_request,
                        submission.status,
                    )
                detail_update[request_field] = public_request
            if submission_item.retry_idempotency_key:
                detail_update["retryIdempotencyKey"] = submission_item.retry_idempotency_key
                detail_update["retryResult"] = {
                    "item_ref": submission_item.item_ref,
                    "element_id": submission_item.element_id,
                    "content_id": submission_item.content_id,
                    "status": submission.status,
                    "retry_count": submission_item.retry_count,
                    "generation_task_id": submission.generation_task_id,
                    "output_uri": submission.output_uri,
                    "error": submission.error_message,
                    "next_action": (
                        "Call wait_canvas_generation with the returned generation_task_id."
                        if submission.generation_task_id
                        else "Call query_canvas_element_details to verify the retried Content."
                    ),
                }
            ContentMetadataService.set(metadata, submission_item.element_id, submission_item.content_id, detail_update)
            return None, metadata

        try:
            await self.unit_of_work.transaction_with_sidecar(project_path, persist)
        except Exception as persistence_error:
            logger.warning(
                "持久化生成结果失败: project_path=%s, element_id=%s, content_id=%s, error=%s",
                project_path,
                submission_item.element_id,
                submission_item.content_id,
                persistence_error,
            )
            if target is not None:
                target.persistence_warning = (
                    "The generation task was created, but its Canvas metadata could not be saved. "
                    "Keep the returned generation_task_id and call wait_canvas_generation."
                    if submission.generation_task_id
                    else "The generation result was produced, but its Canvas metadata could not be saved."
                )
                target.persistence_error = "Canvas metadata persistence is temporarily unavailable."
        if task_repository_error and target is not None:
            target.persistence_warning = task_repository_error

    @staticmethod
    def _video_result_metadata(project: CanvasProject, element_id: str, content_id: str) -> dict[str, Any]:
        """读取目标 Video Content 当前的结果元数据副本。"""
        element = project.canvas.get_element(element_id)
        content = element.get_content(content_id) if element is not None else None
        fields = content.fields if content is not None else None
        if isinstance(fields, VideoContentFields) and isinstance(fields.video_generation_result_meta, dict):
            return dict(fields.video_generation_result_meta)
        return {}

    @classmethod
    def _merged_video_result_metadata(
        cls,
        project: CanvasProject,
        work_item: _GenerationWorkItem,
        submission: GenerationSubmission,
    ) -> dict[str, Any] | None:
        """为 Video Content 合并本次提交返回的结果元数据。"""
        item = work_item.submission_item
        if item.element_type != "video":
            return None
        existing = cls._video_result_metadata(project, item.element_id, item.content_id)
        initial = ContentMetadataService.build_video_result_metadata(work_item.parameter_payload)
        merged = ContentMetadataService.merge_video_result_metadata(existing, initial, submission.status)
        return ContentMetadataService.merge_video_result_metadata(
            merged,
            submission.result_metadata,
            submission.status,
        )

    @staticmethod
    def _apply_result_item(target: GeneratedResultItem, submission: GenerationSubmission) -> None:
        """把统一生成结果投影到工具批量结果项。"""
        target.status = submission.status
        if submission.generation_task_id:
            target.generation_task_id = submission.generation_task_id
        if submission.output_uri:
            target.output_uri = submission.output_uri
        if submission.error_message:
            target.error = submission.error_message

    async def _save_generation_task(
        self,
        work_item: _GenerationWorkItem,
        submission: GenerationSubmission,
        project_path: str,
    ) -> str | None:
        """保存异步任务绑定，并把仓储异常收敛为恢复告警。"""
        submission_item = work_item.submission_item
        if not (submission.execution_mode == "async" and submission.generation_task_id and submission.provider_task_id):
            return None
        try:
            await self.generation_tasks.put(
                GenerationTask(
                    generation_task_id=submission.generation_task_id,
                    provider_task_id=submission.provider_task_id,
                    project_path=project_path,
                    element_id=submission_item.element_id,
                    content_id=submission_item.content_id,
                    element_type=submission_item.element_type,
                    capability_name=work_item.capability.name,
                    retry_count=submission_item.retry_count,
                    status=submission.status,
                    error=submission.error_message,
                    output_uri=submission.output_uri,
                    output_filename=self._output_filename(submission),
                )
            )
        except Exception:
            return "Generation task binding was saved in Canvas metadata and can be recovered on the next wait call."
        return None

    @staticmethod
    def _normalize_max_concurrency(value: int) -> int:
        """将并发配置收敛为正整数，非法值安全回退为串行。"""
        try:
            normalized = int(value)
        except (TypeError, ValueError):
            return 1
        return normalized if normalized > 0 else 1

    @staticmethod
    def _failed_generation_submission(execution_mode: str, error: str | BaseException) -> GenerationSubmission:
        """把端口异常或中断原因收敛为可持久化的失败结果。"""
        message = str(error).strip() or "Generation failed unexpectedly."
        return GenerationSubmission(execution_mode, "failed", error_message=message[:1000])

    @staticmethod
    def _terminated_generation_submission(execution_mode: str) -> GenerationSubmission:
        """把用户中断收敛为可持久化的终止结果，不携带错误文案。"""
        return GenerationSubmission(execution_mode, "terminated")

    @staticmethod
    def _output_filename(submission: GenerationSubmission) -> str | None:
        """读取异步任务提交时确定的本地输出文件名。"""
        value = (submission.request_metadata or {}).get("outputFilename")
        return value if isinstance(value, str) and value else None
