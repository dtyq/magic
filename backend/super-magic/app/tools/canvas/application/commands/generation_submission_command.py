"""Canvas 生成提交命令。"""

from dataclasses import dataclass, field

from app.tools.canvas.application.commands.generation_parameters import GenerationParameters


@dataclass(frozen=True)
class GenerationSubmissionCommand:
    """描述一个已经持久化、等待提交生成能力的 Content。"""

    element_id: str
    content_id: str
    element_type: str
    parameters: GenerationParameters = field(default_factory=GenerationParameters)
    item_ref: str | None = None
    retry_count: int = 0
    retry_idempotency_key: str | None = None
