"""Canvas Content 操作命令模型。"""

from __future__ import annotations

from dataclasses import dataclass

from app.tools.canvas.application.commands.generation_override import GenerationParametersOverride


@dataclass(frozen=True)
class RetryContentCommand:
    """描述一个失败 generated Content 的重试命令。"""

    item_ref: str
    element_id: str
    content_id: str
    generation_override: GenerationParametersOverride | None = None


@dataclass(frozen=True)
class SelectMainContentCommand:
    """描述选择 Element 主 Content 的命令。"""

    item_ref: str
    element_id: str
    content_id: str
