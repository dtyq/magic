"""Content 策略共享校验基类。"""

from abc import ABC

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasContent
from app.tools.canvas.strategies.content.interface import ContentStrategyInterface
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest


class BaseContentStrategy(ContentStrategyInterface, ABC):
    """提供所有 Content 策略共享的类型校验。"""

    def _build_base_content(self, request: ContentStrategyRequest) -> ContentMutationPlan:
        """根据请求创建不包含内部生成参数的 Content 计划。"""
        command = request.command
        content_id = command.content_id
        if not content_id:
            raise CanvasDomainError("CONTENT_INPUT_INVALID", "Content ID must be assigned before strategy execution.")
        if request.element_type is not None and command.content_type != request.element_type:
            raise CanvasDomainError(
                "CONTENT_TYPE_MISMATCH",
                f"Content type {command.content_type} does not match Element type {request.element_type}.",
            )
        return ContentMutationPlan(CanvasContent(str(content_id), command.fields.clone()))
