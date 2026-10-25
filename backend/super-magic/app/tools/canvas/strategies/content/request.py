"""Content 策略请求模型。"""

from dataclasses import dataclass

from app.tools.canvas.application.commands import ContentCommand


@dataclass(frozen=True)
class ContentStrategyRequest:
    """描述 Content 构建所需的输入和所属 Element 类型。"""

    command: ContentCommand
    element_type: str | None = None
