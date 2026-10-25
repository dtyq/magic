"""图片生成内容产出规则。"""

from app.tools.canvas.production.contracts import ContentProductionRuleInterface, ProductionResultType


class ImageGenerationRule(ContentProductionRuleInterface):
    """声明图片生成的单 Content 结果边界。"""

    @property
    def name(self) -> str:
        """返回规则名称。"""
        return "image_generation"

    @property
    def result_type(self) -> ProductionResultType:
        """返回单 Content 结果类型。"""
        return ProductionResultType.SINGLE_CONTENT
