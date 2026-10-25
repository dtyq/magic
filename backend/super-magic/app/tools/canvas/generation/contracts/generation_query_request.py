"""生成任务查询请求模型。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationQueryRequest:
    """描述查询外部任务所需的 Canvas 上下文。"""

    provider_task_id: str
    project_path: str
    element_id: str
    content_id: str
    output_filename: str | None = None
