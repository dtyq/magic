"""Content 追加和主版本选择用例服务。"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence

from agentlang.context.tool_context import ToolContext
from app.tools.canvas.application.canvas_id import new_canvas_id
from app.tools.canvas.application.commands import (
    AddContentCommand,
    ContentCommand,
    GenerationParameters,
    GenerationSubmissionCommand,
    SelectMainContentCommand,
)
from app.tools.canvas.application.content_preparation_service import ContentPreparationService, PreparedContentCommand
from app.tools.canvas.application.results import (
    AddContentResultItem,
    AddContentsResult,
    SelectMainContentResultItem,
    SelectMainContentsResult,
)
from app.tools.canvas.application.support import CanvasApplicationOperations
from app.tools.canvas.domain.content_fields.video_edit import VideoEditContentFields
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasProject
from app.tools.canvas.domain.services import VideoEditContentValidator
from app.tools.canvas.repository import CanvasUnitOfWork


class ContentService:
    """Canvas ContentService 用例服务。"""

    def __init__(
        self,
        unit_of_work: CanvasUnitOfWork,
        content_preparation: ContentPreparationService,
        generation_submission_service,
    ):
        """显式绑定追加 Content 所需的事务、内容准备和生成提交服务。"""
        self.unit_of_work = unit_of_work
        self.content_preparation = content_preparation
        self.generation_submission_service = generation_submission_service

    async def add_contents(
        self,
        project_path: str,
        items: Sequence[AddContentCommand],
        tool_context: ToolContext | None = None,
        *,
        on_placeholders_created: Callable[[AddContentsResult], Awaitable[None]] | None = None,
    ) -> AddContentsResult:
        """向已有 Element 追加 Content 版本。"""
        generated: list[GenerationSubmissionCommand] = []
        prepared_contents: list[PreparedContentCommand] = []
        item_list = tuple(items)
        CanvasApplicationOperations.validate_unique_item_refs(item_list)
        current_item_ref: str | None = None

        async def mutate(project: CanvasProject, metadata: dict) -> tuple[AddContentsResult, dict]:
            nonlocal current_item_ref
            results: list[AddContentResultItem] = []
            for item in item_list:
                current_item_ref = item.item_ref
                element = project.canvas.get_element(item.element_id)
                if element is None:
                    raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {item.element_id} does not exist.")
                if element.element_type in {"frame", "group"}:
                    raise CanvasDomainError("FRAME_CONTENT_MANAGED_INTERNAL", "Frame and Group Content is managed internally.")
                command = item.content
                if command.is_composition:
                    raise CanvasDomainError(
                        "CONTENT_INPUT_INVALID",
                        "task=compose is only supported when creating the final video Element with add_canvas_elements.",
                    )
                if command.content_id is None:
                    command = ContentCommand(
                        source=command.source,
                        content_type=command.content_type,
                        fields=command.fields,
                        asset_path=command.asset_path,
                        generation_parameters=command.generation_parameters,
                        content_id=new_canvas_id("content"),
                    )
                prepared = await self.content_preparation.prepare_imported(command, project_path)
                prepared_contents.append(prepared)
                command = prepared.command
                materialized_asset_path = command.asset_path if command.is_imported else None
                content = self.content_preparation.build(command, element.element_type)
                if element.get_content(content.content_id) is not None:
                    raise CanvasDomainError("CONTENT_ALREADY_EXISTS", f"Content {content.content_id} already exists.")
                element.contents.append(content)
                if isinstance(content.fields, VideoEditContentFields):
                    VideoEditContentValidator.validate(
                        project,
                        element.element_id,
                        content.fields,
                    )
                if len(element.contents) == 1:
                    element.active_content_id = content.content_id
                    element.main_content_id = content.content_id
                status = "pending" if command.is_generated else "completed"
                results.append(AddContentResultItem(
                    item_ref=item.item_ref,
                    element_id=element.element_id,
                    content_id=content.content_id,
                    status=status,
                    asset_path=materialized_asset_path,
                ))
                if command.is_generated:
                    generated.append(GenerationSubmissionCommand(
                        item_ref=item.item_ref,
                        element_id=element.element_id,
                        content_id=content.content_id,
                        element_type=element.element_type,
                        parameters=command.generation_parameters or GenerationParameters(),
                    ))
                CanvasApplicationOperations.set_content_detail(
                    metadata,
                    element.element_id,
                    content.content_id,
                    CanvasApplicationOperations.new_content_detail(element.element_id, command.to_metadata(), project_path),
                )
            return AddContentsResult(results), metadata

        try:
            result = await self.unit_of_work.transaction_with_sidecar(
                project_path,
                mutate,
                on_rollback=lambda: self.content_preparation.discard_materialized(prepared_contents),
            )
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(item_list), current_item_ref, error) from error
        # 追加版本与新增元素共用同一时机：先保存占位 Content，再发送可定位进度。
        if generated and on_placeholders_created is not None:
            await on_placeholders_created(result)
        return await self.generation_submission_service.submit_generated(
            project_path,
            result,
            generated,
            tool_context,
            on_progress_updated=on_placeholders_created,
        )

    async def select_main(self, project_path: str, items: Sequence[SelectMainContentCommand]) -> SelectMainContentsResult:
        """选择用户明确指定的 main Content，并同步 active Content 指针。"""
        item_list = tuple(items)
        CanvasApplicationOperations.validate_unique_item_refs(item_list)
        current_item_ref: str | None = None
        def mutate(project: CanvasProject, metadata: dict) -> tuple[SelectMainContentsResult, dict]:
            nonlocal current_item_ref
            results: list[SelectMainContentResultItem] = []
            for item in item_list:
                current_item_ref = item.item_ref
                element = project.canvas.get_element(item.element_id)
                if element is None:
                    raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {item.element_id} does not exist.")
                if element.element_type in {"frame", "group"}:
                    raise CanvasDomainError("FRAME_CONTENT_MANAGED_INTERNAL", "Frame and Group Content is managed internally.")
                content = element.get_content(item.content_id)
                if content is None:
                    raise CanvasDomainError("CONTENT_NOT_FOUND", f"Content {item.content_id} does not exist.")
                if content.fields.generation_status not in {None, "completed"}:
                    raise CanvasDomainError("MAIN_CONTENT_NOT_COMPLETED", "The selected Content is not completed.")
                previous = element.main_content_id
                element.main_content_id = content.content_id
                element.active_content_id = content.content_id
                results.append(SelectMainContentResultItem(
                    item_ref=item.item_ref,
                    status="completed",
                    element_id=element.element_id,
                    previous_main_content_id=previous,
                    main_content_id=content.content_id,
                    active_content_id=element.active_content_id,
                ))
            return SelectMainContentsResult(results), metadata

        try:
            return await self.unit_of_work.transaction_with_sidecar(project_path, mutate)
        except CanvasDomainError as error:
            raise CanvasApplicationOperations.batch_error(list(item_list), current_item_ref, error) from error
