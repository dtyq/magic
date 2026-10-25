"""内容产出规则接口。"""

from abc import ABC, abstractmethod

from app.tools.canvas.production.contracts.production_result_type import ProductionResultType


class ContentProductionRuleInterface(ABC):
    """定义所有内容产出规则共有的稳定业务身份。"""

    @property
    @abstractmethod
    def name(self) -> str:
        """返回规则名称。"""

    @property
    @abstractmethod
    def result_type(self) -> ProductionResultType:
        """返回规则的确定结果类型。"""
