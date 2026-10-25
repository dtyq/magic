"""Content 策略变更计划。"""

from dataclasses import dataclass

from app.tools.canvas.domain.models import CanvasContent


@dataclass(frozen=True)
class ContentMutationPlan:
    """封装一个已经过策略校验的 Content。"""

    content: CanvasContent
