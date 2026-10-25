"""生成提交结果模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class GenerationSubmission:
    """描述一次生成提交的执行状态和任务标识。"""

    execution_mode: str
    status: str
    generation_task_id: str | None = None
    output_uri: str | None = None
    error_message: str | None = None
    provider_task_id: str | None = None
    request_metadata: JsonObject | None = None
    result_metadata: JsonObject | None = None
