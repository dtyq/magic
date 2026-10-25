"""
AI 能力 Provider 抽象。

Provider 负责从单一来源加载 AIAbilityConfig，合并与刷新由 manager 统一处理。
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from agentlang.config.ai_abilities.ability_config import AIAbilityConfig


@dataclass
class RefreshPolicy:
    """Provider 自动刷新策略。"""

    use_count: Optional[int] = None
    interval_seconds: Optional[int] = None


class AIAbilityProvider(ABC):
    """AI 能力配置来源抽象接口。"""

    @property
    @abstractmethod
    def provider_type(self) -> str:
        """返回 provider 类型标识。"""
        ...

    @property
    @abstractmethod
    def priority(self) -> int:
        """返回加载优先级，数值越高越优先。"""
        ...

    @property
    def refresh_policy(self) -> Optional[RefreshPolicy]:
        """返回自动刷新策略，None 表示不自动刷新。"""
        return None

    def get_runtime_log_summary(self) -> str:
        """返回刷新日志所需的运行时配置摘要。"""
        return ""

    @abstractmethod
    async def load(self) -> List[AIAbilityConfig]:
        """从数据源加载 AI 能力配置列表。"""
        ...
