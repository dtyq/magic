"""Content 策略接口、实现和注册器。"""

from app.tools.canvas.strategies.content.base_content import BaseContentStrategy
from app.tools.canvas.strategies.content.generated_content import GeneratedContentStrategy
from app.tools.canvas.strategies.content.imported_asset import ImportedAssetContentStrategy
from app.tools.canvas.strategies.content.interface import ContentStrategyInterface
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.registry import ContentStrategyRegistry
from app.tools.canvas.strategies.content.request import ContentStrategyRequest
from app.tools.canvas.strategies.content.user_content import UserContentStrategy

BasicContentStrategy = UserContentStrategy

__all__ = [
    "BaseContentStrategy",
    "BasicContentStrategy",
    "ContentMutationPlan",
    "ContentStrategyInterface",
    "ContentStrategyRegistry",
    "ContentStrategyRequest",
    "GeneratedContentStrategy",
    "ImportedAssetContentStrategy",
    "UserContentStrategy",
]
