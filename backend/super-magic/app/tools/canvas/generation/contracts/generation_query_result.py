"""生成任务查询结果模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.types import JsonObject


@dataclass(frozen=True)
class GenerationQueryResult:
    """描述一次外部任务查询结果。"""

    status: str
    output_uri: str | None = None
    error_message: str | None = None
    result_metadata: JsonObject | None = None
