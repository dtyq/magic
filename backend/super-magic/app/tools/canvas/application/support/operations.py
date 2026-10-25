"""Canvas Application 共享的无状态业务操作。"""

from collections.abc import Sequence
from typing import Any

from app.tools.canvas.application.support.atomic_batch_guard import AtomicBatchGuard, ItemReferenceCommand
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasConnection, CanvasProject
from app.tools.canvas.generation.result.canvas_generation_result_applier import CanvasGenerationResultApplier
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.strategies import ConnectionStrategyRegistry


class CanvasApplicationOperations:
    """提供不持有运行时依赖的重复业务操作。"""

    @staticmethod
    def get_content_detail(metadata: dict, element_id: str, content_id: str) -> dict[str, Any]:
        """读取 Content 级 sidecar 详情。"""
        return ContentMetadataService.get(metadata, element_id, content_id)

    @staticmethod
    def set_content_detail(metadata: dict, element_id: str, content_id: str, detail: dict[str, Any]) -> None:
        """写入 Content 级 sidecar 详情。"""
        ContentMetadataService.set(metadata, element_id, content_id, detail)

    @staticmethod
    def new_content_detail(element_id: str, data: dict[str, Any], project_path: str | None = None) -> dict[str, Any]:
        """创建 Content 来源和生成尝试详情。"""
        return ContentMetadataService.new_detail(element_id, data, project_path=project_path)

    @staticmethod
    def validate_unique_item_refs(items: Sequence[ItemReferenceCommand]) -> None:
        """保证批次关联标签唯一。"""
        AtomicBatchGuard.validate_item_refs(items)

    @staticmethod
    def batch_error(items: Sequence[ItemReferenceCommand], failed_item_ref: str | None, error: CanvasDomainError) -> CanvasDomainError:
        """把多项原子批量异常转换为逐项结果。"""
        return AtomicBatchGuard.map_error(items, failed_item_ref, error)

    @staticmethod
    def merge_generation_override(element_type: str, original: dict[str, Any], override: dict[str, Any] | None) -> dict[str, Any]:
        """只允许覆盖生成能力公开的输入字段。"""
        return ContentMetadataService.merge_generation_override(element_type, original, override)

    @staticmethod
    def start_retry_detail(element_id: str, detail: dict[str, Any], retry_count: int, parameters: dict[str, Any], idempotency_key: str, element_type: str | None = None, project_path: str | None = None) -> dict[str, Any]:
        """归档上一次终态并创建新的重试详情。"""
        return ContentMetadataService.start_retry(
            element_id,
            detail,
            retry_count,
            parameters,
            idempotency_key,
            element_type=element_type,
            project_path=project_path,
        )

    @staticmethod
    def apply_generation_result(result_applier: CanvasGenerationResultApplier, project: CanvasProject, element_id: str, content_id: str, status: str, output_uri: str | None, error_message: str | None) -> None:
        """把生成终态委托给结果回写器。"""
        result_applier.apply(project, element_id, content_id, status, output_uri, error_message)

    @staticmethod
    def get_connection(project: CanvasProject, connection_id: str) -> CanvasConnection | None:
        """按 Connection ID 查找关系。"""
        return next((item for item in project.canvas.connections if item.connection_id == connection_id), None)

    @staticmethod
    def add_connection(connection_strategies: ConnectionStrategyRegistry, project: CanvasProject, source: str, target: str) -> CanvasConnection:
        """校验并新增一条幂等 Connection。"""
        if project.canvas.get_element(source) is None or project.canvas.get_element(target) is None:
            raise CanvasDomainError("ELEMENT_NOT_FOUND", "Connection endpoints must reference existing Elements.")
        if source == target:
            raise CanvasDomainError("INVALID_CONNECTION", "A Connection cannot point to the same Element.")
        existing = next((item for item in project.canvas.connections if item.source_element_id == source and item.target_element_id == target), None)
        if existing is not None:
            return existing
        return connection_strategies.plan(project.canvas, source, target).apply(project.canvas)
