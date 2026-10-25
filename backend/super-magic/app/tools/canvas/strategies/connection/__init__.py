"""Connection 策略接口、实现和注册器。"""

from app.tools.canvas.strategies.connection.direct_connection import DirectConnectionStrategy
from app.tools.canvas.strategies.connection.interface import ConnectionStrategyInterface
from app.tools.canvas.strategies.connection.plan import ConnectionMutationPlan
from app.tools.canvas.strategies.connection.registry import ConnectionStrategyRegistry
from app.tools.canvas.strategies.connection.request import ConnectionStrategyRequest

__all__ = [
    "ConnectionMutationPlan",
    "ConnectionStrategyInterface",
    "ConnectionStrategyRegistry",
    "ConnectionStrategyRequest",
    "DirectConnectionStrategy",
]
