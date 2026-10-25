"""Connection 策略请求模型。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectionStrategyRequest:
    """描述一条直接连线的起点和终点。"""

    source_element_id: str
    target_element_id: str
