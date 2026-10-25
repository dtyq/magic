"""失败 Content 重试用例服务。"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application.commands import GenerationParameters, GenerationSubmissionCommand, RetryContentCommand
from app.tools.canvas.application.results import RetryContentResultItem, RetryContentsResult
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.content_fields.generated_media import GeneratedMediaContentFields
from app.tools.canvas.domain.content_fields.video import VideoContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.production.contracts.composition_output import CompositionOutput
from app.tools.canvas.production.contracts.video_composition_models import CompositionInputSpec
from app.tools.canvas.repository import CanvasUnitOfWork


@dataclass(frozen=True)
class _CompositionRetryRequest:
    """描述一次复用原 Element 和 Content 的同步合成重试。"""

    item_ref: str
    element_id: str
    content_id: str
    input_spec: CompositionInputSpec
    result_name: str
    retry_count: int
    idempotency_key: str


class RetryContentService:
    """Canvas RetryContentService 用例服务。"""

    def __init__(
        self,
        repository: CanvasRepositoryInterface,
        unit_of_work: CanvasUnitOfWork,
        generation_submission_service,
        video_composition_service=None,
    ):
        """显式绑定重试用例所需的仓储、事务、生成能力和提交服务。"""
        self.repository = repository
        self.unit_of_work = unit_of_work
        self.generation_submission_service = generation_submission_service
        self.video_composition_service = video_composition_service

    async def retry_content(self, project_path: str, items: Sequence[RetryContentCommand], tool_context: ToolContext | None = None) -> RetryContentsResult:
        """校验失败 Content 的受控重试边界，并复用原 Content ID。"""
        item_list = tuple(items)
        CanvasApplicationOperations.validate_unique_item_refs(item_list)
        current_item_ref: str | None = None
        retry_requests: list[GenerationSubmissionCommand] = []
        composition_retries: list[_CompositionRetryRequest] = []

        async def mutate(project: CanvasProject, metadata: dict) -> tuple[RetryContentsResult, dict]:
            nonlocal current_item_ref
            results: list[RetryContentResultItem] = []
            for item in item_list:
                current_item_ref = item.item_ref
                element = project.canvas.get_element(item.element_id)
                content = element.get_content(item.content_id) if element else None
                if element is None or content is None:
                    raise CanvasDomainError("CONTENT_NOT_FOUND", "The requested Content does not exist.")
                if element.element_type in {"frame", "group"}:
                    raise CanvasDomainError("CONTENT_RETRY_NOT_ALLOWED", "Frame and Group Elements do not have generated Content.")
                detail = CanvasApplicationOperations.get_content_detail(metadata, element.element_id, item.content_id)
                original_parameters = detail.get("generationParameters", {})
                is_composition = self._is_composition(detail, original_parameters)
                composition_input_spec = self._composition_input_spec(detail)
                if is_composition and self.video_composition_service is None:
                    raise CanvasDomainError("CONTENT_RETRY_NOT_ALLOWED", "Composition retry is not configured.")
                if is_composition and composition_input_spec is None:
                    raise CanvasDomainError(
                        "CONTENT_RETRY_NOT_ALLOWED",
                        "Composition retry requires the original composition input snapshot.",
                    )
                override = item.generation_override.to_dict() if item.generation_override else None
                parameters = CanvasApplicationOperations.merge_generation_override(element.element_type, original_parameters, override)
                if is_composition:
                    if parameters.get("task") not in (None, "compose"):
                        raise CanvasDomainError(
                            "CONTENT_FIELD_MANAGED_INTERNAL",
                            "Composition retry must keep task=compose.",
                        )
                    parameters["task"] = "compose"
                idempotency_parameters = parameters
                if is_composition:
                    idempotency_parameters = {
                        **parameters,
                        "__composition_input": self._composition_input_dict(composition_input_spec),
                    }
                idempotency_key = ContentMetadataService.retry_idempotency_key(
                    item.item_ref,
                    element.element_id,
                    content.content_id,
                    idempotency_parameters,
                )
                if detail.get("retryIdempotencyKey") == idempotency_key:
                    previous_result = detail.get("retryResult")
                    if isinstance(previous_result, dict):
                        results.append(RetryContentResultItem(
                            item_ref=str(previous_result.get("item_ref", item.item_ref)),
                            element_id=str(previous_result.get("element_id", element.element_id)),
                            content_id=str(previous_result.get("content_id", content.content_id)),
                            status=str(previous_result.get("status", "processing")),
                            retry_count=int(previous_result.get("retry_count", detail.get("retryCount", 0))),
                            generation_task_id=previous_result.get("generation_task_id"),
                            output_uri=previous_result.get("output_uri"),
                            error=previous_result.get("error"),
                            next_action=previous_result.get("next_action"),
                            previous_status=previous_result.get("previous_status"),
                            main_content_id=previous_result.get("main_content_id"),
                            idempotent_replay=True,
                        ))
                        continue
                    if detail.get("generationStatus") in {"pending", "processing"}:
                        results.append(RetryContentResultItem(
                            item_ref=item.item_ref,
                            element_id=element.element_id,
                            content_id=content.content_id,
                            status=str(detail.get("generationStatus")),
                            retry_count=int(detail.get("retryCount", 0)),
                            generation_task_id=detail.get("generationTaskId"),
                            next_action="Call wait_canvas_generation with the same generation_task_id.",
                            idempotent_replay=True,
                        ))
                        continue
                if content.fields.generation_status not in {"failed", "terminated"}:
                    raise CanvasDomainError(
                        "CONTENT_RETRY_NOT_ALLOWED",
                        "Only failed or terminated generated Content can be retried.",
                    )
                if detail.get("source") != "generated":
                    raise CanvasDomainError("CONTENT_RETRY_NOT_ALLOWED", "Only generated Content can be retried.")
                retry_count = int(detail.get("retryCount", 0))
                if retry_count >= 2:
                    raise CanvasDomainError("CONTENT_RETRY_LIMIT_REACHED", "This Content has reached the retry limit.")
                previous_status = content.fields.generation_status
                if not isinstance(content.fields, GeneratedMediaContentFields):
                    raise CanvasDomainError("CONTENT_RETRY_NOT_ALLOWED", "Only generated media Content can be retried.")
                content.fields.mark_pending()
                retry_detail = CanvasApplicationOperations.start_retry_detail(
                    element.element_id,
                    detail,
                    retry_count + 1,
                    parameters,
                    idempotency_key,
                    element_type=element.element_type,
                    project_path=project_path,
                )
                if isinstance(content.fields, VideoContentFields):
                    retry_parameters = retry_detail.get("generationParameters")
                    initial_metadata = ContentMetadataService.build_video_result_metadata(
                        retry_parameters if isinstance(retry_parameters, dict) else {}
                    )
                    content.fields.replace_generation_result_metadata(
                        ContentMetadataService.merge_video_result_metadata({}, initial_metadata, "pending")
                    )
                if is_composition:
                    retry_detail["retryResult"] = self._composition_retry_result(
                        item.item_ref,
                        element.element_id,
                        content.content_id,
                        retry_count + 1,
                        "processing",
                    )
                CanvasApplicationOperations.set_content_detail(
                    metadata,
                    element.element_id,
                    item.content_id,
                    retry_detail,
                )
                results.append(RetryContentResultItem(
                    item_ref=item.item_ref,
                    element_id=element.element_id,
                    content_id=content.content_id,
                    status="pending",
                    previous_status=previous_status,
                    retry_count=retry_count + 1,
                    main_content_id=element.main_content_id,
                ))
                if is_composition:
                    composition_retries.append(_CompositionRetryRequest(
                        item_ref=item.item_ref,
                        element_id=element.element_id,
                        content_id=content.content_id,
                        input_spec=composition_input_spec,
                        result_name=parameters.get("name") or element.properties.name or "Canvas final video",
                        retry_count=retry_count + 1,
                        idempotency_key=idempotency_key,
                    ))
                else:
                    retry_requests.append(GenerationSubmissionCommand(
                        item_ref=item.item_ref,
                        element_id=element.element_id,
                        content_id=content.content_id,
                        element_type=element.element_type,
                        parameters=GenerationParameters.from_dict(parameters),
                        retry_count=retry_count + 1,
                        retry_idempotency_key=idempotency_key,
                    ))
            return RetryContentsResult(results), metadata

        try:
            result = await self.unit_of_work.transaction_with_sidecar(project_path, mutate)
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(item_list), current_item_ref, error) from error
        result = await self.generation_submission_service.submit_generated(project_path, result, retry_requests, tool_context)
        result_items = {item.item_ref: item for item in result.items}
        for retry in composition_retries:
            target = result_items[retry.item_ref]
            try:
                composed = await self.video_composition_service.compose(
                    project_path,
                    retry.result_name,
                    retry.element_id,
                    tool_context,
                    result_content_id=retry.content_id,
                    retry_count=retry.retry_count,
                    input_spec=retry.input_spec,
                )
                target.status = composed.status
                target.output_uri = composed.src
            except Exception as error:
                target.status = "failed"
                target.error = str(error)
                await self._safe_persist_composition_retry_result(
                    project_path, retry, status="failed", output_uri=None, error=str(error), target=target
                )
                continue
            await self._safe_persist_composition_retry_result(
                project_path, retry, status=composed.status, output_uri=composed.src, error=None, target=target
            )
        return result

    @staticmethod
    def _is_composition(detail: dict[str, Any], parameters: object) -> bool:
        """识别当前 Content 是否由 Canvas 视频合成服务负责产出。"""
        return (
            isinstance(parameters, dict) and parameters.get("task") == "compose"
        ) or detail.get("productionRule") == "video_composition"

    @staticmethod
    def _composition_input_spec(detail: dict[str, Any]) -> CompositionInputSpec | None:
        """从合成结果 metadata 恢复完整、独立的合成输入快照。"""
        composition = detail.get("composition")
        if not isinstance(composition, dict):
            return None
        output = composition.get("output")
        video_element_ids = composition.get("videoSequence")
        audio_element_ids = composition.get("audioSequence")
        video_sources = composition.get("resolvedVideos")
        audio_sources = composition.get("resolvedAudios")
        if (
            not isinstance(output, dict)
            or not isinstance(video_element_ids, list)
            or not isinstance(audio_element_ids, list)
            or not isinstance(video_sources, list)
            or not isinstance(audio_sources, list)
        ):
            return None
        try:
            return CompositionInputSpec(
                video_element_ids=tuple(value for value in video_element_ids if isinstance(value, str)),
                audio_element_ids=tuple(value for value in audio_element_ids if isinstance(value, str)),
                video_sources=tuple(value for value in video_sources if isinstance(value, str)),
                audio_sources=tuple(value for value in audio_sources if isinstance(value, str)),
                output_width=int(composition["resolvedWidth"]),
                output_height=int(composition["resolvedHeight"]),
                audio_policy=CompositionOutput.from_dict(output).audio_policy,
                output=CompositionOutput.from_dict(output),
            )
        except (KeyError, TypeError, ValueError, CanvasDomainError):
            return None

    @staticmethod
    def _composition_input_dict(spec: CompositionInputSpec) -> dict[str, Any]:
        """将合成输入快照转换为幂等键使用的稳定对象。"""
        return {
            "videoSequence": list(spec.video_element_ids),
            "audioSequence": list(spec.audio_element_ids),
            "resolvedVideos": list(spec.video_sources),
            "resolvedAudios": list(spec.audio_sources),
            "resolvedWidth": spec.output_width,
            "resolvedHeight": spec.output_height,
            "output": spec.output.to_dict(),
        }

    @staticmethod
    def _composition_retry_result(
        item_ref: str,
        element_id: str,
        content_id: str,
        retry_count: int,
        status: str,
        output_uri: str | None = None,
        error: str | None = None,
    ) -> dict[str, Any]:
        """构造合成重试的可重放结果，确保重试不会创建新 Element。"""
        return {
            "item_ref": item_ref,
            "element_id": element_id,
            "content_id": content_id,
            "status": status,
            "retry_count": retry_count,
            "output_uri": output_uri,
            "error": error,
            "next_action": "Call query_canvas_element_details to verify the retried Content.",
        }

    async def _persist_composition_retry_result(
        self,
        project_path: str,
        retry: _CompositionRetryRequest,
        *,
        status: str,
        output_uri: str | None,
        error: str | None,
    ) -> None:
        """把同步合成重试的最终结果写回原 Content 的运行态详情。"""
        retry_result = self._composition_retry_result(
            retry.item_ref,
            retry.element_id,
            retry.content_id,
            retry.retry_count,
            status,
            output_uri,
            error,
        )

        def persist(project: CanvasProject, metadata: dict) -> tuple[None, dict]:
            """在事务内更新原 Content 的合成重试结果。"""
            detail = ContentMetadataService.get(metadata, retry.element_id, retry.content_id)
            ContentMetadataService.set(
                metadata,
                retry.element_id,
                retry.content_id,
                {
                    **detail,
                    "generationStatus": status,
                    "outputUri": output_uri,
                    "errorMessage": error,
                    "retryIdempotencyKey": retry.idempotency_key,
                    "retryResult": retry_result,
                },
            )
            return None, metadata

        await self.unit_of_work.transaction_with_sidecar(project_path, persist)

    async def _safe_persist_composition_retry_result(
        self,
        project_path: str,
        retry: _CompositionRetryRequest,
        *,
        status: str,
        output_uri: str | None,
        error: str | None,
        target: RetryContentResultItem,
    ) -> None:
        """尽力写回合成重试元数据，避免元数据故障覆盖真实合成结果。"""
        try:
            await self._persist_composition_retry_result(
                project_path,
                retry,
                status=status,
                output_uri=output_uri,
                error=error,
            )
        except Exception as persistence_error:
            target.persistence_warning = "Composition result was produced, but retry metadata was not persisted."
            target.persistence_error = str(persistence_error)
