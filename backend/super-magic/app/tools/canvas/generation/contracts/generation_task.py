"""Canvas 生成任务绑定模型。"""

from dataclasses import dataclass


@dataclass
class GenerationTask:
    """保存 Canvas 任务与 provider 任务之间的内部绑定。"""

    generation_task_id: str
    provider_task_id: str
    project_path: str
    element_id: str
    content_id: str
    element_type: str
    capability_name: str
    retry_count: int = 0
    status: str = "processing"
    error: str | None = None
    output_uri: str | None = None
    output_filename: str | None = None
