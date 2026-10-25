"""内容积分预估请求接口。"""

from abc import ABC, abstractmethod


class CostEstimateRequestInterface(ABC):
    """定义所有内容产出预估请求必须暴露的稳定身份。"""

    @property
    @abstractmethod
    def project_path(self) -> str:
        """返回请求所属的 Canvas 项目路径。"""

    @property
    @abstractmethod
    def item_ref(self) -> str:
        """返回当前批次中的稳定短引用。"""

    @property
    @abstractmethod
    def production_rule(self) -> str:
        """返回内容产出规则名称。"""

    @property
    @abstractmethod
    def request_fingerprint(self) -> str:
        """返回规范化参数指纹。"""
