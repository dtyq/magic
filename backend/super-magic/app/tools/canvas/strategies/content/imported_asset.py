"""工作区素材导入策略。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.strategies.content.base_content import BaseContentStrategy
from app.tools.canvas.strategies.content.plan import ContentMutationPlan
from app.tools.canvas.strategies.content.request import ContentStrategyRequest


class ImportedAssetContentStrategy(BaseContentStrategy):
    """处理从工作区导入的媒体 Content。"""

    source = "imported"

    def plan(self, request: ContentStrategyRequest) -> ContentMutationPlan:
        """校验导入 Content 必须提供已经规范化的素材 URI。"""
        content = self._build_base_content(request).content
        if not content.fields.asset_path:
            raise CanvasDomainError("CONTENT_INPUT_INVALID", "Imported Content requires src.")
        return ContentMutationPlan(content)
