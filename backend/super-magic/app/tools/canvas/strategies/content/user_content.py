"""用户直接提供内容的策略。"""

from app.tools.canvas.strategies.content.base_content import BaseContentStrategy
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest


class UserContentStrategy(BaseContentStrategy):
    """处理用户直接提供且无需外部生成的 Content。"""

    source = "user"

    def plan(self, request: ContentStrategyRequest) -> ContentMutationPlan:
        """创建用户 Content 计划。"""
        return self._build_base_content(request)
