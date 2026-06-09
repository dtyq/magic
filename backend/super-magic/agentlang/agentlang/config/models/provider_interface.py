"""
模型服务商接口定义

ModelProvider 是所有服务商 Provider 的统一契约。
每个 Provider 负责从自己的数据源加载模型配置列表。
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from agentlang.config.models.model_config import ModelConfig


@dataclass
class RefreshPolicy:
    """Provider 自动刷新策略

    两个条件为"或"关系，任一满足即触发后台刷新。
    字段设为 None 表示不启用该条件。
    """
    # 每累计 N 次使用后刷新
    use_count: Optional[int] = None
    # 距上次成功加载超过 N 秒后刷新
    interval_seconds: Optional[int] = None


class ModelProvider(ABC):
    """模型服务商抽象接口

    实现此接口以接入新的模型来源。
    优先级规则：priority 数值越高，同 model_id 时越优先被采用。
    """

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """服务商类型标识，如 "config.yaml"、"magic-service"、"openai"""
        ...

    @property
    @abstractmethod
    def priority(self) -> int:
        """加载优先级，数值越高优先级越高，同 model_id 时高优先级覆盖低优先级"""
        ...

    @property
    def refresh_policy(self) -> Optional[RefreshPolicy]:
        """自动刷新策略，返回 None 表示不自动刷新（默认行为）"""
        return None

    @abstractmethod
    async def load(self) -> List[ModelConfig]:
        """从数据源加载模型配置列表

        Returns:
            List[ModelConfig]: 该服务商提供的所有模型配置，加载失败时返回空列表
        """
        ...
