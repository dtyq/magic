"""布局策略请求模型。"""

from dataclasses import dataclass

from app.tools.canvas.application.commands import LayoutCommand


@dataclass(frozen=True)
class LayoutStrategyRequest:
    """描述一次布局计算所需的稳定输入。"""

    element_id: str
    options: LayoutCommand
    index: int = 0
