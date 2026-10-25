"""Canvas Agent 的 Element 写入权限策略。"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Protocol, TypeVar

from app.tools.canvas.application.commands import AddElementCommand, FrameElementsCommand
from app.tools.canvas.application.support import AtomicBatchGuard
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.domain.services.spatial_geometry import CanvasSpatialGeometry

AGENT_WRITABLE_ELEMENT_TYPES = (
    "frame",
    "storyboard",
    "video-edit",
    "image",
    "video",
    "audio",
)
_AGENT_WRITABLE_ELEMENT_TYPE_SET = frozenset(AGENT_WRITABLE_ELEMENT_TYPES)


class PolicyItem(Protocol):
    """声明 Agent 写入策略需要的批次关联字段。"""

    item_ref: str


class ElementTargetCommand(PolicyItem, Protocol):
    """声明按 Element ID 执行写入的工具命令。"""

    element_id: str


TPolicyItem = TypeVar("TPolicyItem", bound=PolicyItem)


class CanvasAgentWritePolicy:
    """统一限制 Canvas Agent 可创建或编辑的 Element 类型。"""

    @classmethod
    def validate_creation(cls, items: Sequence[AddElementCommand]) -> None:
        """拒绝 Agent 创建只读 Element 类型。"""
        cls._validate_batch(items, lambda item: (item.element_type,))

    @classmethod
    async def validate_targets(
        cls,
        repository: CanvasRepositoryInterface,
        project_path: str,
        items: Sequence[ElementTargetCommand],
    ) -> None:
        """读取目标 Element 类型并拒绝 Agent 编辑只读类型。"""
        project = await repository.read(project_path)

        def resolve(item: ElementTargetCommand) -> tuple[str, ...]:
            element = project.canvas.get_element(item.element_id)
            if element is None:
                raise CanvasDomainError("ELEMENT_NOT_FOUND", f"Element {item.element_id} does not exist.")
            return (element.element_type,)

        cls._validate_batch(items, resolve)

    @classmethod
    async def validate_frame_selection(
        cls,
        repository: CanvasRepositoryInterface,
        project_path: str,
        items: Sequence[FrameElementsCommand],
    ) -> None:
        """框选已有元素只检查存在和锁定状态，不改变内容生成权限。"""
        project = await repository.read(project_path)

        geometry = CanvasSpatialGeometry(project.canvas)
        current_item_ref: str | None = None
        try:
            for item in items:
                current_item_ref = item.item_ref
                for element_id in item.element_ids:
                    # 框选只改变容器和坐标，不能沿用内容生成类型白名单；锁定限制仍然有效。
                    geometry.assert_mutable(element_id)
        except CanvasDomainError as error:
            raise AtomicBatchGuard.map_error(items, current_item_ref, error) from error

    @classmethod
    def _validate_batch(
        cls,
        items: Sequence[TPolicyItem],
        resolve_types: Callable[[TPolicyItem], tuple[str, ...]],
    ) -> None:
        """按 item_ref 将类型权限错误映射为原子批次结果。"""
        current_item_ref: str | None = None
        try:
            for item in items:
                current_item_ref = item.item_ref
                for element_type in resolve_types(item):
                    cls._validate_type(element_type)
        except CanvasDomainError as error:
            raise AtomicBatchGuard.map_error(items, current_item_ref, error) from error

    @staticmethod
    def _validate_type(element_type: str) -> None:
        """校验单个 Element 类型是否允许 Agent 写入。"""
        if element_type in _AGENT_WRITABLE_ELEMENT_TYPE_SET:
            return
        allowed = ", ".join(AGENT_WRITABLE_ELEMENT_TYPES)
        raise CanvasDomainError(
            "ELEMENT_MUTATION_NOT_ALLOWED",
            f"Element type '{element_type}' is read-only for the Canvas Agent. "
            f"Writable Element types are: {allowed}.",
        )
