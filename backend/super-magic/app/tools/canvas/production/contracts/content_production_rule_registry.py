"""内容产出规则注册器。"""

from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.canvas.production.contracts.content_production_rule_interface import ContentProductionRuleInterface


class ContentProductionRuleRegistry:
    """按明确规则名称保存和选择内容产出实现。"""

    def __init__(self, rules: list[ContentProductionRuleInterface]) -> None:
        """显式接收 Composition Root 创建的规则列表。"""
        self._rules = {rule.name: rule for rule in rules}

    def get(self, name: str) -> ContentProductionRuleInterface:
        """返回指定规则，未注册时提供稳定错误码。"""
        rule = self._rules.get(name)
        if rule is None:
            raise CanvasDomainError("CONTENT_PRODUCTION_RULE_NOT_FOUND", f"Content production rule is not configured: {name}.")
        return rule
