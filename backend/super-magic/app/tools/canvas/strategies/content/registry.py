"""Content 策略注册器。"""

from app.tools.canvas.application.commands import ContentCommand
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.domain.models import CanvasContent
from app.tools.canvas.strategies.content.generated_content import GeneratedContentStrategy
from app.tools.canvas.strategies.content.imported_asset import ImportedAssetContentStrategy
from app.tools.canvas.strategies.content.interface import ContentStrategyInterface
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest
from app.tools.canvas.strategies.content.user_content import UserContentStrategy


class ContentStrategyRegistry:
    """只负责按 source 选择 Content 策略实现。"""

    def __init__(self, strategies: list[ContentStrategyInterface] | None = None):
        """注册默认 Content 策略或调用方提供的替换实现。"""
        values = strategies or [
            UserContentStrategy(),
            ImportedAssetContentStrategy(),
            GeneratedContentStrategy(),
        ]
        self._strategies = {strategy.source: strategy for strategy in values}

    def build(self, command: ContentCommand, element_type: str | None = None) -> CanvasContent:
        """执行选中的 Content 策略并返回 Content。"""
        return self.plan(command, element_type).content

    def plan(self, command: ContentCommand, element_type: str | None = None) -> ContentMutationPlan:
        """校验 Element 类型并返回强类型 Content 计划。"""
        source = command.source
        content_type = command.content_type
        if element_type is not None and content_type != element_type:
            raise CanvasDomainError(
                "CONTENT_TYPE_MISMATCH",
                f"Content type {content_type} does not match Element type {element_type}.",
            )
        strategy = self._strategies.get(source)
        if strategy is None:
            raise CanvasDomainError("CONTENT_INPUT_INVALID", f"Unsupported Content source: {source}.")
        return strategy.plan(ContentStrategyRequest(command, element_type))
