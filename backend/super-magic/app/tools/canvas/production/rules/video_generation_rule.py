"""视频生成内容产出规则。"""

from app.tools.canvas.production.contracts import ContentProductionRuleInterface, ProductionResultType


class VideoGenerationRule(ContentProductionRuleInterface):
    """声明视频生成的单 Content 结果边界。"""

    @property
    def name(self) -> str:
        """返回规则名称。"""
        return "video_generation"

    @property
    def result_type(self) -> ProductionResultType:
        """返回单 Content 结果类型。"""
        return ProductionResultType.SINGLE_CONTENT
