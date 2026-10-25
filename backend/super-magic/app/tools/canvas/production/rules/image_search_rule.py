"""图片搜索内容产出规则。"""

from app.tools.canvas.production.contracts import ContentProductionRuleInterface, ProductionResultType


class ImageSearchRule(ContentProductionRuleInterface):
    """声明 image_search 的批量 imported 结果边界。"""

    @property
    def name(self) -> str:
        """返回规则名称。"""
        return "image_search"

    @property
    def result_type(self) -> ProductionResultType:
        """返回批量导入结果类型。"""
        return ProductionResultType.BATCH_IMPORT
