"""生成能力描述模型。"""

from dataclasses import dataclass

from app.tools.canvas.generation.ports.query_port import GenerationQueryPort
from app.tools.canvas.generation.ports.submission_port import GenerationSubmissionPort


@dataclass(frozen=True)
class GenerationCapability:
    """描述一种 Element 类型当前使用的生成能力。"""

    name: str
    element_type: str
    execution_mode: str
    submission_port: GenerationSubmissionPort
    query_port: GenerationQueryPort | None = None
    model_id: str | None = None
    billable: bool = False
    production_rule: str | None = None
